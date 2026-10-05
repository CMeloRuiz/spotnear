/**
 * Control de capacidad y disponibilidad.
 *
 * Regla: un estacionamiento NO puede sobrevender. Antes de confirmar una reserva
 * se cuentan los lugares realmente comprometidos en ese rango horario:
 *
 *    libres = capacidadTotal − reservasActivasQueSePisan − cuposBloqueados
 *
 * Estados que ocupan lugar: PENDIENTE, CONFIRMADA y EN_CURSO.
 * CANCELADA, FINALIZADA y NO_SHOW liberan el lugar.
 *
 * Con una excepción, que nació al cobrar la seña por adelantado: una reserva
 * PENDIENTE cuya seña nunca se acreditó deja de ocupar lugar pasados
 * MINUTOS_PARA_APARTAR. Ver `filtroDeAbandonadas`.
 *
 * La verificación se hace DENTRO de la transacción que crea la reserva, con
 * nivel Serializable, para que dos personas que reservan el último lugar al
 * mismo tiempo no entren las dos.
 */
import prisma from '../config/prisma.js';
import errores from '../utils/errors.js';

/** Estados en los que una reserva ocupa un lugar físico. */
export const ESTADOS_QUE_OCUPAN = ['PENDIENTE', 'CONFIRMADA', 'EN_CURSO'];

/**
 * Cuánto se le aparta el lugar a alguien que todavía no pagó la seña.
 *
 * Es el tiempo que tarda una persona en completar el checkout de la pasarela.
 * Media hora es holgado y coincide con el vencimiento de la preferencia de
 * Mercado Pago, así que un lugar no queda tomado más allá de eso por alguien
 * que abrió el pago y se fue.
 */
export const MINUTOS_PARA_APARTAR = 30;

/**
 * Deja afuera las reservas abandonadas en el pago.
 *
 * Nace de cobrar la seña por adelantado: entre que el cliente confirma y que
 * paga, la reserva existe pero no está paga. Durante ese rato el lugar tiene
 * que quedar apartado —si no, dos personas pagan por el mismo lugar—, pero no
 * para siempre: el que cerró el navegador sin pagar no puede dejar un lugar
 * muerto hasta el día de la estadía.
 *
 * Se resuelve en la consulta y no con una tarea programada: sin un proceso
 * aparte que se pueda caer, y siempre exacto al momento de preguntar.
 */
export function filtroDeAbandonadas(ahora = new Date()) {
  return {
    NOT: {
      estado: 'PENDIENTE',
      paymentStatus: 'PENDIENTE',
      createdAt: { lt: new Date(ahora.getTime() - MINUTOS_PARA_APARTAR * 60_000) },
    },
  };
}

/**
 * Lugares ocupados por reservas que se pisan con el rango.
 * Intervalos semiabiertos: [inicio, fin). Salir 19:00 y entrar 19:00 no se pisa.
 *
 * @param {object} tx        Cliente Prisma o transacción
 * @param {string} parkingId
 * @param {Date} inicio
 * @param {Date} fin
 * @param {string} [excluirReservaId] Para no contarse a sí misma al editar
 */
export async function lugaresOcupados(tx, parkingId, inicio, fin, excluirReservaId = null) {
  const where = {
    parkingId,
    estado: { in: ESTADOS_QUE_OCUPAN },
    ...filtroDeAbandonadas(),
    inicio: { lt: new Date(fin) },
    fin: { gt: new Date(inicio) },
  };
  if (excluirReservaId) where.id = { not: excluirReservaId };

  const { _sum } = await tx.reservation.aggregate({
    where,
    _sum: { cantidadVehiculos: true },
  });
  return _sum.cantidadVehiculos ?? 0;
}

/**
 * Lugares bloqueados manualmente (mantenimiento, abonados, evento propio).
 * Se suman los bloqueos que se pisan con el rango.
 */
export async function lugaresBloqueados(tx, parkingId, inicio, fin) {
  const { _sum } = await tx.capacityBlock.aggregate({
    where: {
      parkingId,
      desde: { lt: new Date(fin) },
      hasta: { gt: new Date(inicio) },
    },
    _sum: { lugares: true },
  });
  return _sum.lugares ?? 0;
}

/**
 * Foto de disponibilidad de un estacionamiento en un rango.
 *
 * @returns {Promise<{ capacidadTotal: number, ocupados: number, bloqueados: number, libres: number, hayLugar: boolean }>}
 */
export async function disponibilidad(
  parkingId,
  inicio,
  fin,
  { tx = prisma, capacidadTotal = null, cantidad = 1, excluirReservaId = null } = {},
) {
  let capacidad = capacidadTotal;
  if (capacidad === null) {
    const parking = await tx.parking.findUnique({
      where: { id: parkingId },
      select: { capacidadTotal: true },
    });
    if (!parking) throw errores.noEncontrado('El estacionamiento');
    capacidad = parking.capacidadTotal;
  }

  const [ocupados, bloqueados] = await Promise.all([
    lugaresOcupados(tx, parkingId, inicio, fin, excluirReservaId),
    lugaresBloqueados(tx, parkingId, inicio, fin),
  ]);

  const libres = Math.max(0, capacidad - ocupados - bloqueados);

  return {
    capacidadTotal: capacidad,
    ocupados,
    bloqueados,
    libres,
    hayLugar: libres >= cantidad,
  };
}

/**
 * Igual que `disponibilidad` pero lanza 409 SIN_CUPO si no alcanza.
 * Es la que se usa dentro de la transacción de creación.
 */
export async function verificarCupo(parkingId, inicio, fin, opciones = {}) {
  const cantidad = opciones.cantidad ?? 1;
  const info = await disponibilidad(parkingId, inicio, fin, opciones);

  if (!info.hayLugar) {
    throw errores.sinCupo({
      capacidadTotal: info.capacidadTotal,
      libres: info.libres,
      solicitados: cantidad,
    });
  }
  return info;
}

/**
 * Disponibilidad de varios estacionamientos de una sola vez.
 * Se usa en la búsqueda para no hacer N+1 consultas.
 *
 * @param {Array<{ id: string, capacidadTotal: number }>} parkings
 * @returns {Promise<Map<string, { libres: number, ocupados: number, hayLugar: boolean }>>}
 */
export async function disponibilidadEnLote(parkings, inicio, fin, cantidad = 1) {
  const ids = parkings.map((p) => p.id);
  if (ids.length === 0) return new Map();

  const [ocupadosPorParking, bloqueosPorParking] = await Promise.all([
    prisma.reservation.groupBy({
      by: ['parkingId'],
      where: {
        parkingId: { in: ids },
        estado: { in: ESTADOS_QUE_OCUPAN },
        ...filtroDeAbandonadas(),
        inicio: { lt: new Date(fin) },
        fin: { gt: new Date(inicio) },
      },
      _sum: { cantidadVehiculos: true },
    }),
    prisma.capacityBlock.groupBy({
      by: ['parkingId'],
      where: {
        parkingId: { in: ids },
        desde: { lt: new Date(fin) },
        hasta: { gt: new Date(inicio) },
      },
      _sum: { lugares: true },
    }),
  ]);

  const ocupadosMap = new Map(
    ocupadosPorParking.map((r) => [r.parkingId, r._sum.cantidadVehiculos ?? 0]),
  );
  const bloqueadosMap = new Map(
    bloqueosPorParking.map((r) => [r.parkingId, r._sum.lugares ?? 0]),
  );

  const resultado = new Map();
  for (const p of parkings) {
    const ocupados = ocupadosMap.get(p.id) ?? 0;
    const bloqueados = bloqueadosMap.get(p.id) ?? 0;
    const libres = Math.max(0, p.capacidadTotal - ocupados - bloqueados);
    resultado.set(p.id, {
      capacidadTotal: p.capacidadTotal,
      ocupados,
      bloqueados,
      libres,
      hayLugar: libres >= cantidad,
    });
  }
  return resultado;
}

/**
 * Pico de ocupación en una ventana: el momento en que más lugares están
 * tomados a la vez, contando reservas que ocupan (las mismas que cuenta la
 * búsqueda, sin las abandonadas) y bloqueos de cupo.
 *
 * Barrido de eventos: cada reserva suma al empezar y resta al terminar. El
 * máximo de esa suma es el pico. Intervalos semiabiertos, igual que el resto.
 */
/** Cuántos días hacia adelante mira el tablero. */
export const DIAS_HACIA_ADELANTE = 7;

export async function picoDeOcupacion(parkingId, desde, hasta, capacidadTotal) {
  const [reservas, bloqueos] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        parkingId,
        estado: { in: ESTADOS_QUE_OCUPAN },
        ...filtroDeAbandonadas(),
        inicio: { lt: hasta },
        fin: { gt: desde },
      },
      select: { inicio: true, fin: true, cantidadVehiculos: true },
    }),
    prisma.capacityBlock.findMany({
      where: { parkingId, desde: { lt: hasta }, hasta: { gt: desde } },
      select: { desde: true, hasta: true, lugares: true },
    }),
  ]);

  const eventos = [];
  const sumar = (ini, fin, n) => {
    const a = Math.max(ini.getTime(), desde.getTime());
    const b = Math.min(fin.getTime(), hasta.getTime());
    if (a >= b) return;
    eventos.push([a, n], [b, -n]);
  };
  for (const r of reservas) sumar(r.inicio, r.fin, r.cantidadVehiculos ?? 1);
  for (const b of bloqueos) sumar(b.desde, b.hasta, b.lugares);
  // A igual hora, primero las salidas: salir 19:00 y entrar 19:00 no se pisan.
  eventos.sort((x, y) => x[0] - y[0] || x[1] - y[1]);

  let actual = 0;
  let pico = 0;
  let momentoPico = null;
  for (const [t, n] of eventos) {
    actual += n;
    if (actual > pico) {
      pico = actual;
      momentoPico = new Date(t);
    }
  }

  return {
    reservas: reservas.length,
    picoOcupados: pico,
    minimoLibres: Math.max(0, capacidadTotal - pico),
    momentoPico,
  };
}

/**
 * Ocupación actual (para el dashboard): cuántos autos hay adentro ahora, y
 * cómo vienen los próximos días.
 *
 * "Libres ahora" mira solo este momento: una reserva para mañana no lo cambia.
 * Por eso va además `proximosDias`, para que una reserva recién pagada se vea
 * reflejada en el panel aunque todavía no haya empezado.
 */
export async function ocupacionActual(parkingId) {
  const ahora = new Date();
  const parking = await prisma.parking.findUnique({
    where: { id: parkingId },
    select: { capacidadTotal: true },
  });
  if (!parking) throw errores.noEncontrado('El estacionamiento');

  const { _sum } = await prisma.reservation.aggregate({
    where: {
      parkingId,
      estado: 'EN_CURSO',
    },
    _sum: { cantidadVehiculos: true },
  });

  const adentro = _sum.cantidadVehiculos ?? 0;
  const disponibleAhora = await disponibilidad(parkingId, ahora, new Date(ahora.getTime() + 3_600_000), {
    capacidadTotal: parking.capacidadTotal,
  });

  const proximosDias = await picoDeOcupacion(
    parkingId,
    ahora,
    new Date(ahora.getTime() + DIAS_HACIA_ADELANTE * 24 * 3_600_000),
    parking.capacidadTotal,
  );

  return {
    capacidadTotal: parking.capacidadTotal,
    adentro,
    libres: disponibleAhora.libres,
    comprometidos: disponibleAhora.ocupados,
    proximosDias,
    porcentaje:
      parking.capacidadTotal > 0 ? Math.round((adentro / parking.capacidadTotal) * 100) : 0,
  };
}

export default { disponibilidad, verificarCupo, disponibilidadEnLote, ocupacionActual };
