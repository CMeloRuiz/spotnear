/**
 * Aplicación Express.
 *
 * Se exporta la app sin levantar el servidor para que los tests de integración
 * puedan montarla con supertest sin ocupar un puerto.
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';

import env from './config/env.js';
import apiRouter from './modules/index.js';
import { manejadorDeErrores, noEncontrado } from './middleware/error.js';
import { limiteGeneral } from './middleware/rateLimit.js';
import { documentoOpenAPI } from './docs/openapi.js';
import { DIR_UPLOADS } from './services/uploads.js';

export function crearApp() {
  const app = express();

  // Detrás de un proxy (Render, Railway, Nginx) para que req.ip sea la IP real.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // ── Seguridad ──
  app.use(
    helmet({
      // La API sirve JSON; la CSP restrictiva rompería Swagger UI.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Sin origin: curl, Postman, apps móviles nativas. Se permiten.
        if (!origin) return callback(null, true);
        if (env.corsOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`El origen ${origin} no está autorizado por CORS.`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );

  // ── Parseo ──
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // ── Logs ──
  if (!env.isTest) {
    app.use(morgan(env.isDev ? 'dev' : 'combined'));
  }

  // ── Límite de tasa general ──
  app.use('/api', limiteGeneral);

  // ── Archivos subidos ──
  // Las fotos de los estacionamientos viven en backend/uploads y se sirven
  // desde acá. Van con nosniff y sin index para que un archivo que se haya
  // colado disfrazado de imagen no se pueda ejecutar ni listar la carpeta.
  app.use(
    '/uploads',
    express.static(DIR_UPLOADS, {
      index: false,
      dotfiles: 'ignore',
      maxAge: '7d',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      },
    }),
  );

  // ── Documentación ──
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(documentoOpenAPI, {
      customSiteTitle: 'SpotNear · API',
      swaggerOptions: { persistAuthorization: true },
    }),
  );
  app.get('/api/openapi.json', (req, res) => res.json(documentoOpenAPI));

  // ── API ──
  app.use('/api/v1', apiRouter);

  // Raíz: orientación rápida para quien entra de casualidad.
  app.get('/', (req, res) => {
    res.json({
      servicio: 'SpotNear API',
      empresa: 'ColdevIA',
      documentacion: `${env.PUBLIC_API_URL}/api/docs`,
      health: `${env.PUBLIC_API_URL}/api/v1/health`,
    });
  });

  // ── Errores ──
  app.use(noEncontrado);
  app.use(manejadorDeErrores);

  return app;
}

export default crearApp;
