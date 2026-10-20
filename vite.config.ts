import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { aiProxyPlugin } from './server/aiProxy.ts';

/**
 * Battement tourne sur le port 5186 : 5183 = Séquence, 5184 = Portée,
 * 5185 = la vitrine Craftline.
 *
 * `base: './'` garde le build portable (GitHub Pages de projet, dépôt statique,
 * sous-dossier) : le routeur lit `import.meta.env.BASE_URL`.
 */
export default defineConfig({
  base: './',
  plugins: [react(), aiProxyPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5186,
  },
  preview: {
    host: '127.0.0.1',
    port: 5186,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
