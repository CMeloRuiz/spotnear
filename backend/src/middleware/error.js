/**
 * Manejo de errores centralizado. Todas las respuestas de error de la API
 * tienen la misma forma:
 *   { "error": { "codigo": "SIN_CUPO", "mensaje": "...", "detalle": {...} } }
 */
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import env from '../config/env.js';

/** Envuelve handlers async para que los rechazos lleguen al middleware de error. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** 404 para rutas que no existen. */
export function noEncontrado(req, res) {
  res.status(404).json({
    error: {
      codigo: 'RUTA_NO_ENCONTRADA',
      mensaje: `No existe el endpoint ${req.method} ${req.originalUrl}.`,
    },
  });
}

/** Traduce los errores de Prisma a algo que el usuario entienda. */
function mapearErrorPrisma(err) {
  switch (err.code) {
    case 'P2002': {
      const campos = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'un campo único';
      return new AppError(`Ya existe un registro con ese valor (${campos}).`, 409, 'DUPLICADO');
    }
    case 'P2003':
      return new AppError(
        'No se puede completar la operación porque hay datos relacionados.',
        409,
        'RELACION_INVALIDA',
      );
    case 'P2025':
      return new AppError('El registro no existe o ya fue eliminado.', 404, 'NO_ENCONTRADO');
    default:
      return null;
  }
}

/* eslint-disable-next-line no-unused-vars -- Express identifica el handler de error por sus 4 parámetros */
export function manejadorDeErrores(err, req, res, next) {
  let error = err;

  // Errores de validación de Zod que no se hayan capturado antes
  if (error instanceof ZodError) {
    error = new AppError('Los datos enviados no son válidos.', 422, 'DATOS_INVALIDOS', {
      campos: error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    });
  }

  // Errores conocidos de Prisma
  if (error?.code && typeof error.code === 'string' && error.code.startsWith('P2')) {
    error = mapearErrorPrisma(error) ?? error;
  }

  // JSON mal formado en el body
  if (error?.type === 'entity.parse.failed' || error instanceof SyntaxError) {
    error = new AppError('El cuerpo de la solicitud no es un JSON válido.', 400, 'JSON_INVALIDO');
  }

  if (!(error instanceof AppError)) {
    // Error inesperado: lo logueamos completo pero NO lo exponemos.
    console.error('[error no controlado]', {
      ruta: `${req.method} ${req.originalUrl}`,
      mensaje: error?.message,
      stack: error?.stack,
    });
    error = new AppError(
      'Ocurrió un error inesperado. Intentá de nuevo en unos minutos.',
      500,
      'ERROR_INTERNO',
    );
  }

  const cuerpo = {
    error: {
      codigo: error.codigo,
      mensaje: error.message,
    },
  };
  if (error.detalle) cuerpo.error.detalle = error.detalle;
  // El stack solo en desarrollo, jamás en producción.
  if (env.isDev && err?.stack && error.status >= 500) cuerpo.error.stack = err.stack;

  res.status(error.status).json(cuerpo);
}

export default manejadorDeErrores;
