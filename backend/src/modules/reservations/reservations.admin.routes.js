/**
 * Rutas del panel para reservas: /api/v1/admin/reservations
 *
 * TODAS las consultas pasan por `filtroTenant(req)`, que limita los resultados
 * al estacionamiento del usuario. El SUPERADMIN es el único que puede ver más
 * de uno, y solo si lo pide explícitamente con ?parkingId=.
 */
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../config/prisma.js';
import * as servicio from './reservations.service.js';
import validar from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/error.js';
import { requiereAuth, requiereRol, filtroTenant, asegurarTenant, parkingDelUsuario } from '../../middleware/auth.js';
import errores, { AppError } from '../../utils/errors.js';
import { auditar } from '../../services/audit.js';
import {
  texto,
  textoOpcional,
  patente,
  telefono,
  emailOpcional,
  vehicleType,
  reservationStatus,
  paginacion,
} from '../shared/schemas.js';
import {
  mensajeGrupoWhatsApp,
  mensajeResumenDelDia,
  mensajeClienteWhatsApp,
  linkWhatsApp,
  urlComprobante,
  notificarGrupoWhatsApp,
} from '../../services/notifications/index.js';
import { generarCSV, nombreArchivoCSV } from '../../utils/csv.js';
import {
  inicioDelDia,
  finDelDia,
  formatearFechaHora,
  formatearFecha,
  formatearHora,
} from '../../utils/dates.js';
import { formatearPatente } from '../../utils/patente.js';
import { normalizarCodigo } from '../../utils/codes.js';
import { requierePagoPrevio } from '../../services/payments/index.js';
import { calcularPrecio } from '../../services/pricing.js';

const router = Router();

// Todo lo de acá para abajo exige sesión iniciada.
router.use(requiereAuth);

const fecha = (etiqueta) =>
  z
    .string({ required_error: `${etiqueta} es obligatoria.` })
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: `${etiqueta} no es válida.` })
    .transform((v) => new Date(v));

const fechaOpcional = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'La fecha no es válida.' })
  .transform((v) => new Date(v))
  .optional();

/** Filtros del listado. */
const esquemaListado = z.object({
  q: z.string().trim().max(80).optional(),
  estado: z
    .union([reservationStatus, z.array(reservationStatus)])
    .optional()
    .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v])),
  desde: fechaOpcional,
  hasta: fechaOpcional,
  parkingId: z.string().optional(),
  orden: z.enum(['INICIO_ASC', 'INICIO_DESC', 'CREADA_DESC', 'PRECIO_DESC']).default('INICIO_DESC'),
  ...paginacion,
});

/** Construye el `where` de Prisma a partir de los filtros + el tenant. */
function armarWhere(req, filtros) {
  const where = { ...filtroTenant(req) };

  // Las reservas que esperan la seña (PENDIENTE) no aparecen salvo que se las
  // pida explícitamente con el filtro de estado: para el estacionamiento no son
  // clientes que van a llegar. Así la vista por defecto ("Todos") muestra solo
  // reservas con la seña pagada, y los totales de arriba no suman plata que
  // todavía no entró.
  if (filtros.estado?.length) where.estado = { in: filtros.estado };
  else Object.assign(where, servicio.SOLO_CON_SENA);

  if (filtros.desde || filtros.hasta) {
    // Se filtra por solapamiento con el rango pedido, no por fecha de creación:
    // "las reservas del sábado" son las que ocupan lugar ese día.
    where.AND = [
      ...(filtros.hasta ? [{ inicio: { lte: finDelDia(filtros.hasta) } }] : []),
      ...(filtros.desde ? [{ fin: { gte: inicioDelDia(filtros.desde) } }] : []),
    ];
  }

  if (filtros.q) {
    const q = filtros.q.trim();
    const codigo = normalizarCodigo(q);
    const digitos = q.replace(/\D/g, '');
    const patenteQ = q.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const or = [
      { codigo: { contains: q.toUpperCase() } },
      { customer: { nombre: { contains: q, mode: 'insensitive' } } },
      { customer: { apellido: { contains: q, mode: 'insensitive' } } },
    ];
    if (codigo) or.push({ codigo: { equals: codigo } });
    if (patenteQ) or.push({ vehicle: { patente: { contains: patenteQ } } });
    if (digitos.length >= 4) or.push({ customer: { telefono: { contains: digitos } } });

    where.OR = or;
  }

  return where;
}

const ORDENES = {
  INICIO_ASC: { inicio: 'asc' },
  INICIO_DESC: { inicio: 'desc' },
  CREADA_DESC: { createdAt: 'desc' },
  PRECIO_DESC: { precioTotal: 'desc' },
};

/**
 * Antes de listar, se le pregunta a Mercado Pago por las señas recientes que
 * siguen sin acreditar.
 *
 * El camino normal es el webhook, pero puede no llegar (en desarrollo nunca
 * llega: Mercado Pago no alcanza un localhost) y el cliente puede cerrar la
 * pestaña apenas paga, sin volver a la pantalla que consulta. Sin esto, una
 * reserva ya pagada quedaba escondida del estacionamiento. Si el pago está
 * aprobado, acá mismo se confirma y salen el comprobante y el aviso al grupo.
 *
 * Acotado a propósito —las del último día, de a 10— para no convertir cada
 * carga del panel en una ráfaga de llamadas a la pasarela.
 */
async function reconciliarSenasPendientes(req) {
  if (!requierePagoPrevio()) return;
  const pendientes = await prisma.reservation.findMany({
    where: {
      ...filtroTenant(req),
      estado: servicio.SIN_SENA,
      paymentStatus: { not: 'PAGADO' },
      createdAt: { gte: new Date(Date.now() - 24 * 3_600_000) },
    },
    include: servicio.INCLUDE_COMPLETO,
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  await Promise.all(
    pendientes.map((r) =>
      servicio.sincronizarPago(r).catch((e) => console.error('[pagos] reconciliación', r.codigo, e.message)),
    ),
  );
}

/**
 * GET /api/v1/admin/reservations
 * Listado con búsqueda, filtros y paginación.
 */
router.get(
  '/',
  validar({ query: esquemaListado }),
  asyncHandler(async (req, res) => {
    const filtros = req.datosQuery;
    const where = armarWhere(req, filtros);

    await reconciliarSenasPendientes(req);

    const [total, reservas, totales] = await Promise.all([
      prisma.reservation.count({ where }),
      prisma.reservation.findMany({
        where,
        include: servicio.INCLUDE_COMPLETO,
        orderBy: ORDENES[filtros.orden],
        skip: (filtros.pagina - 1) * filtros.porPagina,
        take: filtros.porPagina,
      }),
      prisma.reservation.aggregate({
        // AND y no spread: el spread pisaba el filtro de estado del listado y los
        // totales sumaban reservas sin seña que la tabla no mostraba.
        where: { AND: [where, { estado: { notIn: ['CANCELADA', 'NO_SHOW'] } }] },
        _sum: { precioTotal: true, montoComision: true, montoNeto: true },
      }),
    ]);

    res.json({
      reservas: reservas.map((r) => servicio.aReservaAdmin(r, req.usuario.role)),
      paginacion: {
        pagina: filtros.pagina,
        porPagina: filtros.porPagina,
        total,
        paginas: Math.max(1, Math.ceil(total / filtros.porPagina)),
      },
      // El total facturado y la seña son de SpotNear: al estacionamiento solo
      // le llega lo que le corresponde.
      totales:
        req.usuario.role === 'SUPERADMIN'
          ? {
              precioTotal: Number(totales._sum.precioTotal ?? 0),
              montoComision: Number(totales._sum.montoComision ?? 0),
              montoNeto: Number(totales._sum.montoNeto ?? 0),
            }
          : { montoNeto: Number(totales._sum.montoNeto ?? 0) },
    });
  }),
);

/**
 * GET /api/v1/admin/reservations/buscar?q=
 * Búsqueda rápida por código o patente, para el ingreso.
 */
router.get(
  '/buscar',
  validar({ query: z.object({ q: z.string().trim().min(3, 'Escribí al menos 3 caracteres.'), parkingId: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const reservas = await servicio.busquedaRapida(req.datosQuery.q, filtroTenant(req));
    res.json({ reservas: reservas.map((r) => servicio.aReservaAdmin(r, req.usuario.role)) });
  }),
);

/**
 * GET /api/v1/admin/reservations/exportar.csv
 * Exporta el listado filtrado a CSV (se abre bien en Excel en español).
 */
router.get(
  '/exportar.csv',
  validar({ query: esquemaListado.omit({ pagina: true, porPagina: true }) }),
  asyncHandler(async (req, res) => {
    const where = armarWhere(req, req.datosQuery);

    const reservas = await prisma.reservation.findMany({
      where,
      include: servicio.INCLUDE_COMPLETO,
      orderBy: { inicio: 'desc' },
      take: 5000, // tope de seguridad
    });

    const esSuperadmin = req.usuario.role === 'SUPERADMIN';

    const columnas = [
      { key: 'codigo', label: 'Código' },
      { key: 'estado', label: 'Estado' },
      { key: 'inicio', label: 'Ingreso', format: (r) => formatearFechaHora(r.inicio) },
      { key: 'fin', label: 'Salida', format: (r) => formatearFechaHora(r.fin) },
      // Nombre y email de la reserva, no del contacto compartido por teléfono.
      { key: 'nombre', label: 'Nombre', format: (r) => { const c = servicio.clienteParaMostrar(r); return `${c.nombre} ${c.apellido}`; } },
      { key: 'telefono', label: 'Teléfono', format: (r) => r.customer.telefono },
      { key: 'email', label: 'Email', format: (r) => servicio.clienteParaMostrar(r).email ?? '' },
      { key: 'patente', label: 'Patente', format: (r) => formatearPatente(r.vehicle.patente) },
      { key: 'tipo', label: 'Tipo', format: (r) => r.vehicle.tipo },
      {
        key: 'vehiculo',
        label: 'Marca y modelo',
        format: (r) => [r.vehicle.marca, r.vehicle.modelo].filter(Boolean).join(' '),
      },
      { key: 'color', label: 'Color', format: (r) => r.vehicle.color ?? '' },
      { key: 'cantidadVehiculos', label: 'Vehículos' },
      { key: 'origen', label: 'Origen', format: (r) => r.source },
      { key: 'checkIn', label: 'Check-in', format: (r) => (r.checkInAt ? formatearFechaHora(r.checkInAt) : '') },
      { key: 'checkOut', label: 'Check-out', format: (r) => (r.checkOutAt ? formatearFechaHora(r.checkOutAt) : '') },
      { key: 'notas', label: 'Notas', format: (r) => r.notas ?? '' },
      { key: 'creada', label: 'Creada', format: (r) => formatearFechaHora(r.createdAt) },
    ];

    // El total con la seña y la comisión solo se exportan al SUPERADMIN: para el
    // estacionamiento la reserva vale lo que cobra en el lugar.
    columnas.splice(
      14,
      0,
      {
        key: 'montoNeto',
        label: esSuperadmin ? 'Neto estacionamiento' : 'A cobrar en el lugar',
        format: (r) => Number(r.montoNeto).toFixed(2),
      },
      ...(esSuperadmin
        ? [
            { key: 'precioTotal', label: 'Total', format: (r) => Number(r.precioTotal).toFixed(2) },
            { key: 'comisionPorcentaje', label: 'Comisión %', format: (r) => Number(r.comisionPorcentaje).toFixed(2) },
            { key: 'montoComision', label: 'Comisión $', format: (r) => Number(r.montoComision).toFixed(2) },
          ]
        : []),
    );

    if (esSuperadmin) {
      columnas.unshift({ key: 'parking', label: 'Estacionamiento', format: (r) => r.parking.nombre });
    }

    const csv = generarCSV(columnas, reservas);
    const nombreBase = esSuperadmin ? 'reservas-spotnear' : `reservas-${reservas[0]?.parking?.slug ?? 'estacionamiento'}`;

    await auditar(req, {
      accion: 'reserva.exportar_csv',
      entidad: 'Reservation',
      datos: { cantidad: reservas.length },
    });

    res
      .type('text/csv; charset=utf-8')
      .set('Content-Disposition', `attachment; filename="${nombreArchivoCSV(nombreBase)}"`)
      .send(csv);
  }),
);

/**
 * GET /api/v1/admin/reservations/resumen-dia
 * Mensaje único con todas las reservas del día, listo para pegar en el grupo.
 */
router.get(
  '/resumen-dia',
  validar({ query: z.object({ fecha: fechaOpcional, parkingId: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const dia = req.datosQuery.fecha ?? new Date();
    const where = {
      ...filtroTenant(req),
      // Al grupo solo van las reservas que existen: con la seña pagada.
      ...servicio.SOLO_CON_SENA,
      inicio: { lte: finDelDia(dia) },
      fin: { gte: inicioDelDia(dia) },
    };

    const reservas = await prisma.reservation.findMany({
      where,
      include: servicio.INCLUDE_COMPLETO,
      orderBy: { inicio: 'asc' },
    });

    const parkingId = parkingDelUsuario(req);
    const parking = parkingId
      ? await prisma.parking.findUnique({
          where: { id: parkingId },
          select: { nombre: true, whatsappGrupo: true },
        })
      : null;

    const mensaje = mensajeResumenDelDia(reservas, dia, parking?.nombre ?? '');

    res.json({
      fecha: dia,
      cantidad: reservas.length,
      mensaje,
      link: linkWhatsApp(parking?.whatsappGrupo ?? '', mensaje),
    });
  }),
);

/**
 * Reservas "nuevas" para un usuario: las que se confirmaron (seña acreditada,
 * o creadas ya confirmadas) DESPUÉS de la última vez que abrió el listado de
 * Reservas, y que todavía están por atenderse (confirmadas o en curso). Las
 * que cargó él mismo desde el panel no cuentan: ya las vio.
 *
 * Se mide contra `pagadaEn` y no contra `createdAt` porque una reserva con
 * Mercado Pago nace pendiente y se confirma después: para el estacionamiento
 * es "nueva" cuando se confirma, no cuando el cliente empezó a pagar.
 */
function whereNuevas(req, desde) {
  return {
    parkingId: parkingDelUsuario(req),
    estado: { in: ['CONFIRMADA', 'EN_CURSO'] },
    AND: [
      { OR: [{ pagadaEn: { gt: desde } }, { pagadaEn: null, createdAt: { gt: desde } }] },
      { OR: [{ createdByUserId: null }, { createdByUserId: { not: req.usuario.id } }] },
    ],
  };
}

/**
 * GET /api/v1/admin/reservations/nuevas
 * El número del contador azul junto a "Reservas" en el menú (OWNER y STAFF).
 * El SUPERADMIN no tiene un estacionamiento propio: para él es siempre 0.
 */
router.get(
  '/nuevas',
  asyncHandler(async (req, res) => {
    if (!parkingDelUsuario(req)) return res.json({ nuevas: 0 });

    const usuario = await prisma.user.findUnique({
      where: { id: req.usuario.id },
      select: { reservasVistasEn: true, createdAt: true },
    });
    // Si nunca abrió la lista, cuenta desde que tiene la cuenta.
    const desde = usuario?.reservasVistasEn ?? usuario?.createdAt ?? new Date(0);

    res.json({ nuevas: await prisma.reservation.count({ where: whereNuevas(req, desde) }) });
  }),
);

/**
 * POST /api/v1/admin/reservations/vistas
 * Marca como vistas las reservas nuevas: lo llama la pantalla de Reservas al
 * abrirse, y el contador vuelve a 0.
 */
router.post(
  '/vistas',
  asyncHandler(async (req, res) => {
    await prisma.user.update({ where: { id: req.usuario.id }, data: { reservasVistasEn: new Date() } });
    res.json({ ok: true });
  }),
);

/**
 * GET /api/v1/admin/reservations/:id
 */
router.get(
  '/:id',
  validar({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const reserva = await prisma.reservation.findFirst({
      where: { id: req.params.id, ...filtroTenant(req) },
      include: { ...servicio.INCLUDE_COMPLETO, notificaciones: { orderBy: { createdAt: 'desc' } } },
    });

    if (!reserva) throw errores.noEncontrado('La reserva');

    res.json({
      reserva: servicio.aReservaAdmin(reserva, req.usuario.role),
      links: {
        comprobante: urlComprobante(reserva),
        whatsappCliente: linkWhatsApp(reserva.customer.telefono, mensajeClienteWhatsApp(reserva)),
        whatsappGrupo: linkWhatsApp(reserva.parking.whatsappGrupo ?? '', mensajeGrupoWhatsApp(reserva)),
      },
      notificaciones: reserva.notificaciones.map((n) => ({
        id: n.id,
        canal: n.canal,
        destino: n.destino,
        estado: n.estado,
        createdAt: n.createdAt,
      })),
    });
  }),
);

/**
 * POST /api/v1/admin/reservations
 * Alta manual desde el panel (las que llegan por teléfono o WhatsApp).
 */
router.post(
  '/',
  validar({
    body: z
      .object({
        parkingId: z.string().optional(),
        inicio: fecha('La hora de ingreso'),
        fin: fecha('La hora de salida'),
        cliente: z.object({
          nombre: texto(60, 'El nombre'),
          apellido: texto(60, 'El apellido'),
          telefono,
          email: emailOpcional,
        }),
        vehiculo: z.object({
          patente,
          tipo: vehicleType.default('AUTO'),
          marca: textoOpcional(40),
          modelo: textoOpcional(40),
          color: textoOpcional(30),
        }),
        cantidadVehiculos: z.coerce.number().int().min(1).max(20).default(1),
        notas: textoOpcional(500),
        camposExtra: z.record(z.unknown()).default({}),
        source: z.enum(['ADMIN', 'WHATSAPP', 'TELEFONO']).default('ADMIN'),
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
    // El OWNER/STAFF no puede cargar reservas en otro estacionamiento.
    const parkingId = req.body.parkingId ?? req.usuario.parkingId;
    if (!parkingId) throw errores.datosInvalidos(undefined, 'Indicá el estacionamiento.');
    asegurarTenant(req, parkingId);

    const reserva = await servicio.crearReserva({
      ...req.body,
      parkingId,
      createdByUserId: req.usuario.id,
      desdePanel: true,
    });

    await auditar(req, {
      accion: 'reserva.alta_manual',
      entidad: 'Reservation',
      entidadId: reserva.id,
      parkingId,
      datos: { codigo: reserva.codigo, source: req.body.source },
    });

    res.status(201).json({
      reserva: servicio.aReservaAdmin(reserva, req.usuario.role),
      links: {
        comprobante: urlComprobante(reserva),
        whatsappCliente: linkWhatsApp(reserva.customer.telefono, mensajeClienteWhatsApp(reserva)),
        whatsappGrupo: linkWhatsApp(reserva.parking.whatsappGrupo ?? '', mensajeGrupoWhatsApp(reserva)),
      },
    });
  }),
);

/** Acciones rápidas de estado. */
const ACCIONES = {
  'check-in': { estado: 'EN_CURSO', accion: 'reserva.checkin' },
  'check-out': { estado: 'FINALIZADA', accion: 'reserva.checkout' },
  confirmar: { estado: 'CONFIRMADA', accion: 'reserva.confirmar' },
  cancelar: { estado: 'CANCELADA', accion: 'reserva.cancelar' },
  'no-show': { estado: 'NO_SHOW', accion: 'reserva.no_show' },
};

/**
 * POST /api/v1/admin/reservations/:id/:accion
 * accion ∈ check-in | check-out | confirmar | cancelar | no-show
 */
router.post(
  '/:id/:accion',
  validar({
    params: z.object({
      id: z.string().min(1),
      accion: z.enum(['check-in', 'check-out', 'confirmar', 'cancelar', 'no-show']),
    }),
    body: z.object({ motivo: textoOpcional(200) }),
  }),
  asyncHandler(async (req, res) => {
    const { estado, accion } = ACCIONES[req.params.accion];

    const reserva = await servicio.cambiarEstado(req.params.id, estado, {
      motivo: req.body.motivo ?? null,
      filtroTenant: filtroTenant(req),
    });

    await auditar(req, {
      accion,
      entidad: 'Reservation',
      entidadId: reserva.id,
      parkingId: reserva.parkingId,
      datos: { codigo: reserva.codigo, estado },
    });

    res.json({ reserva: servicio.aReservaAdmin(reserva, req.usuario.role) });
  }),
);

/**
 * GET /api/v1/admin/reservations/:id/whatsapp
 * Mensaje formateado + link para compartir la reserva en el grupo.
 */
router.get(
  '/:id/whatsapp',
  validar({
    params: z.object({ id: z.string().min(1) }),
    query: z.object({ destino: z.enum(['grupo', 'cliente']).default('grupo') }),
  }),
  asyncHandler(async (req, res) => {
    const reserva = await prisma.reservation.findFirst({
      where: { id: req.params.id, ...filtroTenant(req) },
      include: servicio.INCLUDE_COMPLETO,
    });

    if (!reserva) throw errores.noEncontrado('La reserva');

    const esGrupo = req.datosQuery.destino === 'grupo';
    const mensaje = esGrupo ? mensajeGrupoWhatsApp(reserva) : mensajeClienteWhatsApp(reserva);
    const numero = esGrupo ? (reserva.parking.whatsappGrupo ?? '') : reserva.customer.telefono;

    res.json({ mensaje, link: linkWhatsApp(numero, mensaje), destino: req.datosQuery.destino });
  }),
);

/**
 * POST /api/v1/admin/reservations/:id/notificar-grupo
 * Deja registro de que la reserva se compartió al grupo (y la envía de verdad
 * si algún día se activa la Cloud API).
 */
router.post(
  '/:id/notificar-grupo',
  validar({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const reserva = await prisma.reservation.findFirst({
      where: { id: req.params.id, ...filtroTenant(req) },
      include: servicio.INCLUDE_COMPLETO,
    });

    if (!reserva) throw errores.noEncontrado('La reserva');

    const resultado = await notificarGrupoWhatsApp(reserva);
    res.json({ estado: resultado.estado, link: resultado.link, mensaje: resultado.texto });
  }),
);

/**
 * DELETE /api/v1/admin/reservations/:id
 *
 * Saca del panel una reserva que ya terminó, para que el listado no crezca
 * para siempre. La pueden usar el OWNER y el STAFF de ese estacionamiento y el
 * SUPERADMIN.
 *
 * Solo para reservas TERMINADAS (`servicio.ESTADOS_ELIMINABLES`: finalizada,
 * cancelada, no se presentó). Una pendiente, confirmada o en curso es
 * actividad real que todavía no pasó: se cancela, no se hace desaparecer.
 *
 * Es un BORRADO LÓGICO, siempre: se marca `eliminadaEn` y la fila queda.
 * Desaparece de las pantallas operativas (listado, detalle, búsqueda,
 * dashboard), pero el reporte de Comisiones y su exportación la siguen
 * contando: una reserva finalizada es facturación que existió, y borrarla de
 * verdad falsearía lo ya facturado. El link del comprobante del cliente
 * también sigue funcionando.
 */
router.delete(
  '/:id',
  requiereRol('SUPERADMIN', 'OWNER', 'STAFF'),
  validar({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const reserva = await prisma.reservation.findFirst({
      // El filtro de tenant va en la consulta: la reserva de otro
      // estacionamiento, para un OWNER o un STAFF, simplemente no existe.
      where: { id: req.params.id, ...filtroTenant(req) },
      select: { id: true, codigo: true, parkingId: true, estado: true, paymentStatus: true },
    });
    if (!reserva) throw errores.noEncontrado('La reserva');

    if (!servicio.ESTADOS_ELIMINABLES.includes(reserva.estado)) {
      throw new AppError(
        'Solo se pueden eliminar reservas finalizadas, canceladas o de clientes que no se presentaron. Si esta no va a ocurrir, primero cancelala.',
        409,
        'RESERVA_ACTIVA',
      );
    }

    await prisma.reservation.update({
      where: { id: reserva.id },
      data: { eliminadaEn: new Date() },
    });

    await auditar(req, {
      accion: 'reserva.eliminar',
      entidad: 'Reservation',
      entidadId: reserva.id,
      parkingId: reserva.parkingId,
      datos: { codigo: reserva.codigo, estado: reserva.estado, modo: 'borrado_logico' },
    });

    res.json({
      ok: true,
      mensaje: `La reserva ${reserva.codigo} se quitó del listado. Sigue contando en el reporte de Comisiones.`,
    });
  }),
);

/**
 * PATCH /api/v1/admin/reservations/:id
 * Edición acotada: notas y datos de contacto. El horario y el precio no se
 * tocan acá porque cambiarlos exige revalidar cupo y recalcular comisión.
 */
router.patch(
  '/:id',
  requiereRol('SUPERADMIN', 'OWNER'),
  validar({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      notas: textoOpcional(500),
      paymentStatus: z.enum(['PENDIENTE', 'PAGADO', 'FALLIDO', 'REEMBOLSADO']).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const existe = await prisma.reservation.findFirst({
      where: { id: req.params.id, ...filtroTenant(req) },
      select: { id: true, parkingId: true, estado: true },
    });
    if (!existe) throw errores.noEncontrado('La reserva');

    // El estado del pago de una reserva que espera la seña lo decide Mercado
    // Pago, no el panel: marcarla "Pagado" a mano emitiría un comprobante por
    // una seña que nunca entró. Las notas sí se pueden editar.
    if (existe.estado === servicio.SIN_SENA && req.body.paymentStatus) {
      throw errores.conflicto(
        'El pago de la seña de esta reserva lo confirma Mercado Pago. No se puede cambiar a mano.',
      );
    }

    const reserva = await prisma.reservation.update({
      where: { id: req.params.id },
      data: req.body,
      include: servicio.INCLUDE_COMPLETO,
    });

    await auditar(req, {
      accion: 'reserva.editar',
      entidad: 'Reservation',
      entidadId: reserva.id,
      parkingId: reserva.parkingId,
      datos: req.body,
    });

    res.json({ reserva: servicio.aReservaAdmin(reserva, req.usuario.role) });
  }),
);

/**
 * PATCH /api/v1/admin/reservations/:id/vehiculo
 *
 * Corrige el tipo de vehículo, típicamente en el check-in: el cliente cargó
 * "Auto" (o una marca/modelo que el catálogo clasificó así) y en la entrada se
 * ve que es una camioneta.
 *
 * El ajuste de precio es automático y solo sobre lo que se paga en el lugar:
 * se recalcula la tarifa con el tipo nuevo (mismos escalones, mismo horario) y
 * la diferencia se suma (o resta) a lo que el cliente le paga al
 * estacionamiento al llegar. La seña ya cobrada no se toca: entró por Mercado
 * Pago y no es reembolsable. La respuesta trae la diferencia para que el
 * playero sepa cuánto cobrar de más.
 */
router.patch(
  '/:id/vehiculo',
  validar({ params: z.object({ id: z.string().min(1) }), body: z.object({ tipo: vehicleType }) }),
  asyncHandler(async (req, res) => {
    const reserva = await prisma.reservation.findFirst({
      where: { id: req.params.id, ...filtroTenant(req) },
      include: servicio.INCLUDE_COMPLETO,
    });
    if (!reserva) throw errores.noEncontrado('La reserva');

    if (!['CONFIRMADA', 'EN_CURSO'].includes(reserva.estado)) {
      throw errores.conflicto('El tipo de vehículo se corrige en reservas confirmadas o en curso.');
    }

    const { tipo } = req.body;
    const anterior = reserva.vehicle.tipo;
    if (tipo === anterior) return res.json({ reserva: servicio.aReservaAdmin(reserva, req.usuario.role), ajuste: null });

    const parking = await prisma.parking.findUnique({
      where: { id: reserva.parkingId },
      include: { tarifas: true },
    });
    if (!parking.tiposVehiculo.includes(tipo)) {
      throw new AppError('Este estacionamiento no acepta ese tipo de vehículo.', 422, 'VEHICULO_NO_ACEPTADO');
    }

    // Mismo cálculo que al reservar: el motor central de precios, con el
    // porcentaje congelado en la reserva.
    const precio = calcularPrecio({
      parking: { comisionPorcentaje: reserva.comisionPorcentaje, moneda: reserva.moneda },
      tarifas: parking.tarifas,
      inicio: reserva.inicio,
      fin: reserva.fin,
      vehicleType: tipo,
      cantidadVehiculos: reserva.cantidadVehiculos,
    });

    const subtotalAnterior = Number(reserva.subtotal);
    const subtotalNuevo = precio.subtotal;
    const sena = Number(reserva.montoComision);

    const [, actualizada] = await prisma.$transaction([
      prisma.vehicle.update({ where: { id: reserva.vehicleId }, data: { tipo } }),
      prisma.reservation.update({
        where: { id: reserva.id },
        data: {
          subtotal: subtotalNuevo,
          montoNeto: subtotalNuevo,
          precioTotal: subtotalNuevo + sena,
          desglosePrecio: { ...precio.desglose, sena, ajustePorTipoDeVehiculo: { de: anterior, a: tipo } },
        },
        include: servicio.INCLUDE_COMPLETO,
      }),
    ]);

    const ajuste = {
      tipoAnterior: anterior,
      tipoNuevo: tipo,
      aPagarEnElLugarAntes: subtotalAnterior,
      aPagarEnElLugarAhora: subtotalNuevo,
      diferencia: subtotalNuevo - subtotalAnterior,
    };

    await auditar(req, {
      accion: 'reserva.corregir_vehiculo',
      entidad: 'Reservation',
      entidadId: reserva.id,
      parkingId: reserva.parkingId,
      datos: ajuste,
    });

    res.json({ reserva: servicio.aReservaAdmin(actualizada, req.usuario.role), ajuste });
  }),
);

export default router;
