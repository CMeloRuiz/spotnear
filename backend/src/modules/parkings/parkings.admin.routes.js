/**
 * Panel · Estacionamientos: /api/v1/admin/parkings
 *
 *  · SUPERADMIN: alta, baja y edición de cualquier estacionamiento.
 *  · OWNER: edita solo el suyo (y no puede tocar la comisión ni publicarse solo).
 *  · STAFF: solo lectura.
 */
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../config/prisma.js';
import validar from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/error.js';
import { requiereAuth, requiereRol, asegurarTenant, parkingDelUsuario } from '../../middleware/auth.js';
import errores from '../../utils/errors.js';
import { auditar } from '../../services/audit.js';
import { hashearPassword } from '../auth/auth.service.js';
import {
  texto,
  textoOpcional,
  latitud,
  longitud,
  vehicleType,
  email,
  password,
  emailOpcional,
} from '../shared/schemas.js';
import { aNumero } from '../../utils/money.js';
import { TIPOS_HORARIO } from '../../utils/horarios.js';
import { subirFotosParking, guardarFotos, traducirErrorDeSubida, MAX_FOTOS } from '../../services/uploads.js';

/** Modo de cierre: fijo, 24 horas o atado al evento del día. */
const tipoHorario = z.enum(TIPOS_HORARIO, {
  errorMap: () => ({ message: 'Elegí un modo de horario válido.' }),
});

const router = Router();
router.use(requiereAuth);

/** Slug a partir del nombre: "Estacionamiento Humboldt 450" → "estacionamiento-humboldt-450" */
function generarSlug(nombre) {
  return String(nombre)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/** Busca un slug libre agregando un sufijo numérico si hace falta. */
async function slugDisponible(base, idActual = null) {
  let slug = base;
  let n = 1;
  /* eslint-disable no-await-in-loop */
  while (true) {
    const existe = await prisma.parking.findUnique({ where: { slug }, select: { id: true } });
    if (!existe || existe.id === idActual) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
  /* eslint-enable no-await-in-loop */
}

const horarioDia = z.object({
  abre: z.string().regex(/^\d{2}:\d{2}$/, 'Usá el formato HH:mm.').optional(),
  cierra: z.string().regex(/^\d{2}:\d{2}$/, 'Usá el formato HH:mm.').optional(),
  cerrado: z.boolean().optional(),
});

const esquemaHorarios = z
  .object({
    abierto24h: z.boolean().optional(),
    lun: horarioDia.optional(),
    mar: horarioDia.optional(),
    mie: horarioDia.optional(),
    jue: horarioDia.optional(),
    vie: horarioDia.optional(),
    sab: horarioDia.optional(),
    dom: horarioDia.optional(),
  })
  .optional();

/** Campos que puede editar un OWNER de su propio estacionamiento. */
const camposEditablesOwner = {
  nombre: texto(120, 'El nombre').optional(),
  descripcion: textoOpcional(1000),
  direccion: texto(200, 'La dirección').optional(),
  barrio: textoOpcional(80),
  ciudad: textoOpcional(80),
  codigoPostal: textoOpcional(20),
  lat: latitud.optional(),
  lng: longitud.optional(),
  googlePlaceId: textoOpcional(200),
  telefono: textoOpcional(30),
  email: emailOpcional,
  whatsappGrupo: textoOpcional(30),
  capacidadTotal: z.coerce.number().int().min(1, 'La capacidad tiene que ser al menos 1.').max(10_000).optional(),
  cubierto: z.boolean().optional(),
  tiposVehiculo: z.array(vehicleType).min(1, 'Elegí al menos un tipo de vehículo.').optional(),
  servicios: z.array(z.string().trim().max(40)).max(20).optional(),
  tipoHorario: tipoHorario.optional(),
  horarios: esquemaHorarios,
  alturaMaximaCm: z.coerce.number().int().min(100).max(500).optional().nullable(),
};

/** Campos reservados al SUPERADMIN. */
const camposSoloSuperadmin = {
  comisionPorcentaje: z.coerce.number().min(0).max(100).optional(),
  activo: z.boolean().optional(),
  publicado: z.boolean().optional(),
  destacado: z.boolean().optional(),
  calificacion: z.coerce.number().min(0).max(5).optional().nullable(),
};

/** Vista completa para el panel (incluye lo que el público no ve). */
/**
 * Qué cuenta el contador de reservas de cada estacionamiento.
 *
 * Solo las vigentes: las que todavía tienen que pasar o están pasando. Antes
 * contaba TODAS las reservas históricas de la tabla, canceladas incluidas, así
 * que el número no coincidía con ningún otro de la interfaz y solo crecía. Al
 * lado de "120 lugares", lo que se espera leer es cuántas reservas vivas tiene
 * ese estacionamiento, no cuántas tuvo en su vida.
 */
const RESERVAS_VIGENTES = { estado: { in: ['PENDIENTE', 'CONFIRMADA', 'EN_CURSO'] } };

function aParkingAdmin(p) {
  return {
    id: p.id,
    slug: p.slug,
    nombre: p.nombre,
    descripcion: p.descripcion,
    direccion: p.direccion,
    barrio: p.barrio,
    ciudad: p.ciudad,
    provincia: p.provincia,
    codigoPostal: p.codigoPostal,
    lat: p.lat,
    lng: p.lng,
    googlePlaceId: p.googlePlaceId,
    telefono: p.telefono,
    email: p.email,
    whatsappGrupo: p.whatsappGrupo,
    capacidadTotal: p.capacidadTotal,
    cubierto: p.cubierto,
    tiposVehiculo: p.tiposVehiculo,
    servicios: p.servicios,
    tipoHorario: p.tipoHorario,
    horarios: p.horarios,
    alturaMaximaCm: p.alturaMaximaCm,
    comisionPorcentaje: aNumero(p.comisionPorcentaje),
    moneda: p.moneda,
    activo: p.activo,
    publicado: p.publicado,
    destacado: p.destacado,
    calificacion: p.calificacion !== null && p.calificacion !== undefined ? aNumero(p.calificacion) : null,
    cantidadResenas: p.cantidadResenas,
    fotos: p.fotos ?? [],
    camposExtra: p.camposExtra ?? [],
    createdAt: p.createdAt,
    _count: p._count,
  };
}

/**
 * GET /api/v1/admin/parkings
 * SUPERADMIN ve todos; OWNER/STAFF ven solo el suyo.
 */
router.get(
  '/',
  validar({
    query: z.object({
      q: z.string().trim().max(80).optional(),
      incluirInactivos: z.enum(['true', 'false']).transform((v) => v === 'true').default('false'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const where = {};

    if (req.usuario.role !== 'SUPERADMIN') {
      if (!req.usuario.parkingId) return res.json({ parkings: [] });
      where.id = req.usuario.parkingId;
    }
    if (!req.datosQuery.incluirInactivos) where.activo = true;
    if (req.datosQuery.q) {
      where.OR = [
        { nombre: { contains: req.datosQuery.q, mode: 'insensitive' } },
        { direccion: { contains: req.datosQuery.q, mode: 'insensitive' } },
        { barrio: { contains: req.datosQuery.q, mode: 'insensitive' } },
      ];
    }

    const parkings = await prisma.parking.findMany({
      where,
      include: {
        fotos: { orderBy: { orden: 'asc' } },
        _count: { select: { reservas: { where: RESERVAS_VIGENTES }, usuarios: true, tarifas: true } },
      },
      orderBy: { nombre: 'asc' },
    });

    res.json({ parkings: parkings.map(aParkingAdmin) });
  }),
);

/**
 * GET /api/v1/admin/parkings/:id
 */
router.get(
  '/:id',
  validar({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    asegurarTenant(req, req.params.id);

    const parking = await prisma.parking.findUnique({
      where: { id: req.params.id },
      include: {
        fotos: { orderBy: { orden: 'asc' } },
        camposExtra: { orderBy: { orden: 'asc' } },
        _count: { select: { reservas: { where: RESERVAS_VIGENTES }, usuarios: true, tarifas: true } },
      },
    });

    if (!parking) throw errores.noEncontrado('El estacionamiento');
    res.json({ parking: aParkingAdmin(parking) });
  }),
);

/**
 * POST /api/v1/admin/parkings
 * Alta de un estacionamiento + su usuario OWNER. Solo SUPERADMIN.
 */
router.post(
  '/',
  requiereRol('SUPERADMIN'),
  validar({
    body: z.object({
      nombre: texto(120, 'El nombre'),
      descripcion: textoOpcional(1000),
      direccion: texto(200, 'La dirección'),
      barrio: textoOpcional(80),
      ciudad: textoOpcional(80),
      codigoPostal: textoOpcional(20),
      lat: latitud,
      lng: longitud,
      googlePlaceId: textoOpcional(200),
      telefono: textoOpcional(30),
      email: emailOpcional,
      whatsappGrupo: textoOpcional(30),
      capacidadTotal: z.coerce.number().int().min(1).max(10_000),
      cubierto: z.boolean().default(false),
      tiposVehiculo: z.array(vehicleType).min(1).default(['AUTO', 'CAMIONETA', 'MOTO']),
      servicios: z.array(z.string().trim().max(40)).max(20).default([]),
      tipoHorario: tipoHorario.default('FIJO'),
      horarios: esquemaHorarios,
      alturaMaximaCm: z.coerce.number().int().min(100).max(500).optional(),
      comisionPorcentaje: z.coerce.number().min(0).max(100).optional(),
      publicado: z.boolean().default(true),
      // Usuario dueño que se crea junto con el estacionamiento
      owner: z
        .object({
          nombre: texto(120, 'El nombre del dueño'),
          email,
          password,
          telefono: textoOpcional(30),
        })
        .optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { owner, ...datos } = req.body;
    const slug = await slugDisponible(generarSlug(datos.nombre));

    const creado = await prisma.$transaction(async (tx) => {
      const parking = await tx.parking.create({
        data: {
          ...datos,
          slug,
          horarios: datos.horarios ?? {},
        },
      });

      if (owner) {
        const yaExiste = await tx.user.findUnique({ where: { email: owner.email } });
        if (yaExiste) {
          throw errores.conflicto('Ya hay un usuario registrado con ese email.');
        }
        await tx.user.create({
          data: {
            email: owner.email,
            nombre: owner.nombre,
            telefono: owner.telefono,
            passwordHash: await hashearPassword(owner.password),
            role: 'OWNER',
            parkingId: parking.id,
          },
        });
      }

      return parking;
    });

    await auditar(req, {
      accion: 'parking.crear',
      entidad: 'Parking',
      entidadId: creado.id,
      parkingId: creado.id,
      datos: { nombre: creado.nombre, conOwner: Boolean(owner) },
    });

    res.status(201).json({ parking: aParkingAdmin(creado) });
  }),
);

/**
 * PATCH /api/v1/admin/parkings/:id
 * El OWNER solo puede tocar los campos operativos de su estacionamiento;
 * la comisión y la publicación quedan del lado de ColdevIA.
 */
router.patch(
  '/:id',
  requiereRol('SUPERADMIN', 'OWNER'),
  validar({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({ ...camposEditablesOwner, ...camposSoloSuperadmin }),
  }),
  asyncHandler(async (req, res) => {
    asegurarTenant(req, req.params.id);

    const datos = { ...req.body };

    if (req.usuario.role !== 'SUPERADMIN') {
      // Se descartan en silencio los campos reservados: si un OWNER los manda
      // (a mano o por un bug del frontend), simplemente no tienen efecto.
      for (const campo of Object.keys(camposSoloSuperadmin)) delete datos[campo];
    }

    if (datos.nombre) {
      datos.slug = await slugDisponible(generarSlug(datos.nombre), req.params.id);
    }

    const parking = await prisma.parking.update({
      where: { id: req.params.id },
      data: datos,
      include: { fotos: { orderBy: { orden: 'asc' } }, camposExtra: { orderBy: { orden: 'asc' } } },
    });

    await auditar(req, {
      accion: 'parking.editar',
      entidad: 'Parking',
      entidadId: parking.id,
      parkingId: parking.id,
      datos: Object.keys(datos),
    });

    res.json({ parking: aParkingAdmin(parking) });
  }),
);

/**
 * DELETE /api/v1/admin/parkings/:id
 * Baja lógica: no se borra nada, se desactiva. Las reservas históricas
 * y las comisiones tienen que seguir existiendo.
 */
router.delete(
  '/:id',
  requiereRol('SUPERADMIN'),
  validar({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const parking = await prisma.parking.update({
      where: { id: req.params.id },
      data: { activo: false, publicado: false },
    });

    await auditar(req, {
      accion: 'parking.baja',
      entidad: 'Parking',
      entidadId: parking.id,
      parkingId: parking.id,
    });

    res.json({ ok: true, mensaje: `${parking.nombre} quedó dado de baja.` });
  }),
);

/**
 * DELETE /api/v1/admin/parkings/:id/definitivo
 *
 * Eliminación permanente, distinta de la baja lógica de arriba.
 *
 * Qué pasa con cada cosa:
 *
 *  · Tarifas, fotos, campos extra y bloqueos de cupo → se borran. Sin el
 *    estacionamiento no describen nada.
 *  · Usuarios OWNER/STAFF que dependían solo de él → se desactivan y se les
 *    revocan los refresh tokens, así no pueden seguir operando sobre algo que
 *    ya no existe. No se borran: un usuario borrado se lleva su rastro en la
 *    auditoría.
 *  · Reservas → NO se borran. Son el historial contable. Antes
 *    de tocar nada se copia el nombre y la dirección en cada reserva, para que
 *    el comprobante siga siendo legible.
 *
 * Por eso hay dos caminos: sin reservas la fila se borra de verdad; con
 * reservas queda marcada con `eliminadoEn` como ancla de esas filas y se
 * esconde de todas las consultas. Para quien mira la plataforma el resultado
 * es el mismo: desaparece.
 *
 * Pide el nombre exacto en el body: es irreversible y no puede dispararse por
 * un clic de más.
 */
router.delete(
  '/:id/definitivo',
  requiereRol('SUPERADMIN'),
  validar({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({ confirmacion: z.string().min(1, 'Escribí el nombre para confirmar.') }),
  }),
  asyncHandler(async (req, res) => {
    const parking = await prisma.parking.findFirst({
      where: { id: req.params.id, eliminadoEn: null },
      include: { _count: { select: { reservas: true } } },
    });

    if (!parking) throw errores.noEncontrado('El estacionamiento');

    // Comparación tolerante con mayúsculas y espacios de más, estricta con todo
    // lo demás: es una confirmación, no un acertijo.
    const normalizar = (t) => String(t ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-AR');
    if (normalizar(req.body.confirmacion) !== normalizar(parking.nombre)) {
      throw errores.datosInvalidos(
        { campos: [{ campo: 'confirmacion', mensaje: 'El nombre no coincide.' }] },
        'El nombre no coincide. Escribilo igual que arriba para confirmar que querés eliminarlo.',
      );
    }

    const tieneHistorial = parking._count.reservas > 0;

    await prisma.$transaction(async (tx) => {
      if (tieneHistorial) {
        // La reserva deja de depender del estacionamiento para poder mostrarse.
        await tx.reservation.updateMany({
          where: { parkingId: parking.id },
          data: { parkingNombre: parking.nombre, parkingDireccion: parking.direccion },
        });
      }

      // Los usuarios propios quedan fuera de servicio en los dos caminos: si la
      // fila se borra, la cascada se los llevaría sin dejar rastro.
      const usuarios = await tx.user.findMany({
        where: { parkingId: parking.id },
        select: { id: true },
      });
      const idsUsuarios = usuarios.map((u) => u.id);

      if (idsUsuarios.length > 0) {
        await tx.refreshToken.deleteMany({ where: { userId: { in: idsUsuarios } } });
        await tx.user.updateMany({
          where: { id: { in: idsUsuarios } },
          data: { activo: false, parkingId: null },
        });
      }

      if (tieneHistorial) {
        await tx.rate.deleteMany({ where: { parkingId: parking.id } });
        await tx.parkingPhoto.deleteMany({ where: { parkingId: parking.id } });
        await tx.customFieldConfig.deleteMany({ where: { parkingId: parking.id } });
        await tx.capacityBlock.deleteMany({ where: { parkingId: parking.id } });

        await tx.parking.update({
          where: { id: parking.id },
          data: {
            eliminadoEn: new Date(),
            activo: false,
            publicado: false,
            // El slug se libera: si mañana se da de alta otro en la misma
            // dirección, no tiene por qué arrastrar un sufijo.
            slug: `eliminado-${parking.id}`,
          },
        });
      } else {
        // Sin historial que preservar, la cascada hace el resto.
        await tx.parking.delete({ where: { id: parking.id } });
      }
    });

    await auditar(req, {
      accion: 'parking.eliminado',
      entidad: 'Parking',
      entidadId: parking.id,
      datos: {
        nombre: parking.nombre,
        direccion: parking.direccion,
        reservasConservadas: parking._count.reservas,
        modo: tieneHistorial ? 'anclado_por_historial' : 'borrado_fisico',
      },
    });

    res.json({
      ok: true,
      mensaje: `${parking.nombre} se eliminó de la plataforma.`,
      reservasConservadas: parking._count.reservas,
    });
  }),
);

// ─────────────────────────── Fotos ───────────────────────────

/**
 * POST /api/v1/admin/parkings/:id/fotos
 * En la v1 se cargan por URL (no hay subida de archivos todavía).
 */
router.post(
  '/:id/fotos',
  requiereRol('SUPERADMIN', 'OWNER'),
  validar({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      url: z.string().trim().min(1, 'Indicá la URL de la foto.').max(500),
      alt: textoOpcional(150),
      portada: z.boolean().default(false),
    }),
  }),
  asyncHandler(async (req, res) => {
    asegurarTenant(req, req.params.id);

    const orden = await prisma.parkingPhoto.count({ where: { parkingId: req.params.id } });

    if (req.body.portada) {
      await prisma.parkingPhoto.updateMany({
        where: { parkingId: req.params.id },
        data: { portada: false },
      });
    }

    const foto = await prisma.parkingPhoto.create({
      data: { ...req.body, parkingId: req.params.id, orden },
    });

    res.status(201).json({ foto });
  }),
);

/**
 * POST /api/v1/admin/parkings/:id/fotos/archivos
 *
 * Sube fotos desde el dispositivo (multipart, campo `fotos`) a Cloudinary y
 * las agrega al estacionamiento. Es la forma de reponer las fotos que se
 * perdieron cuando vivían en el disco de Render. Sin Cloudinary configurado
 * responde 503 ALMACENAMIENTO_NO_CONFIGURADO, igual que el alta pública.
 */
router.post(
  '/:id/fotos/archivos',
  requiereRol('SUPERADMIN', 'OWNER'),
  (req, res, next) => {
    // El tenant se valida ANTES de leer los archivos: nadie sube nada a un
    // estacionamiento ajeno, ni siquiera a Cloudinary.
    try {
      asegurarTenant(req, req.params.id);
    } catch (error) {
      next(error);
      return;
    }
    subirFotosParking(req, res, (error) => next(error ? traducirErrorDeSubida(error) : undefined));
  },
  asyncHandler(async (req, res) => {
    const archivos = req.files ?? [];
    if (archivos.length === 0) throw errores.datosInvalidos(undefined, 'No llegó ninguna foto.');

    const yaHay = await prisma.parkingPhoto.count({ where: { parkingId: req.params.id } });
    if (yaHay + archivos.length > MAX_FOTOS) {
      throw errores.datosInvalidos(undefined, `Puede haber hasta ${MAX_FOTOS} fotos por estacionamiento.`);
    }

    const subidas = await guardarFotos(archivos);
    const fotos = await prisma.$transaction(
      subidas.map((s, i) =>
        prisma.parkingPhoto.create({
          data: {
            parkingId: req.params.id,
            url: s.url,
            orden: yaHay + i,
            // Si no había ninguna, la primera que se sube es la portada.
            portada: yaHay === 0 && i === 0,
          },
        }),
      ),
    );

    res.status(201).json({ fotos });
  }),
);

/**
 * DELETE /api/v1/admin/parkings/:id/fotos/:fotoId
 */
router.delete(
  '/:id/fotos/:fotoId',
  requiereRol('SUPERADMIN', 'OWNER'),
  validar({ params: z.object({ id: z.string().min(1), fotoId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    asegurarTenant(req, req.params.id);

    const borradas = await prisma.parkingPhoto.deleteMany({
      where: { id: req.params.fotoId, parkingId: req.params.id },
    });
    if (borradas.count === 0) throw errores.noEncontrado('La foto');

    res.json({ ok: true });
  }),
);

// ─────────────────── Campos extra configurables ───────────────────

/**
 * GET /api/v1/admin/parkings/:id/campos
 * Campos opcionales que este estacionamiento le pide al cliente.
 */
router.get(
  '/:id/campos',
  validar({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    asegurarTenant(req, req.params.id);
    const campos = await prisma.customFieldConfig.findMany({
      where: { parkingId: req.params.id },
      orderBy: { orden: 'asc' },
    });
    res.json({ campos });
  }),
);

/**
 * POST /api/v1/admin/parkings/:id/campos
 * Agregar un campo nuevo NO requiere migrar la base: se guarda en
 * Reservation.camposExtra (JSON).
 */
router.post(
  '/:id/campos',
  requiereRol('SUPERADMIN', 'OWNER'),
  validar({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      key: z
        .string()
        .trim()
        .regex(/^[a-z][a-z0-9_]{1,39}$/, 'Usá minúsculas, números y guiones bajos (ej: numero_socio).'),
      label: texto(80, 'La etiqueta'),
      ayuda: textoOpcional(200),
      tipo: z.enum(['TEXTO', 'NUMERO', 'SELECT', 'BOOLEAN']).default('TEXTO'),
      requerido: z.boolean().default(false),
      opciones: z.array(z.string().trim().max(60)).max(30).default([]),
      orden: z.coerce.number().int().min(0).default(0),
    }),
  }),
  asyncHandler(async (req, res) => {
    asegurarTenant(req, req.params.id);

    if (req.body.tipo === 'SELECT' && req.body.opciones.length === 0) {
      throw errores.datosInvalidos(
        { campos: [{ campo: 'opciones', mensaje: 'Un campo de tipo lista necesita al menos una opción.' }] },
        'Un campo de tipo lista necesita al menos una opción.',
      );
    }

    const campo = await prisma.customFieldConfig.create({
      data: { ...req.body, parkingId: req.params.id },
    });

    res.status(201).json({ campo });
  }),
);

/**
 * PATCH /api/v1/admin/parkings/:id/campos/:campoId
 */
router.patch(
  '/:id/campos/:campoId',
  requiereRol('SUPERADMIN', 'OWNER'),
  validar({
    params: z.object({ id: z.string().min(1), campoId: z.string().min(1) }),
    body: z.object({
      label: texto(80, 'La etiqueta').optional(),
      ayuda: textoOpcional(200),
      requerido: z.boolean().optional(),
      opciones: z.array(z.string().trim().max(60)).max(30).optional(),
      orden: z.coerce.number().int().min(0).optional(),
      activo: z.boolean().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    asegurarTenant(req, req.params.id);

    const existe = await prisma.customFieldConfig.findFirst({
      where: { id: req.params.campoId, parkingId: req.params.id },
    });
    if (!existe) throw errores.noEncontrado('El campo');

    const campo = await prisma.customFieldConfig.update({
      where: { id: req.params.campoId },
      data: req.body,
    });

    res.json({ campo });
  }),
);

/**
 * DELETE /api/v1/admin/parkings/:id/campos/:campoId
 */
router.delete(
  '/:id/campos/:campoId',
  requiereRol('SUPERADMIN', 'OWNER'),
  validar({ params: z.object({ id: z.string().min(1), campoId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    asegurarTenant(req, req.params.id);
    const borrados = await prisma.customFieldConfig.deleteMany({
      where: { id: req.params.campoId, parkingId: req.params.id },
    });
    if (borrados.count === 0) throw errores.noEncontrado('El campo');
    res.json({ ok: true });
  }),
);

// ─────────────────── Bloqueo de cupos ───────────────────

/**
 * GET /api/v1/admin/parkings/:id/bloqueos
 */
router.get(
  '/:id/bloqueos',
  validar({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    asegurarTenant(req, req.params.id);
    const bloqueos = await prisma.capacityBlock.findMany({
      where: { parkingId: req.params.id, hasta: { gte: new Date() } },
      orderBy: { desde: 'asc' },
    });
    res.json({ bloqueos });
  }),
);

/**
 * POST /api/v1/admin/parkings/:id/bloqueos
 * Reserva lugares para uso propio (abonados, mantenimiento, etc.).
 */
router.post(
  '/:id/bloqueos',
  requiereRol('SUPERADMIN', 'OWNER'),
  validar({
    params: z.object({ id: z.string().min(1) }),
    body: z
      .object({
        desde: z.string().refine((v) => !Number.isNaN(Date.parse(v))).transform((v) => new Date(v)),
        hasta: z.string().refine((v) => !Number.isNaN(Date.parse(v))).transform((v) => new Date(v)),
        lugares: z.coerce.number().int().min(1).max(10_000),
        motivo: textoOpcional(200),
      })
      .superRefine((d, ctx) => {
        if (d.hasta <= d.desde) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['hasta'],
            message: 'El fin del bloqueo tiene que ser posterior al inicio.',
          });
        }
      }),
  }),
  asyncHandler(async (req, res) => {
    asegurarTenant(req, req.params.id);

    const parking = await prisma.parking.findUnique({
      where: { id: req.params.id },
      select: { capacidadTotal: true },
    });
    if (!parking) throw errores.noEncontrado('El estacionamiento');

    if (req.body.lugares > parking.capacidadTotal) {
      throw errores.datosInvalidos(
        undefined,
        `No podés bloquear ${req.body.lugares} lugares: el estacionamiento tiene ${parking.capacidadTotal}.`,
      );
    }

    const bloqueo = await prisma.capacityBlock.create({
      data: { ...req.body, parkingId: req.params.id },
    });

    await auditar(req, {
      accion: 'parking.bloquear_cupo',
      entidad: 'CapacityBlock',
      entidadId: bloqueo.id,
      parkingId: req.params.id,
      datos: { lugares: bloqueo.lugares, desde: bloqueo.desde, hasta: bloqueo.hasta },
    });

    res.status(201).json({ bloqueo });
  }),
);

/**
 * DELETE /api/v1/admin/parkings/:id/bloqueos/:bloqueoId
 */
router.delete(
  '/:id/bloqueos/:bloqueoId',
  requiereRol('SUPERADMIN', 'OWNER'),
  validar({ params: z.object({ id: z.string().min(1), bloqueoId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    asegurarTenant(req, req.params.id);
    const borrados = await prisma.capacityBlock.deleteMany({
      where: { id: req.params.bloqueoId, parkingId: req.params.id },
    });
    if (borrados.count === 0) throw errores.noEncontrado('El bloqueo');
    res.json({ ok: true });
  }),
);

export { aParkingAdmin, generarSlug, slugDisponible };
export default router;
