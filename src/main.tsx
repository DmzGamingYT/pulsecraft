import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Élément #root introuvable');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// La coquille de l'application est mise en cache après le chargement : le
// journal et l'interface s'ouvrent alors sans réseau. En développement, le
// service worker est ignoré pour ne pas servir un bundle périmé à HMR.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => undefined);
  });
}
