/**
 * Rutas públicas de estacionamientos: /api/v1/parkings
 * No requieren autenticación. Las consume la web y, más adelante, la app móvil.
 */
import { Router } from 'express';
import { z } from 'zod';
import * as servicio from './parkings.service.js';
import validar from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/error.js';
import { latitud, longitud, vehicleType } from '../shared/schemas.js';

const router = Router();

/** Booleano que llega por querystring como "true"/"false". */
const boolQuery = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

/** Fecha por querystring: acepta ISO con o sin offset. */
const fechaQuery = (etiqueta) =>
  z
    .string({ required_error: `${etiqueta} es obligatoria.` })
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: `${etiqueta} no es una fecha válida.` })
    .transform((v) => new Date(v));

const esquemaBusqueda = z
  .object({
    lat: latitud,
    lng: longitud,
    radio: z.coerce.number().int().min(100).max(20_000).default(2500),
    inicio: fechaQuery('La hora de ingreso'),
    fin: fechaQuery('La hora de salida'),
    modalidad: z.enum(['HORARIO', 'MENSUAL']).default('HORARIO'),
    tipoVehiculo: vehicleType.optional(),
    cubierto: boolQuery,
    precioMax: z.coerce.number().min(0).optional(),
    calificacionMin: z.coerce.number().min(0).max(5).optional(),
    servicios: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [])),
    cantidadVehiculos: z.coerce.number().int().min(1).max(20).default(1),
    soloDisponibles: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .default('true'),
    orden: z.enum(['RELEVANCIA', 'PRECIO', 'DISTANCIA', 'CALIFICACION']).default('RELEVANCIA'),
  })
  .superRefine((d, ctx) => {
    if (d.fin <= d.inicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fin'],
        message: 'La hora de salida tiene que ser posterior a la de ingreso.',
      });
    }
  });

/**
 * GET /api/v1/parkings
 * Búsqueda por cercanía + disponibilidad + precio.
 */
router.get(
  '/',
  validar({ query: esquemaBusqueda }),
  asyncHandler(async (req, res) => {
    const resultados = await servicio.buscarParkings(req.datosQuery);
    res.json({
      resultados,
      total: resultados.length,
      busqueda: {
        lat: req.datosQuery.lat,
        lng: req.datosQuery.lng,
        radio: req.datosQuery.radio,
        inicio: req.datosQuery.inicio,
        fin: req.datosQuery.fin,
        modalidad: req.datosQuery.modalidad,
        orden: req.datosQuery.orden,
      },
    });
  }),
);

/**
 * GET /api/v1/parkings/:idOSlug
 * Detalle público. Con ?inicio&fin incluye precio y disponibilidad.
 */
router.get(
  '/:idOSlug',
  validar({
    params: z.object({ idOSlug: z.string().min(1) }),
    query: z.object({
      inicio: fechaQuery('La hora de ingreso').optional(),
      fin: fechaQuery('La hora de salida').optional(),
      modalidad: z.enum(['HORARIO', 'MENSUAL']).default('HORARIO'),
      tipoVehiculo: vehicleType.optional(),
        cantidadVehiculos: z.coerce.number().int().min(1).max(20).default(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const parking = await servicio.detalleParking(req.params.idOSlug, req.datosQuery);
    res.json({ parking });
  }),
);

/**
 * POST /api/v1/parkings/:id/cotizar
 * Precio y disponibilidad para un horario, sin crear nada.
 * Es POST porque el checkout lo llama con el detalle completo del vehículo.
 */
router.post(
  '/:id/cotizar',
  validar({
    params: z.object({ id: z.string().min(1) }),
    body: z
      .object({
        inicio: fechaQuery('La hora de ingreso'),
        fin: fechaQuery('La hora de salida'),
        tipoVehiculo: vehicleType.optional().nullable(),
        cantidadVehiculos: z.coerce.number().int().min(1).max(20).default(1),
        modalidad: z.enum(['HORARIO', 'MENSUAL']).default('HORARIO'),
      })
      .superRefine((d, ctx) => {
        if (d.fin <= d.inicio) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fin'],
            message: 'La hora de salida tiene que ser posterior a la de ingreso.',
          });
        }
      }),
  }),
  asyncHandler(async (req, res) => {
    const cotizacion = await servicio.cotizar({ parkingId: req.params.id, ...req.body });
    res.json(cotizacion);
  }),
);

export default router;
