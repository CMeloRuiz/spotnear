/**
 * Lógica de autenticación.
 *
 * Esquema: access token corto (15 min) + refresh token largo (30 días).
 * El refresh se guarda HASHEADO en base y se ROTA en cada uso: si alguien roba
 * un refresh y lo usa, el legítimo deja de funcionar y el robo se nota.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import env from '../../config/env.js';
import prisma from '../../config/prisma.js';
import errores, { AppError } from '../../utils/errors.js';
import { hashToken } from '../../utils/codes.js';

const RONDAS_BCRYPT = 10;

/** @param {string} plano */
export function hashearPassword(plano) {
  return bcrypt.hash(plano, RONDAS_BCRYPT);
}

/** Datos públicos del usuario (nunca sale el passwordHash). */
export function usuarioPublico(usuario) {
  return {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    telefono: usuario.telefono ?? null,
    role: usuario.role,
    parkingId: usuario.parkingId ?? null,
    parking: usuario.parking
      ? { id: usuario.parking.id, nombre: usuario.parking.nombre, slug: usuario.parking.slug }
      : null,
  };
}

function firmarAccessToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, role: usuario.role, parkingId: usuario.parkingId ?? null },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN },
  );
}

function firmarRefreshToken(usuario, jti) {
  return jwt.sign({ sub: usuario.id, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

/** Guarda el refresh hasheado y devuelve el token en claro (solo se ve una vez). */
async function emitirRefreshToken(usuario, contexto = {}) {
  const jti = crypto.randomUUID();
  const token = firmarRefreshToken(usuario, jti);
  const { exp } = jwt.decode(token);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(token),
      userId: usuario.id,
      expiresAt: new Date(exp * 1000),
      userAgent: contexto.userAgent ?? null,
      ip: contexto.ip ?? null,
    },
  });

  return token;
}

/**
 * Login con email y contraseña.
 * El mensaje de error es el mismo si el mail no existe o si la clave está mal:
 * no le regalamos a nadie la lista de usuarios válidos.
 */
export async function login({ email, password }, contexto = {}) {
  const usuario = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { parking: { select: { id: true, nombre: true, slug: true, activo: true, estado: true } } },
  });

  const mensajeGenerico = 'El email o la contraseña no son correctos.';

  if (!usuario) {
    // Comparación igual de costosa aunque el usuario no exista, para que el
    // tiempo de respuesta no delate qué emails están registrados.
    await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    throw new AppError(mensajeGenerico, 401, 'CREDENCIALES_INVALIDAS');
  }

  const coincide = await bcrypt.compare(password, usuario.passwordHash);
  if (!coincide) {
    throw new AppError(mensajeGenerico, 401, 'CREDENCIALES_INVALIDAS');
  }

  // El estado del estacionamiento se evalúa ANTES que el del usuario: al alta
  // por autogestión se le apagan los dos a la vez, y decirle "tu usuario está
  // desactivado" a alguien que acaba de registrarse suena a que lo rechazamos.
  // La causa real es la solicitud en revisión, y eso es lo que tiene que leer.
  if (usuario.role !== 'SUPERADMIN' && usuario.parking) {
    if (usuario.parking.estado === 'PENDIENTE_VERIFICACION') {
      throw errores.sinPermiso(
        'Todavía no confirmaste tu email. Abrí el link que te mandamos para que tu solicitud entre en revisión.',
      );
    }
    if (usuario.parking.estado === 'PENDIENTE_APROBACION') {
      throw errores.sinPermiso(
        'Tu solicitud todavía está en revisión. Te avisamos por email apenas la aprobemos.',
      );
    }
    if (usuario.parking.estado === 'RECHAZADO') {
      throw errores.sinPermiso('Tu solicitud de alta no fue aprobada. Escribinos si querés revisarla.');
    }
    if (!usuario.parking.activo) {
      throw errores.sinPermiso('El estacionamiento asociado a tu usuario está dado de baja.');
    }
  }

  if (!usuario.activo) {
    throw errores.sinPermiso('Tu usuario está desactivado. Contactá al administrador.');
  }

  await prisma.user.update({
    where: { id: usuario.id },
    data: { ultimoLogin: new Date() },
  });

  const accessToken = firmarAccessToken(usuario);
  const refreshToken = await emitirRefreshToken(usuario, contexto);

  return { usuario: usuarioPublico(usuario), accessToken, refreshToken };
}

/**
 * Canjea un refresh token por un par nuevo. El token usado queda revocado.
 */
export async function refrescar(refreshToken, contexto = {}) {
  if (!refreshToken) throw errores.tokenInvalido('Falta el refresh token.');

  let payload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw errores.tokenInvalido('Tu sesión expiró. Ingresá de nuevo.');
  }

  const guardado = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
  });

  if (!guardado || guardado.revokedAt || guardado.expiresAt < new Date()) {
    // El token es válido criptográficamente pero ya no vale: o se usó, o se revocó.
    // Por las dudas, se revocan todas las sesiones del usuario.
    if (guardado?.userId) {
      await prisma.refreshToken.updateMany({
        where: { userId: guardado.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    throw errores.tokenInvalido('Tu sesión ya no es válida. Ingresá de nuevo.');
  }

  const usuario = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { parking: { select: { id: true, nombre: true, slug: true, activo: true, estado: true } } },
  });

  if (!usuario || !usuario.activo) {
    throw errores.tokenInvalido('Tu usuario ya no está activo.');
  }

  // Rotación: se invalida el viejo y se emite uno nuevo.
  await prisma.refreshToken.update({
    where: { id: guardado.id },
    data: { revokedAt: new Date() },
  });

  const accessToken = firmarAccessToken(usuario);
  const nuevoRefresh = await emitirRefreshToken(usuario, contexto);

  return { usuario: usuarioPublico(usuario), accessToken, refreshToken: nuevoRefresh };
}

/** Cierra una sesión puntual. */
export async function logout(refreshToken) {
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Cierra todas las sesiones de un usuario. */
export async function logoutTodas(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Cambio de contraseña propia. Invalida todas las sesiones abiertas. */
export async function cambiarPassword(userId, { actual, nueva }) {
  const usuario = await prisma.user.findUnique({ where: { id: userId } });
  if (!usuario) throw errores.noEncontrado('El usuario');

  const coincide = await bcrypt.compare(actual, usuario.passwordHash);
  if (!coincide) {
    throw errores.datosInvalidos(
      { campos: [{ campo: 'actual', mensaje: 'La contraseña actual no es correcta.' }] },
      'La contraseña actual no es correcta.',
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashearPassword(nueva) },
  });

  await logoutTodas(userId);
}

export default { login, refrescar, logout, logoutTodas, cambiarPassword, hashearPassword };
