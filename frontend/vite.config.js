import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  // Al compilar en Render (que define RENDER=true), la URL de la API tiene que
  // estar cargada y no ser localhost. Las VITE_* quedan grabadas en el build:
  // sin este freno, el sitio se publicaría "bien" pero llamando a localhost, y
  // nada funcionaría. Fuera de Render (tu build local) no se exige nada.
  if (command === 'build' && process.env.RENDER) {
    const api = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL ?? '';
    if (!api || /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(api)) {
      throw new Error(
        'VITE_API_URL no está cargada o apunta a localhost. En Render → spotnear-frontend → ' +
          'Environment poné la URL pública del backend terminada en /api/v1 ' +
          '(ej. https://spotnear-backend.onrender.com/api/v1) y volvé a desplegar.',
      );
    }
  }

  return {
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
  };
});
