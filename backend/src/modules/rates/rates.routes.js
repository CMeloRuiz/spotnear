/**
 * Panel · Tarifas: /api/v1/admin/rates
 *
 * Tipos: HORA, DIA y MENSUAL. El precio por hora es la base de los escalones
 * de media estadía y estadía completa que calcula services/pricing.js.
 */
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../config/prisma.js';
import validar from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/error.js';
import { requiereAuth, requiereRol, asegurarTenant, requiereParking, filtroTenant } from '../../middleware/auth.js';
import errores from '../../utils/errors.js';
import { auditar } from '../../services/audit.js';
import { textoOpcional, vehicleType, rateType, dinero } from '../shared/schemas.js';
import { aNumero } from '../../utils/money.js';

const router = Router();
router.use(requiereAuth);

function aTarifa(t) {
  return {
    id: t.id,
    parkingId: t.parkingId,
    tipo: t.tipo,
    precio: aNumero(t.precio),
    descripcion: t.descripcion,
    vehicleType: t.vehicleType,
    vigenciaDesde: t.vigenciaDesde,
    vigenciaHasta: t.vigenciaHasta,
    activo: t.activo,
    parking: t.parking ? { id: t.parking.id, nombre: t.parking.nombre } : undefined,
  };
}

const fechaOpcional = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'La fecha no es válida.' })
  .transform((v) => new Date(v))
  .optional()
  .nullable();

/**
 * GET /api/v1/admin/rates
 */
router.get(
  '/',
  validar({
    query: z.object({
      parkingId: z.string().optional(),
      tipo: rateType.optional(),
      incluirInactivas: z.enum(['true', 'false']).transform((v) => v === 'true').default('false'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const where = { ...filtroTenant(req) };
    if (req.datosQuery.tipo) where.tipo = req.datosQuery.tipo;
    if (!req.datosQuery.incluirInactivas) where.activo = true;

    const tarifas = await prisma.rate.findMany({
      where,
      include: {
        parking: { select: { id: true, nombre: true } },
      },
      orderBy: [{ tipo: 'asc' }, { precio: 'asc' }],
    });

    res.json({ tarifas: tarifas.map(aTarifa) });
  }),
);

/**
 * POST /api/v1/admin/rates
 */
router.post(
  '/',
  requiereRol('SUPERADMIN', 'OWNER'),
  validar({
    body: z
      .object({
        parkingId: z.string().optional(),
        tipo: rateType,
        precio: dinero,
        descripcion: textoOpcional(200),
        vehicleType: vehicleType.optional().nullable(),
        vigenciaDesde: fechaOpcional,
        vigenciaHasta: fechaOpcional,
        activo: z.boolean().default(true),
      })
      .superRefine((d, ctx) => {
        if (d.vigenciaDesde && d.vigenciaHasta && d.vigenciaHasta <= d.vigenciaDesde) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['vigenciaHasta'],
            message: 'El fin de vigencia tiene que ser posterior al inicio.',
          });
        }
      }),
  }),
  asyncHandler(async (req, res) => {
    const parkingId = req.body.parkingId ?? requiereParking(req);
    asegurarTenant(req, parkingId);

    const tarifa = await prisma.rate.create({
      data: { ...req.body, parkingId },
    });

    await auditar(req, {
      accion: 'tarifa.crear',
      entidad: 'Rate',
      entidadId: tarifa.id,
      parkingId,
      datos: { tipo: tarifa.tipo, precio: aNumero(tarifa.precio) },
    });

    res.status(201).json({ tarifa: aTarifa(tarifa) });
  }),
);

/**
 * PATCH /api/v1/admin/rates/:id
 */
router.patch(
  '/:id',
  requiereRol('SUPERADMIN', 'OWNER'),
  validar({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      precio: dinero.optional(),
      descripcion: textoOpcional(200),
      vehicleType: vehicleType.optional().nullable(),
      vigenciaDesde: fechaOpcional,
      vigenciaHasta: fechaOpcional,
      activo: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const existente = await prisma.rate.findFirst({
      where: { id: req.params.id, ...filtroTenant(req) },
    });
    if (!existente) throw errores.noEncontrado('La tarifa');
    asegurarTenant(req, existente.parkingId);

    const tarifa = await prisma.rate.update({
      where: { id: req.params.id },
      data: req.body,
    });

    await auditar(req, {
      accion: 'tarifa.editar',
      entidad: 'Rate',
      entidadId: tarifa.id,
      parkingId: tarifa.parkingId,
      datos: req.body,
    });

    res.json({ tarifa: aTarifa(tarifa) });
  }),
);

/**
 * DELETE /api/v1/admin/rates/:id
 * Baja lógica: las reservas ya hechas guardan el precio congelado, pero la
 * tarifa se conserva para poder auditar con qué se cobró.
 */
router.delete(
  '/:id',
  requiereRol('SUPERADMIN', 'OWNER'),
  validar({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const existente = await prisma.rate.findFirst({
      where: { id: req.params.id, ...filtroTenant(req) },
    });
    if (!existente) throw errores.noEncontrado('La tarifa');
    asegurarTenant(req, existente.parkingId);

    await prisma.rate.update({ where: { id: req.params.id }, data: { activo: false } });

    await auditar(req, {
      accion: 'tarifa.baja',
      entidad: 'Rate',
      entidadId: req.params.id,
      parkingId: existente.parkingId,
    });

    res.json({ ok: true, mensaje: 'Tarifa desactivada.' });
  }),
);

export default router;
