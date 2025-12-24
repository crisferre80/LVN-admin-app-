import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/banana': {
        target: 'https://api.banana.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/banana/, ''),
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', () => {
            console.log('Sending Request to Banana API');
          });
          proxy.on('proxyRes', (proxyRes) => {
            console.log('Received Response from Banana API:', proxyRes.statusCode);
          });
        },
      },
    },
  },
});
