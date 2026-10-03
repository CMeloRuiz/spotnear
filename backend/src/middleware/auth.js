/**
 * Autenticación y autorización.
 *
 * El aislamiento multi-tenant se resuelve ACÁ y en cada consulta, no en la UI:
 * un OWNER o STAFF nunca puede leer ni escribir datos de otro estacionamiento,
 * aunque escriba el id a mano en la URL.
 */
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import prisma from '../config/prisma.js';
import errores from '../utils/errors.js';
import { asyncHandler } from './error.js';

/** Extrae el token del header Authorization: Bearer <token>. */
function leerToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/**
 * Exige un usuario autenticado y vigente.
 * Deja en req.usuario: { id, email, nombre, role, parkingId }
 */
export const requiereAuth = asyncHandler(async (req, res, next) => {
  const token = leerToken(req);
  if (!token) throw errores.noAutenticado();

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch (e) {
    throw e.name === 'TokenExpiredError'
      ? errores.tokenInvalido('Tu sesión expiró. Ingresá de nuevo.')
      : errores.tokenInvalido('El token de acceso no es válido.');
  }

  // Se relee el usuario en cada request: si lo desactivan o le cambian el
  // estacionamiento, el cambio impacta al instante y no cuando expire el token.
  const usuario = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      nombre: true,
      role: true,
      parkingId: true,
      activo: true,
      parking: { select: { id: true, nombre: true, slug: true, activo: true } },
    },
  });

  if (!usuario || !usuario.activo) {
    throw errores.tokenInvalido('Tu usuario ya no está activo. Contactá al administrador.');
  }
  if (usuario.role !== 'SUPERADMIN' && usuario.parking && !usuario.parking.activo) {
    throw errores.sinPermiso('El estacionamiento asociado a tu usuario está dado de baja.');
  }

  req.usuario = usuario;
  next();
});

/**
 * Restringe el acceso a ciertos roles.
 * @param {...('SUPERADMIN'|'OWNER'|'STAFF')} roles
 */
export function requiereRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) return next(errores.noAutenticado());
    if (!roles.includes(req.usuario.role)) {
      return next(errores.sinPermiso('Tu rol no tiene acceso a esta sección.'));
    }
    next();
  };
}

/**
 * Devuelve el estacionamiento sobre el que puede operar el usuario.
 *
 *  · SUPERADMIN: opera sobre el que indique ?parkingId= (o todos si no indica).
 *  · OWNER/STAFF: SIEMPRE su propio estacionamiento; se ignora lo que pidan.
 *
 * @returns {string|null} null solo para SUPERADMIN sin filtro (= todos)
 */
export function parkingDelUsuario(req) {
  const { usuario } = req;
  if (!usuario) return null;
  if (usuario.role === 'SUPERADMIN') {
    return req.datosQuery?.parkingId ?? req.query?.parkingId ?? req.body?.parkingId ?? null;
  }
  return usuario.parkingId;
}

/**
 * Cláusula `where` de Prisma que limita cualquier consulta al tenant del usuario.
 * Se usa en TODOS los endpoints del panel.
 */
export function filtroTenant(req, campo = 'parkingId') {
  const id = parkingDelUsuario(req);
  return id ? { [campo]: id } : {};
}

/**
 * Verifica que el usuario pueda tocar ESE estacionamiento puntual.
 * Lanza 403 si intenta salirse de su tenant.
 * @param {import('express').Request} req
 * @param {string} parkingId
 */
export function asegurarTenant(req, parkingId) {
  const { usuario } = req;
  if (!usuario) throw errores.noAutenticado();
  if (usuario.role === 'SUPERADMIN') return;
  if (!usuario.parkingId || usuario.parkingId !== parkingId) {
    // Se responde 403 y no 404 porque el usuario SÍ está autenticado;
    // el id no se filtra en el mensaje.
    throw errores.sinPermiso('No tenés acceso a los datos de ese estacionamiento.');
  }
}

/**
 * Exige que el usuario tenga un estacionamiento asignado.
 * Útil en endpoints que no tienen sentido para un SUPERADMIN sin contexto.
 */
export function requiereParking(req) {
  const id = parkingDelUsuario(req);
  if (!id) {
    throw errores.datosInvalidos(
      undefined,
      'Indicá el estacionamiento (parkingId) sobre el que querés operar.',
    );
  }
  return id;
}

export default { requiereAuth, requiereRol, asegurarTenant, filtroTenant, parkingDelUsuario };
