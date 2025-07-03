# Dr. Emanuel's Wonderland - Página de Aniversário do Atlético-MG

Este é um aplicativo web interativo criado para celebrar o aniversário do Dr. Emanuel, combinando a paixão pelo Clube Atlético Mineiro com funcionalidades personalizadas.

## Funcionalidades

- **Mensagens de Jogadores:** Receba mensagens de parabéns de jogadores do Atlético-MG e da Júlia Ayla.
- **Estúdio Criativo:** Desenhe, escreva cartas e crie cartões personalizados.
- **Rastreador de Humor:** Registre seu humor diário.
- **Contador de Dias:** Conte os dias desde uma data especial.
- **Agenda de Jogos:** Fique por dentro dos próximos jogos do Galo.
- **Galeria de Fotos:** Crie um memorial de fotos especiais.

## Tecnologias Utilizadas

- **React:** Biblioteca JavaScript para construção de interfaces de usuário.
- **Tailwind CSS:** Framework CSS utilitário para estilização rápida e responsiva.
- **Firebase (Firestore e Auth):** Para armazenamento de dados em tempo real e autenticação de usuários.

## Como Rodar Localmente

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/seu-usuario/dr-emanuels-wonderland-app.git](https://github.com/seu-usuario/dr-emanuels-wonderland-app.git)
    cd dr-emanuels-wonderland-app
    ```
2.  **Instale as dependências:**
    ```bash
    npm install
    ```
3.  **Configure o Firebase:**
    * Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
    * Crie um aplicativo web no seu projeto Firebase e copie as configurações (`apiKey`, `authDomain`, `projectId`, etc.).
    * Crie um arquivo `.env` na raiz do projeto (na mesma pasta do `package.json`) e adicione suas credenciais do Firebase, **prefixando-as com `REACT_APP_`**:
        ```
        REACT_APP_FIREBASE_API_KEY="SUA_API_KEY"
        REACT_APP_FIREBASE_AUTH_DOMAIN="SEU_AUTH_DOMAIN"
        REACT_APP_FIREBASE_PROJECT_ID="SEU_PROJECT_ID"
        REACT_APP_FIREBASE_STORAGE_BUCKET="SEU_STORAGE_BUCKET"
        REACT_APP_FIREBASE_MESSAGING_SENDER_ID="SEU_MESSAGING_SENDER_ID"
        REACT_APP_FIREBASE_APP_ID="SEU_APP_ID"
        ```
    * **Importante:** Não compartilhe seu arquivo `.env` publicamente (ele já está no `.gitignore`).
4.  **Inicie o aplicativo:**
    ```bash
    npm start
    ```
    O aplicativo será aberto em `http://localhost:3000` (ou outra porta disponível).

## Deploy no Vercel

Este projeto está configurado para ser facilmente deployado no Vercel.

1.  **Crie um repositório no GitHub** (se ainda não o fez) e envie este código para lá.
2.  **Vá para [Vercel](https://vercel.com/)** e faça login.
3.  **Crie um "New Project"** e importe seu repositório do GitHub.
4.  **Configure as variáveis de ambiente** no Vercel (em "Project Settings" -> "Environment Variables") com as mesmas credenciais do Firebase que você usou no seu arquivo `.env` local, **mantendo os prefixos `REACT_APP_`**.
5.  Clique em **"Deploy"**. O Vercel detectará automaticamente a configuração do React e fará o build e o deploy do seu site.

---