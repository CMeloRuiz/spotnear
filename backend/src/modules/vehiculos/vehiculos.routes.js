/**
 * Catálogo de vehículos: marca/modelo → tipo.
 *
 *   Público (lo usa el checkout):
 *     GET /api/v1/vehiculos/catalogo                 lista para el autocompletado
 *     GET /api/v1/vehiculos/clasificar?marca=&modelo= tipo detectado, o null
 *
 *   Panel, solo SUPERADMIN (pantalla "Catálogo de vehículos"):
 *     GET    /api/v1/admin/vehiculos-catalogo
 *     POST   /api/v1/admin/vehiculos-catalogo
 *     PATCH  /api/v1/admin/vehiculos-catalogo/:id
 *     DELETE /api/v1/admin/vehiculos-catalogo/:id
 */
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../config/prisma.js';
import validar from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/error.js';
import { requiereAuth, requiereRol } from '../../middleware/auth.js';
import errores, { AppError } from '../../utils/errors.js';
import { auditar } from '../../services/audit.js';
import { texto, vehicleType } from '../shared/schemas.js';
import {
  normalizar,
  normalizarMarca,
  clasificarVehiculo,
  listarCatalogo,
  invalidarCatalogo,
} from './clasificar.js';

/* ═══════════════════════ Público ═══════════════════════ */

export const routerPublico = Router();

routerPublico.get(
  '/catalogo',
  asyncHandler(async (req, res) => {
    // Cambia poco: el navegador lo puede guardar un rato.
    res.set('Cache-Control', 'public, max-age=300').json({ modelos: await listarCatalogo() });
  }),
);

routerPublico.get(
  '/clasificar',
  validar({
    query: z.object({
      marca: z.string().trim().max(60).default(''),
      modelo: z.string().trim().max(60).default(''),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { marca, modelo } = req.datosQuery;
    res.json({ coincidencia: await clasificarVehiculo(marca, modelo) });
  }),
);

/* ═══════════════════════ Panel (SUPERADMIN) ═══════════════════════ */

export const routerAdmin = Router();
routerAdmin.use(requiereAuth, requiereRol('SUPERADMIN'));

const esquemaFila = z.object({
  marca: texto(60, 'La marca'),
  modelo: texto(60, 'El modelo'),
  tipo: vehicleType,
});

/** Columnas comparables. La marca pasa por los alias ("VW" → volkswagen). */
const normalizadas = ({ marca, modelo }) => ({
  marcaNormalizada: normalizarMarca(marca),
  modeloNormalizado: normalizar(modelo),
});

/** Un modelo que ya existe (con otra escritura) devuelve un error que se entiende. */
async function guardar(accion) {
  try {
    return await accion();
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new AppError(
        'Esa marca y ese modelo ya están en el catálogo (quizás escritos distinto). Editá el que existe.',
        409,
        'MODELO_DUPLICADO',
      );
    }
    throw error;
  } finally {
    invalidarCatalogo();
  }
}

routerAdmin.get(
  '/',
  asyncHandler(async (req, res) => {
    const filas = await prisma.vehicleModelCatalog.findMany({
      orderBy: [{ marca: 'asc' }, { modelo: 'asc' }],
      select: { id: true, marca: true, modelo: true, tipo: true, updatedAt: true },
    });
    res.json({ modelos: filas });
  }),
);

routerAdmin.post(
  '/',
  validar({ body: esquemaFila }),
  asyncHandler(async (req, res) => {
    const fila = await guardar(() =>
      prisma.vehicleModelCatalog.create({ data: { ...req.body, ...normalizadas(req.body) } }),
    );
    await auditar(req, { accion: 'catalogo_vehiculos.agregar', entidad: 'VehicleModelCatalog', entidadId: fila.id, datos: req.body });
    res.status(201).json({ modelo: fila });
  }),
);

routerAdmin.patch(
  '/:id',
  validar({ params: z.object({ id: z.string().min(1) }), body: esquemaFila }),
  asyncHandler(async (req, res) => {
    const existe = await prisma.vehicleModelCatalog.findUnique({ where: { id: req.params.id } });
    if (!existe) throw errores.noEncontrado('El modelo');
    const fila = await guardar(() =>
      prisma.vehicleModelCatalog.update({
        where: { id: req.params.id },
        data: { ...req.body, ...normalizadas(req.body) },
      }),
    );
    await auditar(req, {
      accion: 'catalogo_vehiculos.editar',
      entidad: 'VehicleModelCatalog',
      entidadId: fila.id,
      datos: { antes: { marca: existe.marca, modelo: existe.modelo, tipo: existe.tipo }, despues: req.body },
    });
    res.json({ modelo: fila });
  }),
);

routerAdmin.delete(
  '/:id',
  validar({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const existe = await prisma.vehicleModelCatalog.findUnique({ where: { id: req.params.id } });
    if (!existe) throw errores.noEncontrado('El modelo');
    await guardar(() => prisma.vehicleModelCatalog.delete({ where: { id: req.params.id } }));
    await auditar(req, {
      accion: 'catalogo_vehiculos.eliminar',
      entidad: 'VehicleModelCatalog',
      entidadId: existe.id,
      datos: { marca: existe.marca, modelo: existe.modelo, tipo: existe.tipo },
    });
    res.json({ ok: true });
  }),
);

export default { routerPublico, routerAdmin };
