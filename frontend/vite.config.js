import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // El frontend habla con la API por VITE_API_URL. El proxy está acá para
    // poder usar rutas relativas (/api/...) en desarrollo si hiciera falta.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Se separa el vendor para que un cambio en el código de la app
        // no invalide la caché de React y el resto de las dependencias.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          mapas: ['@vis.gl/react-google-maps'],
        },
      },
    },
  },
});
