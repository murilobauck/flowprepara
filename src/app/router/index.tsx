// Função utilitária para criar o roteador baseado no histórico do navegador
import { createBrowserRouter } from 'react-router-dom';

// Importação das páginas da aplicação
import { Home } from '@/pages/Home';
import { Game } from '@/pages/Game';
import { Terms, Privacy } from '@/pages/Legal';

// Configuração central de todas as rotas do site
// Define qual componente será renderizado para cada URL (path)
export const router = createBrowserRouter([
  {
    path: '/', // Rota raiz (Landing Page)
    element: <Home />,
  },
  {
    path: '/game', // Rota do Mini-Game Desafio Flow
    element: <Game />,
  },
  {
    path: '/termos', // Rota para os Termos de Uso
    element: <Terms />,
  },
  {
    path: '/privacidade', // Rota para a Política de Privacidade
    element: <Privacy />,
  },
], {
  basename: import.meta.env.BASE_URL,
});
