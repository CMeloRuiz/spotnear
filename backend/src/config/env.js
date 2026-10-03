/**
 * Carga y valida las variables de entorno en un único lugar.
 * Si falta algo crítico, el proceso no arranca (mejor fallar temprano y claro).
 */
import 'dotenv/config';
import { z } from 'zod';

const booleanish = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET debe tener al menos 16 caracteres'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  PUBLIC_WEB_URL: z.string().url().default('http://localhost:5173'),
  PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),

  COMISION_DEFAULT_PORCENTAJE: z.coerce.number().min(0).max(100).default(10),
  TZ: z.string().default('America/Argentina/Buenos_Aires'),
  MONEDA: z.string().default('ARS'),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: booleanish,
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().default('SpotNear <reservas@spotnear.com.ar>'),
  // Alternativa a SMTP: una sola API key, sin servidor de correo.
  RESEND_API_KEY: z.string().optional().default(''),

  WHATSAPP_PROVIDER: z.enum(['link', 'twilio', 'cloud_api']).default('link'),
  // Twilio: el camino corto para que el aviso al grupo salga solo.
  TWILIO_ACCOUNT_SID: z.string().optional().default(''),
  TWILIO_AUTH_TOKEN: z.string().optional().default(''),
  TWILIO_WHATSAPP_FROM: z.string().optional().default('+14155238886'),
  /**
   * Número al que se manda el aviso de nueva reserva mientras se prueba.
   *
   * Pisa el `whatsappGrupo` de cada estacionamiento. En producción se deja
   * vacío y cada estacionamiento recibe el suyo, que es para lo que existe esa
   * columna.
   */
  WHATSAPP_GRUPO_PRUEBA: z.string().optional().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(''),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  WHATSAPP_TEMPLATE_RESERVA: z.string().optional().default(''),

  // 'simulado' cobra de mentira y marca la reserva como pagada al instante:
  // deja probar el flujo completo sin credenciales. Es el default en desarrollo.
  // Con 'mercadopago' la reserva NO se confirma hasta que la seña se acredite.
  PAYMENT_PROVIDER: z.enum(['simulado', 'mercadopago', 'none']).default('simulado'),
  /**
   * Credenciales de Mercado Pago (panel de desarrolladores → Tus integraciones
   * → tu aplicación → Credenciales).
   *
   * El access token de prueba empieza con TEST- y el de producción con APP_USR-.
   * Son de cuentas distintas: con las de prueba se cobra con las tarjetas de
   * prueba de Mercado Pago y no se mueve un peso real.
   */
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional().default(''),
  MERCADOPAGO_PUBLIC_KEY: z.string().optional().default(''),
  /**
   * Clave secreta para validar la firma de los webhooks (panel de Mercado Pago
   * → Webhooks → Configurar notificaciones). Opcional: sin ella el webhook
   * sigue funcionando, porque el estado del pago igual se lee contra la API.
   */
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional().default(''),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().default(300),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().default(10),
  RATE_LIMIT_RESERVA_MAX: z.coerce.number().int().default(20),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const detalle = parsed.error.issues.map((i) => `  · ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error('\n✖ Configuración inválida. Revisá tu archivo backend/.env\n' + detalle + '\n');
  console.error('  Tip: copiá backend/.env.example a backend/.env y completá los valores.\n');
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isDev: raw.NODE_ENV === 'development',
  isTest: raw.NODE_ENV === 'test',
  isProd: raw.NODE_ENV === 'production',
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  /** ¿Hay credenciales SMTP suficientes? */
  smtpHabilitado: Boolean(raw.SMTP_HOST && raw.SMTP_USER && raw.SMTP_PASS),
  /** ¿Hay API key de Resend? Tiene prioridad sobre SMTP: es la que se configura primero. */
  resendHabilitado: Boolean(raw.RESEND_API_KEY),
  /** ¿Se puede mandar un mail de verdad por algún canal? */
  mailHabilitado: Boolean(raw.RESEND_API_KEY || (raw.SMTP_HOST && raw.SMTP_USER && raw.SMTP_PASS)),
  /** ¿Está configurada la WhatsApp Business Cloud API? (v2) */
  whatsappCloudHabilitado:
    raw.WHATSAPP_PROVIDER === 'cloud_api' &&
    Boolean(raw.WHATSAPP_PHONE_NUMBER_ID && raw.WHATSAPP_ACCESS_TOKEN),
  /** ¿Se puede cobrar de verdad con Mercado Pago? */
  mercadopagoHabilitado: Boolean(raw.MERCADOPAGO_ACCESS_TOKEN),
  /** Credenciales de prueba (sandbox) vs. de producción. */
  mercadopagoEnPrueba: raw.MERCADOPAGO_ACCESS_TOKEN.startsWith('TEST-'),
  whatsappTwilioHabilitado:
    raw.WHATSAPP_PROVIDER === 'twilio' &&
    Boolean(raw.TWILIO_ACCOUNT_SID && raw.TWILIO_AUTH_TOKEN && raw.TWILIO_WHATSAPP_FROM),
};

// Fijamos la zona horaria del proceso para que los cálculos de negocio
// (día de hoy, próximas llegadas, reportes) sean consistentes.
process.env.TZ = env.TZ;

export default env;
