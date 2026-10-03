/**
 * Alta de estacionamientos por autogestión.
 *
 *  · POST público → /api/v1/onboarding/parkings   (el dueño manda su solicitud)
 *  · Revisión     → /api/v1/admin/onboarding      (solo SUPERADMIN aprueba)
 *
 * El formulario público crea de una sola vez el estacionamiento y su usuario
 * OWNER, pero nace apagado: `estado = PENDIENTE_APROBACION`, `activo = false` y
 * `publicado = false`. Así no aparece en ninguna búsqueda ni deja entrar al
 * panel hasta que ColdevIA lo revisa a mano. Aprobarlo es lo que lo enciende.
 *
 * Es deliberado que esto no viva en parkings.admin.routes.js: ese router entero
 * pasa por `requiereAuth`, y acá el que escribe no tiene cuenta todavía.
 */
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../config/prisma.js';
import validar from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/error.js';
import { requiereAuth, requiereRol } from '../../middleware/auth.js';
import { limiteAltaEstacionamiento, limiteSubidaFotos } from '../../middleware/rateLimit.js';
import errores from '../../utils/errors.js';
import { auditar } from '../../services/audit.js';
import { hashearPassword } from '../auth/auth.service.js';
import { notificarAltaEstacionamiento } from '../../services/notifications/index.js';
import { aNumero } from '../../utils/money.js';
import { TIPOS_HORARIO } from '../../utils/horarios.js';
import {
  subirFotosParking,
  urlPublica,
  traducirErrorDeSubida,
  MAX_FOTOS,
} from '../../services/uploads.js';
import {
  texto,
  textoOpcional,
  latitud,
  longitud,
  vehicleType,
  email,
  password,
  telefono,
} from '../shared/schemas.js';
import { generarSlug, slugDisponible } from '../parkings/parkings.admin.routes.js';

export const routerPublico = Router();
export const routerAdmin = Router();

/** Horarios: mismo formato que usa el panel. */
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

/** Vista de una solicitud para la pantalla de revisión. */
function aSolicitud(p) {
  const duenio = p.usuarios?.find((u) => u.role === 'OWNER') ?? p.usuarios?.[0] ?? null;

  return {
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    direccion: p.direccion,
    barrio: p.barrio,
    ciudad: p.ciudad,
    lat: p.lat,
    lng: p.lng,
    telefono: p.telefono,
    email: p.email,
    capacidadTotal: p.capacidadTotal,
    cubierto: p.cubierto,
    tiposVehiculo: p.tiposVehiculo,
    servicios: p.servicios,
    tipoHorario: p.tipoHorario,
    horarios: p.horarios,
    comisionPorcentaje: aNumero(p.comisionPorcentaje),
    estado: p.estado,
    motivoRechazo: p.motivoRechazo,
    revisadoEn: p.revisadoEn,
    creadaEn: p.createdAt,
    fotos: (p.fotos ?? []).map((f) => ({ id: f.id, url: f.url, alt: f.alt })),
    duenio: duenio
      ? { id: duenio.id, nombre: duenio.nombre, email: duenio.email, telefono: duenio.telefono }
      : null,
  };
}

// ─────────────────────────── Público ───────────────────────────

/**
 * POST /api/v1/onboarding/fotos
 *
 * Sube las fotos del estacionamiento y devuelve sus URLs. Va separado del alta
 * para que el dueño vea la miniatura apenas elige el archivo, en vez de esperar
 * a mandar todo el formulario junto y descubrir ahí que una foto pesaba de más.
 *
 * Es público y sin cuenta, así que tiene su propio límite de tasa.
 */
routerPublico.post(
  '/fotos',
  limiteSubidaFotos,
  (req, res, next) => {
    subirFotosParking(req, res, (error) => {
      if (error) return next(traducirErrorDeSubida(error));
      return next();
    });
  },
  asyncHandler(async (req, res) => {
    const archivos = req.files ?? [];
    if (archivos.length === 0) {
      throw errores.datosInvalidos(undefined, 'No llegó ninguna foto.');
    }

    res.status(201).json({
      fotos: archivos.map((a) => ({
        url: urlPublica(a.filename),
        nombre: a.originalname,
        bytes: a.size,
      })),
    });
  }),
);

/**
 * POST /api/v1/onboarding/parkings
 * Solicitud de alta. No requiere cuenta: la cuenta se crea acá.
 */
routerPublico.post(
  '/parkings',
  limiteAltaEstacionamiento,
  validar({
    body: z.object({
      // ── Dueño ──
      duenio: z.object({
        nombre: texto(80, 'El nombre'),
        apellido: texto(80, 'El apellido'),
        email,
        telefono,
        password,
      }),
      // ── Estacionamiento ──
      parking: z.object({
        nombre: texto(120, 'El nombre comercial'),
        descripcion: textoOpcional(1000),
        direccion: texto(200, 'La dirección'),
        barrio: textoOpcional(80),
        ciudad: textoOpcional(80),
        lat: latitud,
        lng: longitud,
        googlePlaceId: textoOpcional(200),
        capacidadTotal: z.coerce
          .number({ required_error: 'La capacidad es obligatoria.' })
          .int('La capacidad tiene que ser un número entero.')
          .min(1, 'La capacidad tiene que ser al menos 1.')
          .max(10_000, 'Revisá la capacidad: parece demasiado alta.'),
        cubierto: z.boolean().default(false),
        tiposVehiculo: z
          .array(vehicleType)
          .min(1, 'Elegí al menos un tipo de vehículo.')
          .default(['AUTO']),
        servicios: z.array(z.string().trim().max(40)).max(20).default([]),
        tipoHorario: z
          .enum(TIPOS_HORARIO, { errorMap: () => ({ message: 'Elegí un modo de horario válido.' }) })
          .default('FIJO'),
        horarios: esquemaHorarios,
        // Al menos una foto, validado también acá y no solo en el formulario:
        // el endpoint es público y cualquiera puede postear sin pasar por la web.
        fotos: z
          .array(z.string().trim().url('Las fotos tienen que ser URLs válidas.'))
          .min(1, 'Subí al menos una foto de tu estacionamiento.')
          .max(MAX_FOTOS, `Podés subir hasta ${MAX_FOTOS} fotos.`),
      }),
      // ── Condiciones ──
      aceptaTerminos: z.literal(true, {
        errorMap: () => ({ message: 'Tenés que aceptar los términos para continuar.' }),
      }),
      aceptaComision: z.literal(true, {
        errorMap: () => ({ message: 'Tenés que aceptar la comisión del 10% para continuar.' }),
      }),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { duenio, parking } = req.body;

    // Se chequea antes de la transacción para devolver un error de campo
    // prolijo; adentro se vuelve a chequear por si entran dos a la vez.
    const yaExiste = await prisma.user.findUnique({
      where: { email: duenio.email },
      select: { id: true },
    });
    if (yaExiste) {
      throw errores.datosInvalidos(
        { campos: [{ campo: 'duenio.email', mensaje: 'Ya hay una cuenta con ese email.' }] },
        'Ya hay una cuenta registrada con ese email. Si es tuya, ingresá al panel.',
      );
    }

    const slug = await slugDisponible(generarSlug(parking.nombre));
    const passwordHash = await hashearPassword(duenio.password);
    const { fotos, ...datosParking } = parking;

    const creado = await prisma.$transaction(async (tx) => {
      const nuevo = await tx.parking.create({
        data: {
          ...datosParking,
          slug,
          horarios: datosParking.horarios ?? {},
          // El trío que lo mantiene invisible hasta la aprobación.
          estado: 'PENDIENTE_APROBACION',
          activo: false,
          publicado: false,
          fotos: {
            create: fotos.map((url, i) => ({ url, orden: i, portada: i === 0 })),
          },
        },
        include: { fotos: true },
      });

      const chocaEmail = await tx.user.findUnique({
        where: { email: duenio.email },
        select: { id: true },
      });
      if (chocaEmail) throw errores.conflicto('Ya hay una cuenta registrada con ese email.');

      await tx.user.create({
        data: {
          email: duenio.email,
          nombre: `${duenio.nombre} ${duenio.apellido}`,
          telefono: duenio.telefono,
          passwordHash,
          role: 'OWNER',
          parkingId: nuevo.id,
          // Se habilita al aprobar la solicitud.
          activo: false,
        },
      });

      return nuevo;
    });

    const completo = await prisma.parking.findUnique({
      where: { id: creado.id },
      include: { usuarios: true, fotos: { orderBy: { orden: 'asc' } } },
    });

    // El mail es un extra: si falla, la solicitud igual quedó guardada.
    const aviso = await notificarAltaEstacionamiento('recibida', {
      parking: completo,
      owner: { nombre: `${duenio.nombre} ${duenio.apellido}`, email: duenio.email },
    });

    await auditar(req, {
      accion: 'parking.solicitud',
      entidad: 'Parking',
      entidadId: completo.id,
      parkingId: completo.id,
      datos: { nombre: completo.nombre, email: duenio.email },
    });

    res.status(201).json({
      solicitud: {
        id: completo.id,
        nombre: completo.nombre,
        estado: completo.estado,
        email: duenio.email,
      },
      emailEnviado: aviso.estado,
      mensaje:
        'Recibimos tu solicitud. La revisamos a mano y te escribimos por email apenas esté lista.',
    });
  }),
);

// ─────────────────────────── Panel ───────────────────────────

routerAdmin.use(requiereAuth, requiereRol('SUPERADMIN'));

/**
 * GET /api/v1/admin/onboarding
 * Solicitudes, filtrables por estado. Por defecto, las pendientes.
 */
routerAdmin.get(
  '/',
  validar({
    query: z.object({
      estado: z.enum(['PENDIENTE_APROBACION', 'ACTIVO', 'RECHAZADO', 'TODAS']).default('PENDIENTE_APROBACION'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { estado } = req.datosQuery;

    const solicitudes = await prisma.parking.findMany({
      where: estado === 'TODAS' ? {} : { estado },
      include: {
        usuarios: { where: { role: 'OWNER' }, orderBy: { createdAt: 'asc' } },
        fotos: { orderBy: { orden: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const pendientes = await prisma.parking.count({ where: { estado: 'PENDIENTE_APROBACION' } });

    res.json({ solicitudes: solicitudes.map(aSolicitud), pendientes });
  }),
);

/**
 * GET /api/v1/admin/onboarding/pendientes
 *
 * Solo el número de solicitudes sin revisar. Lo consume el badge del menú
 * lateral, que se refresca cada tanto: traerse el listado completo para mostrar
 * un número sería tirar a la basura todas las fotos y los dueños de cada
 * solicitud en cada consulta.
 */
routerAdmin.get(
  '/pendientes',
  asyncHandler(async (_req, res) => {
    const pendientes = await prisma.parking.count({ where: { estado: 'PENDIENTE_APROBACION' } });
    res.json({ pendientes });
  }),
);

/**
 * POST /api/v1/admin/onboarding/:id/aprobar
 * Enciende el estacionamiento y habilita al dueño.
 */
routerAdmin.post(
  '/:id/aprobar',
  validar({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({ publicar: z.boolean().default(true) }),
  }),
  asyncHandler(async (req, res) => {
    const solicitud = await prisma.parking.findUnique({
      where: { id: req.params.id },
      include: { usuarios: { where: { role: 'OWNER' } } },
    });
    if (!solicitud) throw errores.noEncontrado('La solicitud');
    if (solicitud.estado === 'ACTIVO') {
      throw errores.conflicto('Esa solicitud ya estaba aprobada.');
    }

    const parking = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.parking.update({
        where: { id: req.params.id },
        data: {
          estado: 'ACTIVO',
          activo: true,
          publicado: req.body.publicar,
          motivoRechazo: null,
          revisadoEn: new Date(),
        },
        include: { usuarios: { where: { role: 'OWNER' } } },
      });

      // Sin esto el dueño sigue sin poder entrar al panel.
      await tx.user.updateMany({
        where: { parkingId: req.params.id, role: 'OWNER' },
        data: { activo: true },
      });

      return actualizado;
    });

    const duenio = parking.usuarios[0] ?? null;
    if (duenio) {
      await notificarAltaEstacionamiento('aprobada', { parking, owner: duenio });
    }

    await auditar(req, {
      accion: 'parking.aprobar',
      entidad: 'Parking',
      entidadId: parking.id,
      parkingId: parking.id,
      datos: { publicado: parking.publicado },
    });

    res.json({
      solicitud: aSolicitud({ ...parking, fotos: [] }),
      mensaje: `"${parking.nombre}" quedó aprobado${parking.publicado ? ' y publicado' : ''}.`,
    });
  }),
);

/**
 * POST /api/v1/admin/onboarding/:id/rechazar
 * No borra nada: deja el registro marcado y avisa al dueño.
 */
routerAdmin.post(
  '/:id/rechazar',
  validar({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({ motivo: textoOpcional(500) }),
  }),
  asyncHandler(async (req, res) => {
    const solicitud = await prisma.parking.findUnique({
      where: { id: req.params.id },
      select: { id: true, estado: true },
    });
    if (!solicitud) throw errores.noEncontrado('La solicitud');

    const parking = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.parking.update({
        where: { id: req.params.id },
        data: {
          estado: 'RECHAZADO',
          activo: false,
          publicado: false,
          motivoRechazo: req.body.motivo ?? null,
          revisadoEn: new Date(),
        },
        include: { usuarios: { where: { role: 'OWNER' } } },
      });

      await tx.user.updateMany({
        where: { parkingId: req.params.id, role: 'OWNER' },
        data: { activo: false },
      });

      return actualizado;
    });

    const duenio = parking.usuarios[0] ?? null;
    if (duenio) {
      await notificarAltaEstacionamiento('rechazada', {
        parking,
        owner: duenio,
        motivo: req.body.motivo,
      });
    }

    await auditar(req, {
      accion: 'parking.rechazar',
      entidad: 'Parking',
      entidadId: parking.id,
      parkingId: parking.id,
      datos: { motivo: req.body.motivo ?? null },
    });

    res.json({
      solicitud: aSolicitud({ ...parking, fotos: [] }),
      mensaje: `"${parking.nombre}" quedó marcado como rechazado.`,
    });
  }),
);

export default { routerPublico, routerAdmin };
