/**
 * Límites de tasa. Más estrictos donde más duele:
 *  · login → fuerza bruta de contraseñas
 *  · creación pública de reservas → spam / agotamiento de cupos
 */
import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

const respuesta = (mensaje) => (req, res) =>
  res.status(429).json({ error: { codigo: 'DEMASIADAS_SOLICITUDES', mensaje } });

/** Límite general de la API. */
export const limiteGeneral = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: respuesta('Demasiadas solicitudes. Esperá unos minutos e intentá de nuevo.'),
});

/** Login: pocos intentos por ventana. */
export const limiteLogin = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_LOGIN_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // solo cuentan los intentos fallidos
  skip: () => env.isTest,
  handler: respuesta('Demasiados intentos de ingreso. Esperá unos minutos antes de reintentar.'),
});

/** Creación pública de reservas. */
export const limiteReservas = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_RESERVA_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: respuesta('Recibimos demasiadas reservas desde tu conexión. Esperá unos minutos.'),
});

/**
 * Solicitudes públicas de alta de estacionamiento.
 * Crea un usuario y un estacionamiento sin autenticación, así que es el
 * endpoint público más caro que tiene la API: se limita fuerte.
 */
export const limiteAltaEstacionamiento = rateLimit({
  windowMs: 60 * 60 * 1000, // una hora
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: respuesta('Recibimos varias solicitudes desde tu conexión. Probá de nuevo en una hora.'),
});

/**
 * Subida de fotos del formulario público de alta.
 * Más permisivo que el alta en sí (son varias fotos por solicitud), pero
 * acotado: escribe archivos en disco sin pedir cuenta.
 */
export const limiteSubidaFotos = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: respuesta('Subiste demasiadas fotos en poco tiempo. Probá de nuevo en un rato.'),
});

export default {
  limiteGeneral,
  limiteLogin,
  limiteReservas,
  limiteAltaEstacionamiento,
  limiteSubidaFotos,
};
