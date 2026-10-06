/**
 * Preload de los tests (`node --import ./tests/setup.js --test`).
 *
 * Se ejecuta ANTES de que se evalúe cualquier módulo de la app, así
 * config/env.js ya lee NODE_ENV=test y se desactivan el rate limiting
 * y los logs HTTP. Se hace acá y no con una variable en el script de npm
 * para que funcione igual en Windows, macOS y Linux.
 */
process.env.NODE_ENV = 'test';

// Ningún test le pega a la pasarela de verdad: sería lento, dependería de
// internet y de credenciales, y le estaríamos probando el software a Mercado
// Pago. Lo que se prueba es nuestra mitad —qué pasa cuando la seña entra— y
// para eso alcanza el proveedor simulado. Se fuerza acá para que el .env de
// cada uno no cambie el resultado de la suite.
process.env.PAYMENT_PROVIDER = 'simulado';

// Tampoco se mandan emails de verdad: la suite crea cientos de reservas y
// altas con casillas inventadas, y con la RESEND_API_KEY del .env saldrían por
// Resend. dotenv no pisa variables ya definidas, así que vaciarlas acá alcanza.
// Los tests de email activan Resend a mano (con fetch simulado).
process.env.RESEND_API_KEY = '';
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
