/**
 * Rutas de autenticación: /api/v1/auth
 */
import { Router } from 'express';
import { z } from 'zod';
import * as servicio from './auth.service.js';
import prisma from '../../config/prisma.js';
import { email, password, texto } from '../shared/schemas.js';
import validar from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/error.js';
import { requiereAuth } from '../../middleware/auth.js';
import { limiteLogin } from '../../middleware/rateLimit.js';
import { auditar, ipDe } from '../../services/audit.js';

const router = Router();

const contextoDe = (req) => ({ ip: ipDe(req), userAgent: req.headers['user-agent'] ?? null });

/**
 * POST /api/v1/auth/login
 * Devuelve el usuario y el par de tokens.
 */
router.post(
  '/login',
  limiteLogin,
  validar({
    body: z.object({
      email,
      password: z.string({ required_error: 'La contraseña es obligatoria.' }).min(1, 'La contraseña es obligatoria.'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const resultado = await servicio.login(req.body, contextoDe(req));
    await auditar(req, {
      accion: 'auth.login',
      entidad: 'User',
      entidadId: resultado.usuario.id,
      userId: resultado.usuario.id,
      parkingId: resultado.usuario.parkingId ?? undefined,
    });
    res.json(resultado);
  }),
);

/**
 * POST /api/v1/auth/refresh
 * Canjea el refresh token por uno nuevo (rotación).
 */
router.post(
  '/refresh',
  validar({
    body: z.object({
      refreshToken: z.string({ required_error: 'Falta el refresh token.' }).min(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const resultado = await servicio.refrescar(req.body.refreshToken, contextoDe(req));
    res.json(resultado);
  }),
);

/**
 * POST /api/v1/auth/logout
 * Revoca el refresh token enviado.
 */
router.post(
  '/logout',
  validar({ body: z.object({ refreshToken: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    await servicio.logout(req.body.refreshToken);
    res.json({ ok: true, mensaje: 'Sesión cerrada.' });
  }),
);

/**
 * GET /api/v1/auth/me
 * Datos del usuario logueado (lo usa el frontend al levantar la app).
 */
router.get(
  '/me',
  requiereAuth,
  asyncHandler(async (req, res) => {
    res.json({ usuario: servicio.usuarioPublico(req.usuario) });
  }),
);

/**
 * PATCH /api/v1/auth/me
 * Actualiza el perfil propio (nombre y teléfono).
 */
router.patch(
  '/me',
  requiereAuth,
  validar({
    body: z.object({
      nombre: texto(120, 'El nombre').optional(),
      telefono: z.string().trim().max(30).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const actualizado = await prisma.user.update({
      where: { id: req.usuario.id },
      data: req.body,
      include: { parking: { select: { id: true, nombre: true, slug: true } } },
    });
    res.json({ usuario: servicio.usuarioPublico(actualizado) });
  }),
);

/**
 * POST /api/v1/auth/cambiar-password
 * Cambia la contraseña propia y cierra todas las sesiones.
 */
router.post(
  '/cambiar-password',
  requiereAuth,
  validar({
    body: z
      .object({
        actual: z.string({ required_error: 'Ingresá tu contraseña actual.' }).min(1, 'Ingresá tu contraseña actual.'),
        nueva: password,
      })
      .refine((d) => d.nueva !== d.actual, {
        path: ['nueva'],
        message: 'La contraseña nueva tiene que ser distinta de la actual.',
      }),
  }),
  asyncHandler(async (req, res) => {
    await servicio.cambiarPassword(req.usuario.id, req.body);
    await auditar(req, { accion: 'auth.cambio_password', entidad: 'User', entidadId: req.usuario.id });
    res.json({ ok: true, mensaje: 'Contraseña actualizada. Volvé a ingresar.' });
  }),
);

export default router;
