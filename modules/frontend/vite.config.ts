import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/graphql': {
        target: 'http://localhost:19323',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:19323',
        changeOrigin: true,
      },
      '/graphiql': {
        target: 'http://localhost:19323',
        changeOrigin: true,
      },
    },
  },
});
