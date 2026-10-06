/**
 * Panel · Dashboard y reportes: /api/v1/admin/reports
 *
 * El reporte de comisiones es el que le importa a ColdevIA: cuánto factura la
 * plataforma por estacionamiento y por período. El OWNER ve solo su resumen
 * (cuánto le queda neto), no el total del negocio.
 */
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../config/prisma.js';
import validar from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/error.js';
import { requiereAuth, requiereRol, filtroTenant, parkingDelUsuario } from '../../middleware/auth.js';
import { ocupacionActual } from '../../services/availability.js';
import { inicioDelDia, finDelDia, sumarDias, claveDia } from '../../utils/dates.js';
import { aReservaAdmin, INCLUDE_COMPLETO } from '../reservations/reservations.service.js';
import { generarCSV, nombreArchivoCSV } from '../../utils/csv.js';
import { auditar } from '../../services/audit.js';

const router = Router();
router.use(requiereAuth);

const fechaOpcional = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'La fecha no es válida.' })
  .transform((v) => new Date(v))
  .optional();

/** Estados que cuentan como reserva "viva" para los números del negocio. */
/**
 * Estados que cuentan en reportes y dashboard. PENDIENTE quedó afuera: desde
 * que la seña se cobra por adelantado, PENDIENTE es una reserva cuya seña
 * todavía no entró, así que ni es un ingreso ni es un cliente que va a llegar.
 */
const ESTADOS_VALIDOS = ['CONFIRMADA', 'EN_CURSO', 'FINALIZADA'];

/**
 * GET /api/v1/admin/reports/dashboard
 * Todo lo que se ve al abrir el panel, en una sola llamada.
 */
router.get(
  '/dashboard',
  validar({ query: z.object({ parkingId: z.string().optional(), dias: z.coerce.number().int().min(7).max(60).default(14) }) }),
  asyncHandler(async (req, res) => {
    const tenant = filtroTenant(req);
    const parkingId = parkingDelUsuario(req);

    const hoy = new Date();
    const desdeHoy = inicioDelDia(hoy);
    const hastaHoy = finDelDia(hoy);
    const desdeGrafico = inicioDelDia(sumarDias(hoy, -(req.datosQuery.dias - 1)));

    const [reservasHoy, totalesHoy, proximasLlegadas, paraGrafico, enCurso, totalesMes] =
      await Promise.all([
        // Reservas que ocupan lugar hoy
        prisma.reservation.findMany({
          where: { ...tenant, estado: { not: 'PENDIENTE' }, inicio: { lte: hastaHoy }, fin: { gte: desdeHoy } },
          include: INCLUDE_COMPLETO,
          orderBy: { inicio: 'asc' },
        }),

        prisma.reservation.aggregate({
          where: {
            ...tenant,
            inicio: { lte: hastaHoy },
            fin: { gte: desdeHoy },
            estado: { in: ESTADOS_VALIDOS },
          },
          _sum: { precioTotal: true, montoComision: true, montoNeto: true, cantidadVehiculos: true },
          _count: true,
        }),

        // Quién llega en las próximas horas
        prisma.reservation.findMany({
          where: {
            ...tenant,
            estado: 'CONFIRMADA',
            inicio: { gte: new Date(), lte: new Date(Date.now() + 12 * 3_600_000) },
          },
          include: INCLUDE_COMPLETO,
          orderBy: { inicio: 'asc' },
          take: 10,
        }),

        // Serie para el gráfico
        prisma.reservation.findMany({
          where: { ...tenant, estado: { not: 'PENDIENTE' }, inicio: { gte: desdeGrafico, lte: hastaHoy } },
          select: { inicio: true, precioTotal: true, montoNeto: true, estado: true },
        }),

        prisma.reservation.count({ where: { ...tenant, estado: 'EN_CURSO' } }),

        // Mes en curso
        prisma.reservation.aggregate({
          where: {
            ...tenant,
            inicio: { gte: new Date(hoy.getFullYear(), hoy.getMonth(), 1), lte: hastaHoy },
            estado: { in: ESTADOS_VALIDOS },
          },
          _sum: { precioTotal: true, montoComision: true, montoNeto: true },
          _count: true,
        }),
      ]);

    const esSuperadmin = req.usuario.role === 'SUPERADMIN';
    // Al estacionamiento, la plata se le muestra siempre como lo que le
    // corresponde (montoNeto): el total con la seña de SpotNear es interno.
    const montoVisible = (r) => Number(esSuperadmin ? r.precioTotal : r.montoNeto);

    // Serie día por día, con los días sin reservas en cero (si no, el gráfico miente).
    const porDia = new Map();
    for (let i = 0; i < req.datosQuery.dias; i++) {
      const dia = sumarDias(desdeGrafico, i);
      porDia.set(claveDia(dia), { fecha: claveDia(dia), cantidad: 0, monto: 0 });
    }
    for (const r of paraGrafico) {
      if (!ESTADOS_VALIDOS.includes(r.estado)) continue;
      const clave = claveDia(r.inicio);
      const item = porDia.get(clave);
      if (item) {
        item.cantidad += 1;
        item.monto += montoVisible(r);
      }
    }

    // Ocupación (solo tiene sentido con un estacionamiento concreto)
    let ocupacion = null;
    if (parkingId) {
      ocupacion = await ocupacionActual(parkingId).catch(() => null);
    }

    res.json({
      hoy: {
        fecha: desdeHoy,
        cantidad: totalesHoy._count ?? 0,
        vehiculos: totalesHoy._sum.cantidadVehiculos ?? 0,
        ingresosPrevistos: Number((esSuperadmin ? totalesHoy._sum.precioTotal : totalesHoy._sum.montoNeto) ?? 0),
        netoPrevisto: Number(totalesHoy._sum.montoNeto ?? 0),
        // La comisión de la plataforma solo la ve ColdevIA
        comision: esSuperadmin ? Number(totalesHoy._sum.montoComision ?? 0) : undefined,
        enCurso,
      },
      mes: {
        cantidad: totalesMes._count ?? 0,
        ingresos: Number((esSuperadmin ? totalesMes._sum.precioTotal : totalesMes._sum.montoNeto) ?? 0),
        neto: Number(totalesMes._sum.montoNeto ?? 0),
        comision: esSuperadmin ? Number(totalesMes._sum.montoComision ?? 0) : undefined,
      },
      ocupacion,
      reservasHoy: reservasHoy.map((r) => aReservaAdmin(r, req.usuario.role)),
      proximasLlegadas: proximasLlegadas.map((r) => aReservaAdmin(r, req.usuario.role)),
      serie: [...porDia.values()],
    });
  }),
);

/**
 * GET /api/v1/admin/reports/comisiones
 * Detalle de comisiones por estacionamiento y período.
 */
router.get(
  '/comisiones',
  validar({
    query: z.object({
      desde: fechaOpcional,
      hasta: fechaOpcional,
      parkingId: z.string().optional(),
      agrupar: z.enum(['PARKING', 'MES']).default('PARKING'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { desde, hasta, agrupar } = req.datosQuery;

    const hoy = new Date();
    const rangoDesde = desde ? inicioDelDia(desde) : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const rangoHasta = hasta ? finDelDia(hasta) : finDelDia(hoy);

    const where = {
      ...filtroTenant(req),
      inicio: { gte: rangoDesde, lte: rangoHasta },
      estado: { in: ESTADOS_VALIDOS },
      // Las reservas eliminadas del panel con la seña ya cobrada siguen
      // contando acá: la plata entró y es no reembolsable, sacarlas del
      // reporte falsearía la facturación. Nombrar la columna desactiva el
      // filtro global de src/config/prisma.js, que es el que las esconde del
      // resto de las pantallas.
      eliminadaEn: { not: undefined },
    };

    const reservas = await prisma.reservation.findMany({
      where,
      select: {
        id: true,
        codigo: true,
        inicio: true,
        precioTotal: true,
        comisionPorcentaje: true,
        montoComision: true,
        montoNeto: true,
        parkingId: true,
        // `parkingNombre` es la copia que se guarda al eliminar el
        // estacionamiento: para esas reservas es el único nombre que queda.
        parkingNombre: true,
        parking: {
          select: { id: true, nombre: true, slug: true, comisionPorcentaje: true, eliminadoEn: true },
        },
      },
      orderBy: { inicio: 'asc' },
    });

    const esSuperadmin = req.usuario.role === 'SUPERADMIN';

    // Agrupación
    const grupos = new Map();
    for (const r of reservas) {
      const clave =
        agrupar === 'MES'
          ? `${r.inicio.getFullYear()}-${String(r.inicio.getMonth() + 1).padStart(2, '0')}`
          : r.parkingId;

      if (!grupos.has(clave)) {
        // Un estacionamiento eliminado conserva sus reservas (son el historial
        // contable), pero la fila tiene que decir que ya no está en la
        // plataforma: si no, parece que sigue operando.
        const eliminado = Boolean(r.parking?.eliminadoEn);
        grupos.set(clave, {
          clave,
          etiqueta:
            agrupar === 'MES'
              ? clave
              : (eliminado ? r.parkingNombre ?? r.parking.nombre : r.parking.nombre),
          parkingEliminado: agrupar === 'PARKING' ? eliminado : undefined,
          parkingId: agrupar === 'PARKING' ? r.parkingId : undefined,
          cantidad: 0,
          precioTotal: 0,
          montoComision: 0,
          montoNeto: 0,
        });
      }

      const g = grupos.get(clave);
      g.cantidad += 1;
      g.precioTotal += Number(r.precioTotal);
      g.montoComision += Number(r.montoComision);
      g.montoNeto += Number(r.montoNeto);
    }

    const filas = [...grupos.values()].sort((a, b) => b.precioTotal - a.precioTotal);

    const totales = filas.reduce(
      (acc, g) => ({
        cantidad: acc.cantidad + g.cantidad,
        precioTotal: acc.precioTotal + g.precioTotal,
        montoComision: acc.montoComision + g.montoComision,
        montoNeto: acc.montoNeto + g.montoNeto,
      }),
      { cantidad: 0, precioTotal: 0, montoComision: 0, montoNeto: 0 },
    );

    // El estacionamiento ve solo lo que le corresponde (montoNeto): ni el total
    // facturado con la seña ni la comisión, que son información de SpotNear.
    if (!esSuperadmin) {
      for (const f of filas) {
        delete f.montoComision;
        delete f.precioTotal;
      }
      delete totales.montoComision;
      delete totales.precioTotal;
      filas.sort((x, y) => y.montoNeto - x.montoNeto);
    }

    res.json({
      periodo: { desde: rangoDesde, hasta: rangoHasta },
      agrupar,
      filas,
      totales,
    });
  }),
);

/**
 * GET /api/v1/admin/reports/comisiones.csv
 * Mismo reporte, exportable.
 */
router.get(
  '/comisiones.csv',
  requiereRol('SUPERADMIN', 'OWNER'),
  validar({
    query: z.object({
      desde: fechaOpcional,
      hasta: fechaOpcional,
      parkingId: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const hoy = new Date();
    const rangoDesde = req.datosQuery.desde
      ? inicioDelDia(req.datosQuery.desde)
      : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const rangoHasta = req.datosQuery.hasta ? finDelDia(req.datosQuery.hasta) : finDelDia(hoy);

    const reservas = await prisma.reservation.findMany({
      where: {
        ...filtroTenant(req),
        inicio: { gte: rangoDesde, lte: rangoHasta },
        estado: { in: ESTADOS_VALIDOS },
        // Igual que el reporte en pantalla: las quitadas del panel siguen
        // siendo facturación. Sin esto, el CSV no coincidía con la pantalla.
        eliminadaEn: { not: undefined },
      },
      include: { parking: { select: { nombre: true } } },
      orderBy: { inicio: 'asc' },
      take: 10_000,
    });

    const esSuperadmin = req.usuario.role === 'SUPERADMIN';

    const columnas = [
      { key: 'codigo', label: 'Código' },
      { key: 'parking', label: 'Estacionamiento', format: (r) => r.parking.nombre },
      { key: 'fecha', label: 'Fecha', format: (r) => r.inicio.toISOString().slice(0, 10) },
      // Total con la seña y comisión: solo para el SUPERADMIN.
      ...(esSuperadmin
        ? [
            { key: 'precioTotal', label: 'Total', format: (r) => Number(r.precioTotal).toFixed(2) },
            { key: 'comisionPorcentaje', label: 'Comisión %', format: (r) => Number(r.comisionPorcentaje).toFixed(2) },
            { key: 'montoComision', label: 'Comisión $', format: (r) => Number(r.montoComision).toFixed(2) },
          ]
        : []),
      {
        key: 'montoNeto',
        label: esSuperadmin ? 'Neto estacionamiento' : 'Tus ingresos',
        format: (r) => Number(r.montoNeto).toFixed(2),
      },
    ];

    await auditar(req, {
      accion: 'reporte.comisiones_csv',
      entidad: 'Reservation',
      datos: { desde: rangoDesde, hasta: rangoHasta, cantidad: reservas.length },
    });

    res
      .type('text/csv; charset=utf-8')
      .set('Content-Disposition', `attachment; filename="${nombreArchivoCSV('comisiones-spotnear')}"`)
      .send(generarCSV(columnas, reservas));
  }),
);

export default router;
