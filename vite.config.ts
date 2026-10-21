import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Battement tourne sur le port 5186 : 5187 = Feuillet, 5189 = vitrine.
 * En production, Battement est servi dans /pulsecraft/.
 *
 * `base: './'` garde le build portable (dépôt statique, sous-dossier) : le
 * routeur lit `import.meta.env.BASE_URL`.
 */
export default defineConfig({
  base: './',
  plugins: [react()],
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
