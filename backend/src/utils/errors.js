/**
 * Errores de aplicación con mensajes en español.
 * El middleware de errores los traduce a respuestas HTTP consistentes.
 */

export class AppError extends Error {
  /**
   * @param {string} mensaje  Mensaje apto para mostrar al usuario final.
   * @param {number} status   Código HTTP.
   * @param {string} codigo   Código estable para que el frontend/app decida qué hacer.
   * @param {object} [detalle]
   */
  constructor(mensaje, status = 400, codigo = 'ERROR', detalle = undefined) {
    super(mensaje);
    this.name = 'AppError';
    this.status = status;
    this.codigo = codigo;
    this.detalle = detalle;
    this.esOperacional = true;
    Error.captureStackTrace?.(this, AppError);
  }
}

export const errores = {
  datosInvalidos: (detalle, mensaje = 'Los datos enviados no son válidos.') =>
    new AppError(mensaje, 422, 'DATOS_INVALIDOS', detalle),

  noAutenticado: (mensaje = 'Necesitás iniciar sesión para continuar.') =>
    new AppError(mensaje, 401, 'NO_AUTENTICADO'),

  tokenInvalido: (mensaje = 'Tu sesión expiró. Ingresá de nuevo.') =>
    new AppError(mensaje, 401, 'TOKEN_INVALIDO'),

  sinPermiso: (mensaje = 'No tenés permiso para realizar esta acción.') =>
    new AppError(mensaje, 403, 'SIN_PERMISO'),

  noEncontrado: (recurso = 'El recurso') =>
    new AppError(`${recurso} no existe o no está disponible.`, 404, 'NO_ENCONTRADO'),

  conflicto: (mensaje, detalle) => new AppError(mensaje, 409, 'CONFLICTO', detalle),

  sinCupo: (detalle) =>
    new AppError(
      'No quedan lugares disponibles en ese horario. Probá con otro horario u otro estacionamiento.',
      409,
      'SIN_CUPO',
      detalle,
    ),

  demasiadasSolicitudes: (mensaje = 'Demasiadas solicitudes. Esperá unos minutos.') =>
    new AppError(mensaje, 429, 'DEMASIADAS_SOLICITUDES'),

  interno: (mensaje = 'Ocurrió un error inesperado. Intentá de nuevo en unos minutos.') =>
    new AppError(mensaje, 500, 'ERROR_INTERNO'),
};

export default errores;
