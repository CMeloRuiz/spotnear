/**
 * Registro de auditoría de acciones sensibles.
 *
 * Nunca hace fallar la operación que está auditando: si el log no se puede
 * escribir, se avisa por consola y se sigue.
 */
import prisma from '../config/prisma.js';

/** IP real del cliente, contemplando proxies (Render, Railway, Nginx). */
export function ipDe(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

/**
 * @param {import('express').Request} req
 * @param {{ accion: string, entidad: string, entidadId?: string, parkingId?: string, datos?: object, userId?: string }} evento
 */
export async function auditar(req, { accion, entidad, entidadId, parkingId, datos, userId }) {
  try {
    await prisma.auditLog.create({
      data: {
        // `userId` explícito para casos como el login, donde req.usuario todavía no existe.
        userId: userId ?? req?.usuario?.id ?? null,
        accion,
        entidad,
        entidadId: entidadId ?? null,
        parkingId: parkingId ?? req?.usuario?.parkingId ?? null,
        datos: datos ?? undefined,
        ip: req ? ipDe(req) : null,
        userAgent: req?.headers?.['user-agent'] ?? null,
      },
    });
  } catch (error) {
    console.error('[auditoría] no se pudo registrar:', error.message);
  }
}

export default { auditar, ipDe };
