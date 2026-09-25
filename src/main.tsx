import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, MemoryRouter } from 'react-router-dom';
import App from './App';
import { EMBEDDED } from './components/AppLink';
import ErrorBoundary from './components/ErrorBoundary';
import { StoreProvider } from './store';
import './styles.css';

const Router = EMBEDDED ? MemoryRouter : HashRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <Router>
          <App />
        </Router>
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>,
);
