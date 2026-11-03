import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { PROJECT_STORAGE_KEY } from './src/domain/local-project-store.js';
import { ASSET_REVISIONS } from './src/domain/asset-revisions.js';
import { loadPerformancePlugin } from './tools/static-delivery.mjs';

// Tauri sets this before it starts Vite. The web dev server and Playwright
// keep their own host and port.
const desktopDev = Boolean(globalThis.process?.env?.TAURI_ENV_PLATFORM);

export default defineConfig({
  clearScreen: !desktopDev,
  plugins: [
    react(),
    loadPerformancePlugin({ storageKey: PROJECT_STORAGE_KEY, revisions: ASSET_REVISIONS }),
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          // three.js changes far less often than our 3D code, so keep it in
          // its own long-cached chunk; redeploys then only refetch app code.
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }],
        },
      },
    },
  },
  server: {
    ...(desktopDev ? { host: '127.0.0.1', port: 5173, strictPort: true } : {}),
    watch: {
      ignored: ['**/src-tauri/**'],
    },
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
