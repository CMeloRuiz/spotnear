/**
 * Helpers de fecha/hora.
 *
 * El proceso corre con TZ=America/Argentina/Buenos_Aires (ver config/env.js),
 * así que los métodos locales de Date ya trabajan en hora argentina.
 * En base todo se guarda en UTC, como corresponde.
 */

export const ZONA = 'America/Argentina/Buenos_Aires';

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const DIAS_LARGOS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

/** @param {Date|string} d */
export function aFecha(d) {
  return d instanceof Date ? d : new Date(d);
}

/** Medianoche (00:00) del día de esa fecha, en hora argentina. */
export function inicioDelDia(d = new Date()) {
  const f = aFecha(d);
  return new Date(f.getFullYear(), f.getMonth(), f.getDate(), 0, 0, 0, 0);
}

/** 23:59:59.999 del día de esa fecha, en hora argentina. */
export function finDelDia(d = new Date()) {
  const f = aFecha(d);
  return new Date(f.getFullYear(), f.getMonth(), f.getDate(), 23, 59, 59, 999);
}

/** @param {Date|string} d @param {number} dias */
export function sumarDias(d, dias) {
  const f = new Date(aFecha(d).getTime());
  f.setDate(f.getDate() + dias);
  return f;
}

/** @param {Date|string} d @param {number} horas */
export function sumarHoras(d, horas) {
  return new Date(aFecha(d).getTime() + horas * 3_600_000);
}

/** Diferencia en horas decimales entre dos fechas. */
export function horasEntre(desde, hasta) {
  return (aFecha(hasta).getTime() - aFecha(desde).getTime()) / 3_600_000;
}

/** Diferencia en minutos entre dos fechas. */
export function minutosEntre(desde, hasta) {
  return (aFecha(hasta).getTime() - aFecha(desde).getTime()) / 60_000;
}

/**
 * ¿Se pisan dos rangos? Se usa el criterio de intervalos semiabiertos [inicio, fin):
 * una reserva que termina 19:00 NO se pisa con una que arranca 19:00.
 */
export function rangosSeSolapan(inicioA, finA, inicioB, finB) {
  return aFecha(inicioA) < aFecha(finB) && aFecha(finA) > aFecha(inicioB);
}

/** dd/mm/aaaa */
export function formatearFecha(d) {
  const f = aFecha(d);
  const dd = String(f.getDate()).padStart(2, '0');
  const mm = String(f.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${f.getFullYear()}`;
}

/** HH:mm en 24 horas */
export function formatearHora(d) {
  const f = aFecha(d);
  return `${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}`;
}

/** dd/mm/aaaa HH:mm */
export function formatearFechaHora(d) {
  return `${formatearFecha(d)} ${formatearHora(d)}`;
}

/** "Sábado 25/10" — el formato que se usa en los mensajes de WhatsApp. */
export function formatearFechaLarga(d) {
  const f = aFecha(d);
  const dd = String(f.getDate()).padStart(2, '0');
  const mm = String(f.getMonth() + 1).padStart(2, '0');
  return `${DIAS_LARGOS[f.getDay()]} ${dd}/${mm}`;
}

/**
 * "Sábado 25 de octubre" — versión larga, para los mensajes que lee el cliente.
 * El mes va con letras a propósito: en un WhatsApp el "25/10" se lee de reojo y
 * equivocarse de día se paga caro; el nombre del mes no se confunde con nada.
 */
export function formatearFechaCompleta(d) {
  const f = aFecha(d);
  return `${DIAS_LARGOS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}`;
}

/** Clave de día de semana usada en Parking.horarios: lun, mar, mie... */
export function claveDiaSemana(d) {
  return DIAS_CORTOS[aFecha(d).getDay()];
}

/** aaaa-mm-dd, para agrupar en reportes. */
export function claveDia(d) {
  const f = aFecha(d);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

export { DIAS_CORTOS, DIAS_LARGOS, MESES };
