import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initCore } from './lib/core';
import './styles.css';

// Le noyau Rust se charge en parallèle du rendu : les formules JavaScript
// prennent le relais pendant ce temps, sans bloquer l'interface.
void initCore();

const container = document.getElementById('root');
if (!container) throw new Error('Élément #root introuvable');

createRoot(container).render(
  <ErrorBoundary>
    <HashRouter>
      <App />
    </HashRouter>
  </ErrorBoundary>
);
