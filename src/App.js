import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';

// Função auxiliar para determinar a cor do texto de contraste (preto ou branco)
// Esta função não será usada para os cartões agora, pois o texto será forçado a preto.
// No entanto, é mantida caso seja útil para outras partes do aplicativo ou futuras alterações.
const getContrastTextColor = (hexColor) => {
    if (!hexColor) return '#000000'; // Padrão para preto se não houver cor

    // Remove # se presente
    const cleanHex = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor;

    // Se o hex não tiver 6 caracteres, retorna um padrão e avisa
    if (cleanHex.length !== 6) {
        console.warn('Cor hexadecimal inválida para verificação de contraste:', hexColor);
        return '#000000'; // Padrão para preto para hex inválido
    }

    // Converte hex para RGB
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);

    // Calcula a luminância (brilho percebido) usando a fórmula YIQ
    // Fórmula: (R*0.299 + G*0.587 + B*0.114) / 255
    const luminance = (r * 299 + g * 587 + b * 114) / 1000;

    // Retorna texto preto para cores claras, branco para cores escuras
    return luminance > 186 ? '#000000' : '#ffffff'; // 186 é um limiar comum
};


// Componente principal da aplicação
const App = () => {
    // Estados para Firebase
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // Estados para navegação
    const [currentPage, setCurrentPage] = useState('home');
    const [showPlayerModal, setShowPlayerModal] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [modalContent, setModalContent] = useState('');
    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');

    // Estados para o Estúdio Criativo
    const canvasRef = useRef(null);
    const [drawingColor, setDrawingColor] = useState('#000000');
    const [drawingSize, setDrawingSize] = useState(5);
    const [drawings, setDrawings] = useState([]);
    const [letterContent, setLetterContent] = useState('');
    const [letters, setLetters] = useState([]);
    const [cardText, setCardText] = useState('');
    const [cardBgColor, setCardBgColor] = useState('#ffffff');
    const [cards, setCards] = useState([]);

    // Estados para o Rastreador de Humor
    const [currentMood, setCurrentMood] = useState('');
    const [moods, setMoods] = useState([]);

    // Estados para o Contador de Dias
    const [startDate, setStartDate] = useState(null); // Inicializado com null

    const [daysKnown, setDaysKnown] = useState(0);

    // Estados para a Agenda de Jogos
    const [gameSchedule, setGameSchedule] = useState([]);

    // Estados para a Galeria de Fotos
    const [photos, setPhotos] = useState([]);

    // Configuração e Inicialização do Firebase
    useEffect(() => {
        try {
            const firebaseConfig = {};
            let initialAuthToken = undefined;
            let currentAppId = 'default-app-id';

            // Verifica se está no ambiente de navegador (Canvas)
            if (typeof window !== 'undefined') {
                if (typeof __firebase_config !== 'undefined') {
                    Object.assign(firebaseConfig, JSON.parse(__firebase_config));
                }
                if (typeof __initial_auth_token !== 'undefined') {
                    initialAuthToken = __initial_auth_token;
                }
                if (typeof __app_id !== 'undefined') {
                    currentAppId = __app_id;
                }
            } else if (typeof process !== 'undefined' && process.env.REACT_APP_FIREBASE_API_KEY) {
                // Se não estiver no navegador, tenta usar variáveis de ambiente do processo (para Vercel, etc.)
                firebaseConfig.apiKey = process.env.REACT_APP_FIREBASE_API_KEY;
                firebaseConfig.authDomain = process.env.REACT_APP_FIREBASE_AUTH_DOMAIN;
                firebaseConfig.projectId = process.env.REACT_APP_FIREBASE_PROJECT_ID;
                firebaseConfig.storageBucket = process.env.REACT_APP_FIREBASE_STORAGE_BUCKET;
                firebaseConfig.messagingSenderId = process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID;
                firebaseConfig.appId = process.env.REACT_APP_FIREBASE_APP_ID;
                currentAppId = process.env.REACT_APP_FIREBASE_APP_ID || 'default-app-id';
            } else {
                console.error("Firebase config is missing. Please set environment variables or provide __firebase_config.");
                showAppMessage("Erro: Configuração do Firebase ausente. O aplicativo pode não funcionar corretamente.");
                return;
            }

            // Verifique se a configuração está completa antes de inicializar
            if (!firebaseConfig.apiKey || !firebaseConfig.authDomain) {
                console.error("Firebase config is incomplete. Please check your environment variables.");
                showAppMessage("Erro: Configuração do Firebase incompleta. O aplicativo pode não funcionar corretamente.");
                return;
            }

            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestoreDb);
            setAuth(firebaseAuth);

            // Listener para o estado de autenticação
            const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    // Tenta usar o token inicial, se disponível
                    if (initialAuthToken) {
                        await signInWithCustomToken(firebaseAuth, initialAuthToken);
                    } else {
                        // Caso contrário, faz login anonimamente
                        await signInAnonymously(firebaseAuth);
                    }
                    setUserId(firebaseAuth.currentUser?.uid || crypto.randomUUID()); // Fallback para ID aleatório
                }
                setIsAuthReady(true);
            });

            return () => unsubscribe(); // Limpeza do listener
        } catch (error) {
            console.error("Erro ao inicializar Firebase:", error);
            showAppMessage("Erro ao inicializar o aplicativo. Por favor, tente novamente.");
        }
    }, []);

    // Efeitos para carregar dados do Firestore quando a autenticação estiver pronta
    useEffect(() => {
        if (isAuthReady && userId && db) {
            // Determina o appId a ser usado no Firestore
            const appId = typeof __app_id !== 'undefined' ? __app_id : (typeof process !== 'undefined' && process.env.REACT_APP_FIREBASE_APP_ID ? process.env.REACT_APP_FIREBASE_APP_ID : 'default-app-id');

            const userDrawingsRef = collection(db, `artifacts/${appId}/users/${userId}/drawings`);
            const userLettersRef = collection(db, `artifacts/${appId}/users/${userId}/letters`);
            const userCardsRef = collection(db, `artifacts/${appId}/users/${userId}/cards`);
            const userMoodsRef = collection(db, `artifacts/${appId}/users/${userId}/moods`);
            const userDaysCounterRef = doc(db, `artifacts/${appId}/users/${userId}/daysCounter/data`);
            const userPhotosRef = collection(db, `artifacts/${appId}/users/${userId}/photos`);

            // Carregar desenhos
            const unsubscribeDrawings = onSnapshot(userDrawingsRef, (snapshot) => {
                const loadedDrawings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setDrawings(loadedDrawings);
            }, (error) => console.error("Erro ao carregar desenhos:", error));

            // Carregar cartas
            const unsubscribeLetters = onSnapshot(userLettersRef, (snapshot) => {
                const loadedLetters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setLetters(loadedLetters);
            }, (error) => console.error("Erro ao carregar cartas:", error));

            // Carregar cartões
            const unsubscribeCards = onSnapshot(userCardsRef, (snapshot) => {
                const loadedCards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCards(loadedCards);
            }, (error) => console.error("Erro ao carregar cartões:", error));

            // Carregar humor
            const qMoods = query(userMoodsRef, orderBy('timestamp', 'desc'));
            const unsubscribeMoods = onSnapshot(qMoods, (snapshot) => {
                const loadedMoods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setMoods(loadedMoods);
            }, (error) => console.error("Erro ao carregar humor:", error));

            // Carregar data inicial do contador de dias
            const unsubscribeDaysCounter = onSnapshot(userDaysCounterRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setStartDate(data.startDate || null); // Alterado para setar null se não houver data
                } else {
                    setStartDate(null); // Alterado para setar null
                }
            }, (error) => console.error("Erro ao carregar contador de dias:", error));

            // Carregar fotos
            const unsubscribePhotos = onSnapshot(userPhotosRef, (snapshot) => {
                const loadedPhotos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setPhotos(loadedPhotos);
            }, (error) => console.error("Erro ao carregar fotos:", error));

            return () => {
                unsubscribeDrawings();
                unsubscribeLetters();
                unsubscribeCards();
                unsubscribeMoods();
                unsubscribeDaysCounter();
                unsubscribePhotos();
            };
        }
    }, [isAuthReady, userId, db]);

    // Calcular dias conhecidos sempre que a data inicial mudar
    useEffect(() => {
        if (startDate) {
            const start = new Date(startDate);
            const today = new Date();
            const diffTime = Math.abs(today - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setDaysKnown(diffDays);
        } else {
            setDaysKnown(0);
        }
    }, [startDate]);

    // Simulação de carregamento da agenda de jogos
    useEffect(() => {
        // Esta função simula uma chamada de API para buscar a agenda de jogos.
        // Em um ambiente real, você faria uma requisição HTTP para uma API externa.
        const fetchGameSchedule = () => {
            const today = new Date();
            const nextWeek = new Date(today);
            nextWeek.setDate(today.getDate() + 7);

            const games = [
                {
                    id: 1,
                    date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2).toISOString().split('T')[0], // Daqui a 2 dias
                    time: '19:00',
                    opponent: 'Cruzeiro',
                    location: 'Mineirão',
                    competition: 'Campeonato Brasileiro'
                },
                {
                    id: 2,
                    date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5).toISOString().split('T')[0], // Daqui a 5 dias
                    time: '21:30',
                    opponent: 'Flamengo',
                    location: 'Maracanã',
                    competition: 'Copa do Brasil'
                },
                {
                    id: 3,
                    date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10).toISOString().split('T')[0], // Daqui a 10 dias
                    time: '16:00',
                    opponent: 'Grêmio',
                    location: 'Arena MRV',
                    competition: 'Campeonato Brasileiro'
                }
            ];
            setGameSchedule(games);
        };

        fetchGameSchedule();
        // Você pode adicionar um setInterval para atualizar a cada X tempo em um app real
        // const interval = setInterval(fetchGameSchedule, 3600000); // Atualiza a cada hora
        // return () => clearInterval(interval);
    }, []);

    // Função para exibir mensagens na tela (substitui alert)
    const showAppMessage = (message) => {
        setModalContent(message);
        setShowMessageModal(true);
    };

    // Função para exibir notificações temporárias
    const showTemporaryNotification = (message) => {
        setNotificationMessage(message);
        setShowNotification(true);
        setTimeout(() => {
            setShowNotification(false);
            setNotificationMessage('');
        }, 3000); // Notificação desaparece após 3 segundos
    };

    // Dados dos jogadores do Atlético-MG e Júlia Ayla
    const players = [
        {
            name: "Hulk",
            image: "https://placehold.co/100x100/000000/FFFFFF?text=Hulk",
            message: "Parabéns, Dr. Emanuel! Que sua força e paixão sejam tão grandes quanto as minhas em campo. Não há limites para quem acredita e batalha pelos seus sonhos. Siga em frente com determinação!"
        },
        {
            name: "Rubens",
            image: "https://placehold.co/100x100/000000/FFFFFF?text=Rubens",
            message: "Feliz aniversário, Dr. Emanuel! Que a sua juventude e energia te impulsionem a conquistar cada vez mais. O futuro é seu, acredite e vá em frente!"
        },
        {
            name: "Everson",
            image: "https://placehold.co/100x100/000000/FFFFFF?text=Everson",
            message: "Parabéns, Dr. Emanuel! Que a sua segurança e a sua capacidade de defender seus ideais sejam sempre inabaláveis, assim como minhas defesas. Mantenha o foco!"
        },
        {
            name: "Rony",
            image: "https://placehold.co/100x100/000000/FFFFFF?text=Rony",
            message: "Feliz aniversário, Dr. Emanuel! Que a sua velocidade e agilidade para superar desafios te levem a grandes vitórias. Corra atrás dos seus sonhos!"
        },
        {
            name: "Lyanco",
            image: "https://placehold.co/100x100/000000/FFFFFF?text=Lyanco",
            message: "Parabéns, Dr. Emanuel! Que a sua solidez e determinação sejam a base para todas as suas conquistas. Construa um futuro brilhante!"
        },
        {
            name: "Júlia Ayla",
            image: "https://placehold.co/100x100/FFC0CB/000000?text=Júlia+Ayla", // Cor de rosa para a princesa
            message: "Eu te amo muito, meu amor!"
        },
        {
            name: "Scarpa",
            image: "https://placehold.co/100x100/000000/FFFFFF?text=Scarpa",
            message: "Feliz aniversário, Dr. Emanuel! Que a sua criatividade e o seu talento para inovar te abram muitos caminhos. Ouse sonhar grande!"
        },
        {
            name: "Saraiva",
            image: "https://placehold.co/100x100/000000/FFFFFF?text=Saraiva",
            message: "Parabéns, Dr. Emanuel! Que a sua visão de jogo e a sua capacidade de criar oportunidades te guiem para o sucesso. Enxergue além!"
        },
        {
            name: "Paulinho",
            image: "https://placehold.co/100x100/000000/FFFFFF?text=Paulinho",
            message: "Feliz aniversário, Dr. Emanuel! Que a sua estrela brilhe cada vez mais, e que você continue marcando gols na vida. Siga seu caminho com luz!"
        },
        {
            name: "Zaracho",
            image: "https://placehold.co/100x100/000000/FFFFFF?text=Zaracho",
            message: "Parabéns, Dr. Emanuel! Que a sua versatilidade e a sua paixão pelo que faz te levem a alcançar todos os seus objetivos. Seja completo!"
        },
        {
            name: "Deyverson",
            image: "https://placehold.co/100x100/000000/FFFFFF?text=Deyverson",
            message: "Feliz aniversário, Dr. Emanuel! Que a sua alegria e o seu espírito guerreiro te inspirem a celebrar cada momento e a lutar por cada vitória. Viva intensamente!"
        }
    ];

    // Funções para o modal de jogadores
    const openPlayerModal = (player) => {
        setSelectedPlayer(player);
        setShowPlayerModal(true);
    };

    const closePlayerModal = () => {
        setShowPlayerModal(false);
        setSelectedPlayer(null);
    };

    // Funções para o Estúdio Criativo (Desenhos)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let isDrawing = false;
        let isErasing = false;

        const startDrawing = (e) => {
            isDrawing = true;
            isErasing = (drawingColor === 'eraser'); // Verifica se o modo é borracha
            ctx.beginPath();
            draw(e);
        };

        const stopDrawing = () => {
            isDrawing = false;
            ctx.beginPath();
        };

        const draw = (e) => {
            if (!isDrawing) return;

            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX || e.touches[0].clientX) - rect.left;
            const y = (e.clientY || e.touches[0].clientY) - rect.top;

            ctx.lineWidth = drawingSize;
            ctx.lineCap = 'round';

            if (isErasing) {
                ctx.strokeStyle = '#FFFFFF'; // Cor da borracha (fundo do canvas)
                ctx.globalCompositeOperation = 'destination-out'; // Modo de apagar
            } else {
                ctx.strokeStyle = drawingColor;
                ctx.globalCompositeOperation = 'source-over'; // Modo de desenho normal
            }

            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
        };

        // Event listeners para mouse
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);
        canvas.addEventListener('mousemove', draw);

        // Event listeners para toque
        canvas.addEventListener('touchstart', startDrawing);
        canvas.addEventListener('touchend', stopDrawing);
        canvas.addEventListener('touchcancel', stopDrawing);
        canvas.addEventListener('touchmove', draw);

        return () => {
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('mouseout', stopDrawing);
            canvas.removeEventListener('mousemove', draw);
            canvas.removeEventListener('touchstart', startDrawing);
            canvas.removeEventListener('touchend', stopDrawing);
            canvas.removeEventListener('touchcancel', stopDrawing);
            canvas.removeEventListener('touchmove', draw);
        };
    }, [drawingColor, drawingSize]);

    // Limpar o canvas
    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    // Salvar desenho no Firestore
    const saveDrawing = async () => {
        if (!userId || !db) {
            showAppMessage("Por favor, aguarde a inicialização para salvar.");
            return;
        }
        const canvas = canvasRef.current;
        if (canvas) {
            try {
                const dataUrl = canvas.toDataURL('image/png');
                const appId = typeof __app_id !== 'undefined' ? __app_id : (typeof process !== 'undefined' && process.env.REACT_APP_FIREBASE_APP_ID ? process.env.REACT_APP_FIREBASE_APP_ID : 'default-app-id');
                await addDoc(collection(db, `artifacts/${appId}/users/${userId}/drawings`), {
                    dataUrl: dataUrl,
                    createdAt: serverTimestamp()
                });
                showAppMessage("Desenho salvo com sucesso!");
                clearCanvas(); // Limpa o canvas após salvar
            } catch (error) {
                console.error("Erro ao salvar desenho:", error);
                showAppMessage("Erro ao salvar o desenho. Tente novamente.");
            }
        }
    };

    // Salvar carta no Firestore
    const saveLetter = async () => {
        if (!userId || !db) {
            showAppMessage("Por favor, aguarde a inicialização para salvar.");
            return;
        }
        if (!letterContent.trim()) {
            showAppMessage("A carta não pode estar vazia.");
            return;
        }
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : (typeof process !== 'undefined' && process.env.REACT_APP_FIREBASE_APP_ID ? process.env.REACT_APP_FIREBASE_APP_ID : 'default-app-id');
            await addDoc(collection(db, `artifacts/${appId}/users/${userId}/letters`), {
                content: letterContent,
                createdAt: serverTimestamp()
            });
            showAppMessage("Carta salva com sucesso!");
            setLetterContent(''); // Limpa o conteúdo da carta
        } catch (error) {
            console.error("Erro ao salvar carta:", error);
            showAppMessage("Erro ao salvar a carta. Tente novamente.");
        }
    };

    // Modelos de cartões
    const cardTemplates = [
        { name: "Padrão", text: "", bgColor: "#ffffff" },
        { name: "Galo Doido", text: "Parabéns! Que a paixão pelo Galo te inspire sempre!", bgColor: "#fcd34d" }, // Amarelo do Galo
        { name: "Manto Sagrado", text: "Feliz Aniversário! Que a glória alvinegra esteja sempre com você!", bgColor: "#000000" },
        { name: "Campo", text: "Que sua vida seja um campo de vitórias! Feliz Aniversário!", bgColor: "#34d399" } // Verde
    ];

    // Salvar cartão no Firestore
    const saveCard = async () => {
        if (!userId || !db) {
            showAppMessage("Por favor, aguarde a inicialização para salvar.");
            return;
        }
        if (!cardText.trim()) {
            showAppMessage("O cartão não pode estar vazio.");
            return;
        }
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : (typeof process !== 'undefined' && process.env.REACT_APP_FIREBASE_APP_ID ? process.env.REACT_APP_FIREBASE_APP_ID : 'default-app-id');
            await addDoc(collection(db, `artifacts/${appId}/users/${userId}/cards`), {
                text: cardText,
                bgColor: cardBgColor,
                createdAt: serverTimestamp()
            });
            showAppMessage("Cartão salvo com sucesso!");
            setCardText(''); // Limpa o conteúdo do cartão
            setCardBgColor('#ffffff'); // Reseta a cor de fundo
        } catch (error) {
            console.error("Erro ao salvar cartão:", error);
            showAppMessage("Erro ao salvar o cartão. Tente novamente.");
        }
    };

    // Aplicar modelo de cartão
    const applyCardTemplate = (template) => {
        setCardText(template.text);
        setCardBgColor(template.bgColor);
    };

    // Registrar humor no Firestore
    const recordMood = async (mood) => {
        if (!userId || !db) {
            showAppMessage("Por favor, aguarde a inicialização para registrar o humor.");
            return;
        }
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : (typeof process !== 'undefined' && process.env.REACT_APP_FIREBASE_APP_ID ? process.env.REACT_APP_FIREBASE_APP_ID : 'default-app-id');
            await addDoc(collection(db, `artifacts/${appId}/users/${userId}/moods`), {
                mood: mood,
                timestamp: serverTimestamp()
            });
            setCurrentMood(mood);
            showAppMessage(`Humor registrado: ${mood}`);
        } catch (error) {
            console.error("Erro ao registrar humor:", error);
            showAppMessage("Erro ao registrar o humor. Tente novamente.");
        }
    };

    // Salvar data inicial do contador de dias no Firestore
    const saveStartDate = async () => {
        if (!userId || !db) {
            showAppMessage("Por favor, aguarde a inicialização para salvar a data.");
            return;
        }
        if (!startDate) {
            showAppMessage("Por favor, selecione uma data.");
            return;
        }
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : (typeof process !== 'undefined' && process.env.REACT_APP_FIREBASE_APP_ID ? process.env.REACT_APP_FIREBASE_APP_ID : 'default-app-id');
            await setDoc(doc(db, `artifacts/${appId}/users/${userId}/daysCounter/data`), {
                startDate: startDate
            });
            showAppMessage("Data inicial salva com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar data inicial:", error);
            showAppMessage("Erro ao salvar a data inicial. Tente novamente.");
        }
    };

    // Adicionar foto à galeria
    const handlePhotoUpload = async (event) => {
        if (!userId || !db) {
            showAppMessage("Por favor, aguarde a inicialização para fazer upload de fotos.");
            return;
        }
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                try {
                    const appId = typeof __app_id !== 'undefined' ? __app_id : (typeof process !== 'undefined' && process.env.REACT_APP_FIREBASE_APP_ID ? process.env.REACT_APP_FIREBASE_APP_ID : 'default-app-id');
                    await addDoc(collection(db, `artifacts/${appId}/users/${userId}/photos`), {
                        dataUrl: reader.result, // Armazena a imagem como base64
                        createdAt: serverTimestamp()
                    });
                    showAppMessage("Foto adicionada à galeria!");
                } catch (error) {
                    console.error("Erro ao adicionar foto:", error);
                    showAppMessage("Erro ao adicionar a foto. Tente novamente.");
                }
            };
            reader.readAsDataURL(file);
        }
    };

    // Componente de Mensagem Modal (substitui alert)
    const MessageModal = ({ message, onClose }) => {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
                    <p className="text-lg font-semibold mb-4 text-gray-800">{message}</p>
                    <button
                        onClick={onClose}
                        className="bg-gray-800 text-white px-6 py-2 rounded-full hover:bg-gray-700 transition duration-300 shadow-md"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        );
    };

    // Componente de Notificação Temporária
    const NotificationBanner = ({ message, show }) => {
        return (
            <div className={`fixed top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-transform duration-500 ${show ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
                {message}
            </div>
        );
    };

    // Renderização das páginas
    const renderPage = () => {
        switch (currentPage) {
            case 'home':
                return (
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Uma Celebração Alvinegra!</h2>
                        <p className="text-lg md:text-xl text-gray-200 mb-8 max-w-2xl">
                            Bem-vindo ao <span className="font-extrabold text-white">Dr. Emanuel's Wonderland</span>!
                            Preparamos um lugar especial para celebrar você, suas conquistas e tudo o que você representa para nós.
                            Que este dia seja tão especial quanto você, cheio de alegria e emoções alvinegras! Aqui, a paixão pelo Galo
                            se encontra com a celebração da sua vida.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                            {players.map((player, index) => (
                                <div
                                    key={index}
                                    className="bg-white rounded-xl shadow-lg p-4 flex flex-col items-center cursor-pointer transform hover:scale-105 transition duration-300 border-2 border-gray-200 hover:border-black"
                                    onClick={() => openPlayerModal(player)}
                                >
                                    <img src={player.image} alt={player.name} className="w-24 h-24 rounded-full mb-3 object-cover border-4 border-gray-300" />
                                    <p className="text-lg font-semibold text-gray-800">{player.name}</p>
                                    <span className="text-sm text-gray-500 mt-1">Clique para mensagem</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'creativeStudio':
                return (
                    <div className="p-6">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">Estúdio Criativo: Seu Santuário Pessoal</h2>

                        {/* Seção de Desenho */}
                        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border-2 border-gray-200">
                            <h3 className="text-2xl font-semibold text-gray-800 mb-4">Galeria de Desenhos da Massa</h3>
                            <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-4">
                                <label htmlFor="drawingColor" className="font-medium text-gray-700">Cor:</label>
                                <input
                                    type="color"
                                    id="drawingColor"
                                    value={drawingColor === 'eraser' ? '#000000' : drawingColor} // Mostra preto no seletor de cor se for borracha
                                    onChange={(e) => setDrawingColor(e.target.value)}
                                    className="rounded-md h-10 w-10 cursor-pointer"
                                />
                                <label htmlFor="drawingSize" className="font-medium text-gray-700">Tamanho:</label>
                                <input
                                    type="range"
                                    id="drawingSize"
                                    min="1"
                                    max="20"
                                    value={drawingSize}
                                    onChange={(e) => setDrawingSize(parseInt(e.target.value))}
                                    className="w-32"
                                />
                                <span className="text-gray-700">{drawingSize}px</span>
                            </div>
                            <div className="flex justify-center gap-4 mb-4">
                                <button
                                    onClick={() => setDrawingColor('eraser')}
                                    className="bg-gray-500 text-white px-6 py-2 rounded-full hover:bg-gray-600 transition duration-300 shadow-md"
                                >
                                    Borracha
                                </button>
                            </div>
                            <canvas
                                ref={canvasRef}
                                width="600"
                                height="400"
                                className="border-2 border-gray-300 rounded-lg bg-white w-full max-w-full h-auto"
                                style={{ touchAction: 'none' }} // Previne o scroll da página ao desenhar
                            ></canvas>
                            <div className="flex justify-center gap-4 mt-4">
                                <button
                                    onClick={saveDrawing}
                                    className="bg-green-600 text-white px-6 py-2 rounded-full hover:bg-green-700 transition duration-300 shadow-md"
                                >
                                    Salvar Desenho
                                </button>
                                <button
                                    onClick={clearCanvas}
                                    className="bg-red-600 text-white px-6 py-2 rounded-full hover:bg-red-700 transition duration-300 shadow-md"
                                >
                                    Limpar
                                </button>
                            </div>
                            <div className="mt-6">
                                <h4 className="text-xl font-semibold text-gray-700 mb-3">Seus Desenhos Salvos:</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {drawings.length > 0 ? (
                                        drawings.map((drawing) => (
                                            <div key={drawing.id} className="border border-gray-200 rounded-lg p-2 flex justify-center items-center bg-gray-50">
                                                <img src={drawing.dataUrl} alt="Desenho Salvo" className="max-w-full h-auto rounded-md" />
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 col-span-full">Nenhum desenho salvo ainda.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Seção de Cartas */}
                        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border-2 border-gray-200">
                            <h3 className="text-2xl font-semibold text-gray-800 mb-4">Carta ao Galo / Dr. Emanuel</h3>
                            <textarea
                                value={letterContent}
                                onChange={(e) => setLetterContent(e.target.value)}
                                placeholder="Escreva sua mensagem especial aqui..."
                                rows="8"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-y"
                                maxLength="1000" // Limite de caracteres
                            ></textarea>
                            <p className="text-sm text-gray-500 text-right mt-1">{letterContent.length}/1000 caracteres</p>
                            <div className="flex justify-center mt-4">
                                <button
                                    onClick={saveLetter}
                                    className="bg-black text-white px-6 py-2 rounded-full hover:bg-gray-800 transition duration-300 shadow-md"
                                >
                                    Salvar Carta
                                </button>
                            </div>
                            <div className="mt-6">
                                <h4 className="text-xl font-semibold text-gray-700 mb-3">Suas Cartas Salvas:</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {letters.length > 0 ? (
                                        letters.map((letter) => (
                                            <div key={letter.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                                <p className="text-gray-800 whitespace-pre-wrap">{letter.content}</p>
                                                <p className="text-xs text-gray-500 mt-2">Salvo em: {new Date(letter.createdAt?.toDate()).toLocaleString()}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500">Nenhuma carta salva ainda.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Seção de Cartões */}
                        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border-2 border-gray-200">
                            <h3 className="text-2xl font-semibold text-gray-800 mb-4">Crie seu Cartão Alvinegro</h3>
                            <div className="mb-4">
                                <label htmlFor="cardText" className="block text-gray-700 font-medium mb-2">Mensagem do Cartão:</label>
                                <textarea
                                    value={cardText}
                                    onChange={(e) => setCardText(e.target.value)}
                                    placeholder="Escreva a mensagem do seu cartão aqui..."
                                    rows="4"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-y"
                                ></textarea>
                            </div>
                            <div className="mb-4 flex items-center gap-4">
                                <label htmlFor="cardBgColor" className="text-gray-700 font-medium">Cor de Fundo:</label>
                                <input
                                    type="color"
                                    id="cardBgColor"
                                    value={cardBgColor}
                                    onChange={(e) => setCardBgColor(e.target.value)}
                                    className="rounded-md h-10 w-10 cursor-pointer"
                                />
                            </div>
                            <div className="mb-4">
                                <h4 className="text-lg font-medium text-gray-700 mb-2">Modelos:</h4>
                                <div className="flex flex-wrap gap-3 justify-center">
                                    {cardTemplates.map((template, index) => (
                                        <button
                                            key={index}
                                            onClick={() => applyCardTemplate(template)}
                                            className="px-4 py-2 rounded-full text-sm font-semibold shadow-md transition duration-300"
                                            style={{ backgroundColor: template.bgColor, color: '#000000', border: '1px solid #ccc' }} // Força texto preto
                                        >
                                            {template.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-center mt-4">
                                <button
                                    onClick={saveCard}
                                    className="bg-black text-white px-6 py-2 rounded-full hover:bg-gray-800 transition duration-300 shadow-md"
                                >
                                    Salvar Cartão
                                </button>
                            </div>
                            <div className="mt-6">
                                <h4 className="text-xl font-semibold text-gray-700 mb-3">Seus Cartões Salvos:</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {cards.length > 0 ? (
                                        cards.map((card) => (
                                            <div key={card.id}
                                                className="border border-gray-200 rounded-lg p-4 flex flex-col items-center justify-center text-center shadow-sm"
                                                style={{ backgroundColor: card.bgColor, minHeight: '150px', color: '#000000' }} // Força texto preto
                                            >
                                                <p className="font-medium">{card.text}</p>
                                                <p className="text-xs text-gray-500 mt-2">Salvo em: {new Date(card.createdAt?.toDate()).toLocaleString()}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 col-span-full">Nenhum cartão salvo ainda.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'moodTracker':
                return (
                    <div className="p-6 text-center">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">Meu Termômetro de Humor Alvinegro</h2>
                        <p className="text-lg text-gray-200 mb-6">Como você está se sentindo hoje, torcedor?</p>
                        <div className="flex justify-center gap-4 mb-8 flex-wrap">
                            <button onClick={() => recordMood('Feliz')} className="text-5xl p-3 rounded-full bg-yellow-300 hover:bg-yellow-400 transition transform hover:scale-110 shadow-md">😊</button>
                            <button onClick={() => recordMood('Neutro')} className="text-5xl p-3 rounded-full bg-gray-300 hover:bg-gray-400 transition transform hover:scale-110 shadow-md">😐</button>
                            <button onClick={() => recordMood('Triste')} className="text-5xl p-3 rounded-full bg-blue-300 hover:bg-blue-400 transition transform hover:scale-110 shadow-md">😔</button>
                            <button onClick={() => recordMood('Animado')} className="text-5xl p-3 rounded-full bg-green-300 hover:bg-green-400 transition transform hover:scale-110 shadow-md">🤩</button>
                            <button onClick={() => recordMood('Bravo')} className="text-5xl p-3 rounded-full bg-red-300 hover:bg-red-400 transition transform hover:scale-110 shadow-md">😠</button>
                        </div>
                        {currentMood && (
                            <p className="text-xl font-semibold text-gray-200 mb-6">Seu humor atual: {currentMood}</p>
                        )}
                        <h3 className="text-2xl font-semibold text-white mb-4">Histórico de Humor:</h3>
                        <div className="bg-white rounded-xl shadow-lg p-6 max-w-xl mx-auto border-2 border-gray-200">
                            {moods.length > 0 ? (
                                <ul className="list-disc list-inside text-left text-gray-700">
                                    {moods.map((moodEntry) => (
                                        <li key={moodEntry.id} className="mb-2">
                                            {moodEntry.mood} - {new Date(moodEntry.timestamp?.toDate()).toLocaleString()}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500">Nenhum humor registrado ainda.</p>
                            )}
                        </div>
                    </div>
                );
            case 'daysCounter':
                return (
                    <div className="p-6 text-center">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">Contagem Regressiva dos Nossos Dias</h2>
                        <p className="text-lg text-gray-200 mb-6">Quantos dias se passaram desde que nos conhecemos?</p>
                        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto border-2 border-gray-200">
                            <label htmlFor="startDate" className="block text-gray-700 font-medium mb-2">Selecione a data que nos conhecemos:</label>
                            <input
                                type="date"
                                id="startDate"
                                value={startDate || ''} // Garante que o valor é sempre uma string
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black mb-4"
                            />
                            <button
                                onClick={saveStartDate}
                                className="bg-black text-white px-6 py-2 rounded-full hover:bg-gray-800 transition duration-300 shadow-md"
                                >
                                Salvar Data
                            </button>
                            {daysKnown > 0 && (
                                <p className="text-2xl font-bold text-gray-800 mt-6">
                                    Já se passaram <span className="text-black">{daysKnown}</span> dias! 🎉
                                </p>
                            )}
                            {startDate && daysKnown === 0 && (
                                <p className="text-xl text-gray-600 mt-6">
                                    Selecione uma data no passado para ver a contagem.
                                </p>
                            )}
                        </div>
                    </div>
                );
            case 'gameSchedule':
                return (
                    <div className="p-6 text-center">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">Agenda de Jogos do Atlético-MG</h2>
                        <p className="text-lg text-gray-200 mb-6">Fique por dentro dos próximos jogos do Galo!</p>
                        <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto border-2 border-gray-200">
                            {gameSchedule.length > 0 ? (
                                <ul className="divide-y divide-gray-200">
                                    {gameSchedule.map((game) => (
                                        <li key={game.id} className="py-4 flex flex-col sm:flex-row items-center justify-between">
                                            <div className="text-left mb-2 sm:mb-0">
                                                <p className="text-xl font-semibold text-gray-800">{game.opponent} vs Atlético-MG</p>
                                                <p className="text-gray-600">{new Date(game.date).toLocaleDateString('pt-BR')} - {game.time}</p>
                                                <p className="text-sm text-gray-500">{game.competition} - {game.location}</p>
                                            </div>
                                            <button
                                                onClick={() => showTemporaryNotification(`Lembrete: Jogo do Galo contra ${game.opponent} em ${new Date(game.date).toLocaleDateString('pt-BR')}!`)}
                                                className="bg-black text-white px-4 py-2 rounded-full hover:bg-gray-800 transition duration-300 shadow-md text-sm"
                                            >
                                                Notificar-me
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500">Nenhum jogo agendado no momento. Volte em breve!</p>
                            )}
                        </div>
                    </div>
                );
            case 'photoGallery':
                return (
                    <div className="p-6 text-center">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">Galeria de Fotos: Nosso Memorial</h2>
                        <p className="text-lg text-gray-200 mb-6">Anexe suas fotos especiais e crie um memorial de momentos inesquecíveis!</p>
                        <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto mb-8 border-2 border-gray-200">
                            <label htmlFor="photoUpload" className="block text-gray-700 font-medium mb-2">Adicionar nova foto:</label>
                            <input
                                type="file"
                                id="photoUpload"
                                accept="image/*"
                                onChange={handlePhotoUpload}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black mb-4"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {photos.length > 0 ? (
                                photos.map((photo) => (
                                    <div key={photo.id} className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-200">
                                        <img src={photo.dataUrl} alt="Foto do Memorial" className="w-full h-48 object-cover rounded-t-xl" />
                                        <p className="text-sm text-gray-500 p-3 text-right">Adicionado em: {new Date(photo.createdAt?.toDate()).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 col-span-full">Nenhuma foto no memorial ainda. Adicione a primeira!</p>
                            )}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-black font-inter flex flex-col" style={{
            backgroundImage: `url('https://i.imgur.com/your-galo-wallpaper.png')`, // Substitua por uma URL real do papel de parede do Galo
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed'
        }}>
            {/* Cabeçalho */}
            <header className="bg-gradient-to-r from-black to-gray-900 text-white p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between">
                <div className="flex items-center mb-4 sm:mb-0">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Escudo_do_Clube_Atl%C3%A9tico_Mineiro.svg/1200px-Escudo_do_Clube_Atl%C3%A9tico_Mineiro.svg.png" alt="Escudo Atlético-MG" className="h-12 w-12 mr-3 rounded-full border-2 border-white" />
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-wide">Dr. Emanuel's Wonderland</h1>
                        {userId && <p className="text-xs text-gray-400">ID do Usuário: {userId}</p>}
                    </div>
                </div>
                <nav className="flex flex-wrap justify-center gap-3">
                    <button onClick={() => setCurrentPage('home')} className="nav-button">Início</button>
                    <button onClick={() => setCurrentPage('creativeStudio')} className="nav-button">Estúdio Criativo</button>
                    <button onClick={() => setCurrentPage('moodTracker')} className="nav-button">Humor</button>
                    <button onClick={() => setCurrentPage('daysCounter')} className="nav-button">Contador de Dias</button>
                    <button onClick={() => setCurrentPage('gameSchedule')} className="nav-button">Agenda de Jogos</button>
                    <button onClick={() => setCurrentPage('photoGallery')} className="nav-button">Galeria de Fotos</button>
                </nav>
            </header>

            {/* Conteúdo Principal */}
            <main className="flex-grow container mx-auto p-4 py-8 bg-gray-900 text-white rounded-lg shadow-xl my-4">
                {renderPage()}
            </main>

            {/* Rodapé */}
            <footer className="bg-black text-white p-4 text-center text-sm shadow-inner mt-auto">
                <p>&copy; {new Date().getFullYear()} Dr. Emanuel's Wonderland. Todos os direitos reservados. Feito com carinho e paixão pelo Galo!</p>
            </footer>

            {/* Modal para mensagens de jogadores */}
            {showPlayerModal && selectedPlayer && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full text-center transform scale-95 animate-fade-in-up">
                        <img src={selectedPlayer.image} alt={selectedPlayer.name} className="w-28 h-28 rounded-full mx-auto mb-5 object-cover border-4 border-black" />
                        <h3 className="text-2xl font-bold text-gray-900 mb-3">{selectedPlayer.name}</h3>
                        <p className="text-lg text-gray-700 leading-relaxed mb-6">{selectedPlayer.message}</p>
                        <button
                            onClick={closePlayerModal}
                            className="bg-black text-white px-8 py-3 rounded-full hover:bg-gray-800 transition duration-300 shadow-lg font-semibold text-lg"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}

            {/* Modal de Mensagem Geral */}
            {showMessageModal && (
                <MessageModal message={modalContent} onClose={() => setShowMessageModal(false)} />
            )}

            {/* Notificação Temporária */}
            <NotificationBanner message={notificationMessage} show={showNotification} />

            {/* Estilos Tailwind customizados */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap');

                body {
                    font-family: 'Inter', sans-serif;
                }

                .nav-button {
                    @apply bg-white text-black px-5 py-2 rounded-full font-semibold hover:bg-gray-200 transition duration-300 shadow-md;
                }

                /* Animação para o modal */
                .animate-fade-in-up {
                    animation: fadeInScaleUp 0.3s ease-out forwards;
                }

                @keyframes fadeInScaleUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `}</style>
        </div>
    );
};

export default App;