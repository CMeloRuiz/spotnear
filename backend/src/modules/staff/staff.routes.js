/**
 * Panel · Equipo: /api/v1/admin/staff
 *
 * El OWNER da de alta a sus playeros (STAFF). El SUPERADMIN además puede crear
 * OWNERs y mover usuarios entre estacionamientos.
 * Un OWNER nunca ve ni toca usuarios de otro estacionamiento.
 */
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../config/prisma.js';
import validar from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/error.js';
import { requiereAuth, requiereRol, asegurarTenant, filtroTenant } from '../../middleware/auth.js';
import errores from '../../utils/errors.js';
import { auditar } from '../../services/audit.js';
import { hashearPassword, logoutTodas } from '../auth/auth.service.js';
import { texto, textoOpcional, email, password, role } from '../shared/schemas.js';

const router = Router();
router.use(requiereAuth);
router.use(requiereRol('SUPERADMIN', 'OWNER'));

function aUsuario(u) {
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    telefono: u.telefono,
    role: u.role,
    parkingId: u.parkingId,
    parking: u.parking ? { id: u.parking.id, nombre: u.parking.nombre } : null,
    activo: u.activo,
    ultimoLogin: u.ultimoLogin,
    createdAt: u.createdAt,
  };
}

/**
 * Qué roles puede crear cada quien.
 * Un OWNER solo crea STAFF: no puede fabricarse un par ni escalar a SUPERADMIN.
 */
function rolesPermitidos(usuario) {
  return usuario.role === 'SUPERADMIN' ? ['SUPERADMIN', 'OWNER', 'STAFF'] : ['STAFF'];
}

/**
 * GET /api/v1/admin/staff
 */
router.get(
  '/',
  validar({
    query: z.object({
      parkingId: z.string().optional(),
      incluirInactivos: z.enum(['true', 'false']).transform((v) => v === 'true').default('false'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const where = { ...filtroTenant(req) };
    if (!req.datosQuery.incluirInactivos) where.activo = true;

    const usuarios = await prisma.user.findMany({
      where,
      include: { parking: { select: { id: true, nombre: true } } },
      orderBy: [{ role: 'asc' }, { nombre: 'asc' }],
    });

    res.json({ usuarios: usuarios.map(aUsuario) });
  }),
);

/**
 * POST /api/v1/admin/staff
 * Alta de un usuario del equipo.
 */
router.post(
  '/',
  validar({
    body: z.object({
      nombre: texto(120, 'El nombre'),
      email,
      password,
      telefono: textoOpcional(30),
      role: role.default('STAFF'),
      parkingId: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { role: rolPedido, parkingId: parkingPedido, ...datos } = req.body;

    if (!rolesPermitidos(req.usuario).includes(rolPedido)) {
      throw errores.sinPermiso(`No podés crear usuarios con rol ${rolPedido}.`);
    }

    // SUPERADMIN es el único rol sin estacionamiento asociado.
    let parkingId = null;
    if (rolPedido !== 'SUPERADMIN') {
      parkingId = parkingPedido ?? req.usuario.parkingId;
      if (!parkingId) throw errores.datosInvalidos(undefined, 'Indicá a qué estacionamiento pertenece.');
      asegurarTenant(req, parkingId);
    }

    const yaExiste = await prisma.user.findUnique({ where: { email: datos.email } });
    if (yaExiste) throw errores.conflicto('Ya hay un usuario registrado con ese email.');

    const usuario = await prisma.user.create({
      data: {
        ...datos,
        role: rolPedido,
        parkingId,
        passwordHash: await hashearPassword(req.body.password),
      },
      include: { parking: { select: { id: true, nombre: true } } },
    });

    await auditar(req, {
      accion: 'staff.crear',
      entidad: 'User',
      entidadId: usuario.id,
      parkingId: parkingId ?? undefined,
      datos: { email: usuario.email, role: usuario.role },
    });

    res.status(201).json({ usuario: aUsuario(usuario) });
  }),
);

/**
 * PATCH /api/v1/admin/staff/:id
 */
router.patch(
  '/:id',
  validar({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      nombre: texto(120, 'El nombre').optional(),
      telefono: textoOpcional(30),
      role: role.optional(),
      activo: z.boolean().optional(),
      password: password.optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const objetivo = await prisma.user.findFirst({
      where: { id: req.params.id, ...filtroTenant(req) },
    });
    if (!objetivo) throw errores.noEncontrado('El usuario');
    if (objetivo.parkingId) asegurarTenant(req, objetivo.parkingId);

    // Un OWNER no puede editar a otro OWNER ni a un SUPERADMIN.
    if (req.usuario.role === 'OWNER' && objetivo.role !== 'STAFF' && objetivo.id !== req.usuario.id) {
      throw errores.sinPermiso('Solo podés administrar a los usuarios STAFF de tu estacionamiento.');
    }
    if (req.body.role && !rolesPermitidos(req.usuario).includes(req.body.role)) {
      throw errores.sinPermiso(`No podés asignar el rol ${req.body.role}.`);
    }
    // Nadie se desactiva a sí mismo: quedaría el panel sin dueño.
    if (req.body.activo === false && objetivo.id === req.usuario.id) {
      throw errores.conflicto('No podés desactivar tu propio usuario.');
    }

    const datos = { ...req.body };
    if (datos.password) {
      datos.passwordHash = await hashearPassword(datos.password);
      delete datos.password;
      // Cambiarle la clave a alguien le cierra todas las sesiones abiertas.
      await logoutTodas(objetivo.id);
    }

    const usuario = await prisma.user.update({
      where: { id: req.params.id },
      data: datos,
      include: { parking: { select: { id: true, nombre: true } } },
    });

    await auditar(req, {
      accion: 'staff.editar',
      entidad: 'User',
      entidadId: usuario.id,
      parkingId: usuario.parkingId ?? undefined,
      datos: Object.keys(req.body),
    });

    res.json({ usuario: aUsuario(usuario) });
  }),
);

/**
 * DELETE /api/v1/admin/staff/:id
 * Baja lógica + cierre de sesiones. No se borra por la trazabilidad
 * (las reservas que cargó siguen apuntando a este usuario).
 */
router.delete(
  '/:id',
  validar({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const objetivo = await prisma.user.findFirst({
      where: { id: req.params.id, ...filtroTenant(req) },
    });
    if (!objetivo) throw errores.noEncontrado('El usuario');
    if (objetivo.parkingId) asegurarTenant(req, objetivo.parkingId);
    if (objetivo.id === req.usuario.id) {
      throw errores.conflicto('No podés darte de baja a vos mismo.');
    }
    if (req.usuario.role === 'OWNER' && objetivo.role !== 'STAFF') {
      throw errores.sinPermiso('Solo podés dar de baja usuarios STAFF.');
    }

    await prisma.user.update({ where: { id: objetivo.id }, data: { activo: false } });
    await logoutTodas(objetivo.id);

    await auditar(req, {
      accion: 'staff.baja',
      entidad: 'User',
      entidadId: objetivo.id,
      parkingId: objetivo.parkingId ?? undefined,
    });

    res.json({ ok: true, mensaje: `${objetivo.nombre} quedó dado de baja.` });
  }),
);

/**
 * DELETE /api/v1/admin/staff/:id/definitivo
 *
 * Borrado real de la fila, distinto de la baja lógica de arriba.
 *
 * Quién puede: el SUPERADMIN sobre cualquiera, y el OWNER solo sobre su propio
 * STAFF (misma regla que ya regía para la baja). Nadie se puede borrar a sí
 * mismo, ni borrar al último SUPERADMIN que queda: eso dejaría la plataforma
 * sin nadie que pueda entrar.
 *
 * Qué pasa con lo que apuntaba al usuario:
 *
 *  · Reservas que cargó → antes de borrarlo se copia su nombre en cada una
 *    (createdByNombre). La relación es SetNull, así que sin esa copia las
 *    reservas quedarían sin saber quién las tomó.
 *  · Auditoría → se conserva. También es SetNull: la acción queda registrada
 *    aunque el usuario ya no exista.
 *  · Sesiones abiertas → se cierran antes de borrar.
 */
router.delete(
  '/:id/definitivo',
  validar({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({ confirmacion: z.string().optional() }).optional(),
  }),
  asyncHandler(async (req, res) => {
    const objetivo = await prisma.user.findFirst({
      where: { id: req.params.id, ...filtroTenant(req) },
    });
    if (!objetivo) throw errores.noEncontrado('El usuario');
    if (objetivo.parkingId) asegurarTenant(req, objetivo.parkingId);

    if (objetivo.id === req.usuario.id) {
      throw errores.conflicto('No podés eliminarte a vos mismo.');
    }
    if (req.usuario.role === 'OWNER' && objetivo.role !== 'STAFF') {
      throw errores.sinPermiso('Solo podés eliminar usuarios de tu equipo.');
    }

    // Quedarse sin ningún SUPERADMIN deja la plataforma sin acceso.
    if (objetivo.role === 'SUPERADMIN') {
      const otros = await prisma.user.count({
        where: { role: 'SUPERADMIN', activo: true, id: { not: objetivo.id } },
      });
      if (otros === 0) {
        throw errores.conflicto(
          'Es el último administrador activo de la plataforma. Creá otro antes de eliminarlo.',
        );
      }
    }

    const reservasCargadas = await prisma.reservation.count({
      where: { createdByUserId: objetivo.id, eliminadaEn: { not: undefined } },
    });

    await prisma.$transaction(async (tx) => {
      if (reservasCargadas > 0) {
        await tx.reservation.updateMany({
          where: { createdByUserId: objetivo.id },
          data: { createdByNombre: objetivo.nombre },
        });
      }
      await tx.refreshToken.deleteMany({ where: { userId: objetivo.id } });
      await tx.user.delete({ where: { id: objetivo.id } });
    });

    await auditar(req, {
      accion: 'staff.eliminar',
      entidad: 'User',
      entidadId: objetivo.id,
      parkingId: objetivo.parkingId ?? undefined,
      datos: {
        nombre: objetivo.nombre,
        email: objetivo.email,
        role: objetivo.role,
        reservasConservadas: reservasCargadas,
      },
    });

    res.json({
      ok: true,
      mensaje: `${objetivo.nombre} se eliminó de la plataforma.`,
      reservasConservadas: reservasCargadas,
    });
  }),
);

export default router;
