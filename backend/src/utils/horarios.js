/**
 * Horarios de atención.
 *
 * Un estacionamiento cierra de una de tres maneras, y las tres conviven en la
 * plataforma porque responden a negocios distintos:
 *
 *   · FIJO         → abre y cierra a una hora, distinta por día de semana.
 *   · ABIERTO_24HS → nunca cierra.
 *   · FIN_EVENTO   → abre a una hora fija y cierra cuando termina el evento del
 *                    día, sin hora predecible. Es el caso de los que están al
 *                    lado de un estadio: la salida depende del show, no del reloj.
 *
 * El modo vive en la columna `tipoHorario`; el detalle por día sigue en el JSON
 * `horarios`. En FIN_EVENTO cada día trae solo `abre`, porque la hora de cierre
 * no existe.
 */
import { claveDiaSemana } from './dates.js';

export const TIPOS_HORARIO = ['FIJO', 'ABIERTO_24HS', 'FIN_EVENTO'];

/** "07:30" → 450. Devuelve null si no es una hora válida. */
export function aMinutos(hhmm) {
  if (typeof hhmm !== 'string') return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Deduce el modo de un estacionamiento que todavía no tiene la columna cargada.
 * Existe para los datos viejos y para cualquier objeto que llegue sin el campo.
 * @param {{ tipoHorario?: string, horarios?: object }} parking
 */
export function tipoDeHorario(parking) {
  if (TIPOS_HORARIO.includes(parking?.tipoHorario)) return parking.tipoHorario;
  return parking?.horarios?.abierto24h === true ? 'ABIERTO_24HS' : 'FIJO';
}

/** Horario del día que corresponde a esa fecha, o null. */
export function horarioDelDia(horarios, fecha) {
  if (!horarios || typeof horarios !== 'object') return null;
  const dia = horarios[claveDiaSemana(fecha)];
  return dia && typeof dia === 'object' ? dia : null;
}

/**
 * ¿Se puede ingresar a esa hora? Devuelve el mensaje de error o null.
 *
 * @param {{ tipoHorario?: string, horarios?: object }} parking
 * @param {Date} inicio
 */
export function validarHorario(parking, inicio) {
  const tipo = tipoDeHorario(parking);

  // Nunca cierra: no hay nada que validar.
  if (tipo === 'ABIERTO_24HS') return null;

  const dia = horarioDelDia(parking?.horarios, inicio);
  if (!dia) return null;
  if (dia.cerrado === true) return 'El estacionamiento está cerrado ese día.';

  const abre = aMinutos(dia.abre);
  if (abre === null) return null;

  const minutosInicio = inicio.getHours() * 60 + inicio.getMinutes();

  // Cierra con el evento: solo importa que no se ingrese antes de abrir. La
  // hora de salida la define el show, así que no se puede validar contra nada.
  if (tipo === 'FIN_EVENTO') {
    if (minutosInicio < abre) {
      return `El estacionamiento abre a las ${dia.abre}. Elegí un horario de ingreso posterior.`;
    }
    return null;
  }

  const cierraCrudo = aMinutos(dia.cierra);
  if (cierraCrudo === null) return null;

  // Cierre después de medianoche (ej: abre 08:00, cierra 02:00)
  const cruzaMedianoche = cierraCrudo <= abre;
  const cierra = cruzaMedianoche ? cierraCrudo + 24 * 60 : cierraCrudo;
  const ajustado = cruzaMedianoche && minutosInicio < abre ? minutosInicio + 24 * 60 : minutosInicio;

  if (ajustado < abre || ajustado > cierra) {
    return `El ingreso tiene que ser dentro del horario de atención (${dia.abre} a ${dia.cierra}).`;
  }
  return null;
}

/**
 * Texto legible del horario, para emails y mensajes del servidor.
 * @param {{ tipoHorario?: string, horarios?: object }} parking
 * @param {Date} [fecha] Si se pasa, describe el día de esa fecha.
 */
export function describirHorario(parking, fecha = new Date()) {
  const tipo = tipoDeHorario(parking);
  if (tipo === 'ABIERTO_24HS') return 'Abierto las 24 horas';

  const dia = horarioDelDia(parking?.horarios, fecha);
  if (!dia || dia.cerrado === true) return 'Cerrado';
  if (!dia.abre) return 'Consultá el horario con el estacionamiento';

  if (tipo === 'FIN_EVENTO') {
    return `Abre ${dia.abre} · cierra al finalizar el evento`;
  }
  return dia.cierra ? `${dia.abre} a ${dia.cierra}` : `Abre ${dia.abre}`;
}

export default { TIPOS_HORARIO, tipoDeHorario, horarioDelDia, validarHorario, describirHorario, aMinutos };
