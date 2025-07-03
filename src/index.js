import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Importa o componente principal da sua aplicação

// Cria uma raiz de renderização para o React no elemento com id 'root'
const root = ReactDOM.createRoot(document.getElementById('root'));

// Renderiza o componente App dentro do StrictMode do React
// StrictMode ajuda a identificar problemas potenciais na aplicação durante o desenvolvimento
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);