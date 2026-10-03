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

export default { TIPOS_HORARIO, DIAS, tipoDeHorario, textoDelDia, resumenHorario };
