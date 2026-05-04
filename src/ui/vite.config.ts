import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src/ui',
  build: {
    outDir: '../../dist/ui',
    emptyOutDir: true,
  },
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/published': {
        target: 'http://localhost:8080',
        changeOrigin: false,
        // Force Vite to proxy this path even when the URL has a file extension
        bypass: (req) => (req.url?.startsWith('/published/') ? null : undefined),
      },
    },
  },
});
