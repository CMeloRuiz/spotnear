/**
 * Escalones de estadía, del lado del cliente.
 *
 * Es un espejo de `backend/src/services/pricing.js`: la fuente de verdad del
 * precio es el servidor y acá no se calcula ningún monto. Lo único que se
 * necesita en el frontend es saber en qué escalón cae la duración buscada,
 * para nombrar bien el interruptor de precios de la lista de resultados.
 *
 * Reglas (idénticas al backend):
 *
 *   · menos de 4 h   → por hora
 *   · de 4 a 12 h    → media estadía          (12 h exactas NO entran acá)
 *   · de 12 a 24 h   → estadía completa
 *   · más de 24 h    → el ciclo se reinicia: cada bloque de 24 h es una
 *                      estadía completa y el resto se cobra según su escalón.
 */
export const HORAS_MEDIA_ESTADIA = 4;
export const HORAS_ESTADIA_COMPLETA = 12;
const HORAS_POR_DIA = 24;

/**
 * @param {Date|string|number} inicio
 * @param {Date|string|number} fin
 * @returns {'HORA'|'MEDIA_ESTADIA'|'ESTADIA_COMPLETA'} escalón del tramo final
 */
export function escalonDeEstadia(inicio, fin) {
  const horas = (new Date(fin).getTime() - new Date(inicio).getTime()) / 3_600_000;
  if (!Number.isFinite(horas) || horas <= 0) return 'HORA';

  // Más de un día: lo que define el nombre es el resto, no los ciclos enteros.
  const resto = horas % HORAS_POR_DIA;
  const efectivas = resto === 0 ? HORAS_POR_DIA : resto;

  if (efectivas < HORAS_MEDIA_ESTADIA) return 'HORA';
  if (efectivas < HORAS_ESTADIA_COMPLETA) return 'MEDIA_ESTADIA';
  return 'ESTADIA_COMPLETA';
}

/** Texto del interruptor "mostrar precio…" según el escalón de la búsqueda. */
export function textoMostrarTotal(textosResultados, inicio, fin) {
  const escalon = escalonDeEstadia(inicio, fin);
  if (escalon === 'MEDIA_ESTADIA') return textosResultados.mostrarMediaEstadia;
  if (escalon === 'ESTADIA_COMPLETA') return textosResultados.mostrarEstadiaCompleta;
  return textosResultados.mostrarTotal;
}

export default { escalonDeEstadia, textoMostrarTotal };
