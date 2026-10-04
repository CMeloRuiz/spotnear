/**
 * Horarios de atención. Espejo de `backend/src/utils/horarios.js`.
 *
 * Tres modos excluyentes, uno por estacionamiento:
 *   · FIJO         → abre y cierra a una hora, distinta por día.
 *   · ABIERTO_24HS → nunca cierra.
 *   · FIN_EVENTO   → abre a una hora fija y cierra cuando termina el evento
 *                    del día. No hay hora de cierre que mostrar.
 *
 * Toda pantalla que muestre un horario tiene que pasar por acá, así los tres
 * casos se leen igual en la ficha pública, en el panel y en las solicitudes.
 */
import textos from '../i18n/textos.js';

export const TIPOS_HORARIO = ['FIJO', 'ABIERTO_24HS', 'FIN_EVENTO'];

/** Claves de los días tal como se guardan en el JSON de horarios. */
export const DIAS = [
  ['lun', 'Lunes'],
  ['mar', 'Martes'],
  ['mie', 'Miércoles'],
  ['jue', 'Jueves'],
  ['vie', 'Viernes'],
  ['sab', 'Sábado'],
  ['dom', 'Domingo'],
];

/**
 * Modo de un estacionamiento, deduciéndolo si viene sin la columna cargada
 * (datos viejos, o un objeto armado a mano en el formulario).
 */
export function tipoDeHorario(parking) {
  if (TIPOS_HORARIO.includes(parking?.tipoHorario)) return parking.tipoHorario;
  return parking?.horarios?.abierto24h === true ? 'ABIERTO_24HS' : 'FIJO';
}

/**
 * Texto de una fila de día.
 * @returns {string} "07:00 a 23:00", "Hasta que termine el evento", "Cerrado"…
 */
export function textoDelDia(parking, clave) {
  const tipo = tipoDeHorario(parking);
  if (tipo === 'ABIERTO_24HS') return textos.parking.abierto24hCorto;

  const dia = parking?.horarios?.[clave];
  if (!dia || dia.cerrado === true) return textos.parking.cerrado;
  if (!dia.abre) return textos.parking.sinDato;

  if (tipo === 'FIN_EVENTO') {
    return textos.parking.desdeHastaEvento(dia.abre);
  }
  return dia.cierra ? `${dia.abre} – ${dia.cierra}` : textos.parking.desde(dia.abre);
}

/**
 * Resumen de una línea para tarjetas y listados.
 * @param {object} parking
 */
export function resumenHorario(parking) {
  const tipo = tipoDeHorario(parking);
  if (tipo === 'ABIERTO_24HS') return textos.parking.abierto24h;
  if (tipo === 'FIN_EVENTO') return textos.parking.cierreEventoResumen;
  return textos.parking.horarioFijoResumen;
}

/** Día de la semana ('lun'…'dom') de una fecha, en la hora de Buenos Aires. */
const CLAVE_POR_DIA = { Mon: 'lun', Tue: 'mar', Wed: 'mie', Thu: 'jue', Fri: 'vie', Sat: 'sab', Sun: 'dom' };
export function claveDelDia(fecha) {
  const corto = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(fecha);
  return CLAVE_POR_DIA[corto];
}

/**
 * Leyenda corta del horario para la tarjeta de resultados y el mapa.
 *
 *  · ABIERTO_24HS → "Abierto las 24 horas"
 *  · FIN_EVENTO   → "Abre 18:00 · Cierra al finalizar el evento"
 *  · FIJO         → "Abre 06:00 · Cierra 22:00"
 *
 * En FIJO y FIN_EVENTO la hora es la del DÍA BUSCADO (cada día puede tener la
 * suya). Si ese día no hay horario cargado, se muestra solo el modo; si ese
 * día cierra, se dice. Devuelve null si no hay nada confiable para mostrar.
 *
 * @param {object} parking   Con tipoHorario y horarios.
 * @param {Date} [fecha]     Ingreso buscado. Sin fecha, el día de hoy.
 */
export function leyendaHorario(parking, fecha = new Date()) {
  const t = textos.parking;
  const tipo = tipoDeHorario(parking);
  if (tipo === 'ABIERTO_24HS') return t.modosHorario.ABIERTO_24HS;

  const dia = parking?.horarios?.[claveDelDia(fecha)];
  if (dia?.cerrado === true) return t.cerradoEseDia;

  if (tipo === 'FIN_EVENTO') {
    return dia?.abre ? `${t.abreA(dia.abre)} · ${t.cierraConEvento}` : t.cierraConEvento;
  }
  if (dia?.abre && dia?.cierra) return `${t.abreA(dia.abre)} · ${t.cierraA(dia.cierra)}`;
  if (dia?.abre) return t.abreA(dia.abre);
  return null;
}

export default { TIPOS_HORARIO, DIAS, tipoDeHorario, textoDelDia, resumenHorario, leyendaHorario };
