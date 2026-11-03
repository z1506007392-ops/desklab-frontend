import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tauri sets this before it starts Vite. The web dev server and Playwright
// keep their own host and port.
const desktopDev = Boolean(globalThis.process?.env?.TAURI_ENV_PLATFORM);

export default defineConfig({
  clearScreen: !desktopDev,
  plugins: [react()],
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
