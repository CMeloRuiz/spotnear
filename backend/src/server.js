/**
 * Punto de entrada del servidor.
 */
import env from './config/env.js';
import { crearApp } from './app.js';
import { conectarBase, desconectarBase } from './config/prisma.js';

const app = crearApp();

async function arrancar() {
  try {
    await conectarBase();
    console.info('✔ Base de datos conectada');
  } catch (error) {
    console.error('\n✖ No se pudo conectar a la base de datos.');
    console.error('  ' + error.message);
    console.error('\n  Revisá DATABASE_URL en backend/.env y que la base esté levantada.');
    console.error('  Después corré:  npm run db:migrate\n');
    process.exit(1);
  }

  const servidor = app.listen(env.PORT, () => {
    console.info(
      [
        '',
        '  🅿️  SpotNear API',
        `     Entorno:  ${env.NODE_ENV}`,
        `     Puerto:   ${env.PORT}`,
        `     Zona:     ${env.TZ}`,
        `     Docs:     ${env.PUBLIC_API_URL}/api/docs`,
        `     Health:   ${env.PUBLIC_API_URL}/api/v1/health`,
        `     Email:    ${env.resendHabilitado ? 'Resend' : env.smtpHabilitado ? 'SMTP' : 'SIMULADO (cargá RESEND_API_KEY o SMTP_* para enviar de verdad)'}`,
        `     WhatsApp: ${env.whatsappCloudHabilitado ? 'Cloud API' : 'links wa.me'}`,
        '',
      ].join('\n'),
    );
  });

  /** Apagado ordenado: se deja de aceptar conexiones y se cierra Prisma. */
  const apagar = async (senal) => {
    console.info(`\n${senal} recibido, cerrando...`);
    servidor.close(async () => {
      await desconectarBase();
      process.exit(0);
    });
    // Si en 10 segundos no cerró solo, se fuerza.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => apagar('SIGTERM'));
  process.on('SIGINT', () => apagar('SIGINT'));
}

process.on('unhandledRejection', (razon) => {
  console.error('[promesa sin manejar]', razon);
});

arrancar();
