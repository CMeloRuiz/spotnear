/**
 * Validación y normalización de patentes argentinas.
 *
 * Formatos soportados:
 *  · Viejo (hasta 2016):  ABC123     → 3 letras + 3 números
 *  · Mercosur (2016+):    AB123CD    → 2 letras + 3 números + 2 letras
 *  · Motos viejas:        123ABC     → 3 números + 3 letras
 *  · Motos Mercosur:      A123BCD    → 1 letra + 3 números + 3 letras
 *
 * Se guarda SIEMPRE en mayúsculas, sin espacios ni guiones.
 */

const FORMATOS = [
  { nombre: 'VIEJO', regex: /^[A-Z]{3}\d{3}$/, ejemplo: 'ABC123' },
  { nombre: 'MERCOSUR', regex: /^[A-Z]{2}\d{3}[A-Z]{2}$/, ejemplo: 'AB123CD' },
  { nombre: 'MOTO_VIEJO', regex: /^\d{3}[A-Z]{3}$/, ejemplo: '123ABC' },
  { nombre: 'MOTO_MERCOSUR', regex: /^[A-Z]\d{3}[A-Z]{3}$/, ejemplo: 'A123BCD' },
];

/**
 * Deja la patente en formato canónico: mayúsculas, sin espacios, guiones ni puntos.
 * @param {string} valor
 * @returns {string}
 */
export function normalizarPatente(valor) {
  if (typeof valor !== 'string') return '';
  return valor
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // por si alguien escribe con acento
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * @param {string} valor
 * @returns {{ valida: boolean, patente: string, formato: string|null }}
 */
export function validarPatente(valor) {
  const patente = normalizarPatente(valor);
  const formato = FORMATOS.find((f) => f.regex.test(patente));
  return { valida: Boolean(formato), patente, formato: formato ? formato.nombre : null };
}

/** @param {string} valor */
export function esPatenteValida(valor) {
  return validarPatente(valor).valida;
}

/** Mensaje de error uniforme para formularios y API. */
export const MENSAJE_PATENTE_INVALIDA =
  'La patente no tiene un formato válido. Usá ABC123 (viejo) o AB123CD (Mercosur).';

/**
 * Formato lindo para mostrar: AB 123 CD / ABC 123.
 * Nunca se usa para guardar, solo para presentar.
 * @param {string} valor
 */
export function formatearPatente(valor) {
  const { patente, formato } = validarPatente(valor);
  switch (formato) {
    case 'VIEJO':
      return `${patente.slice(0, 3)} ${patente.slice(3)}`;
    case 'MERCOSUR':
      return `${patente.slice(0, 2)} ${patente.slice(2, 5)} ${patente.slice(5)}`;
    case 'MOTO_VIEJO':
      return `${patente.slice(0, 3)} ${patente.slice(3)}`;
    case 'MOTO_MERCOSUR':
      return `${patente.slice(0, 1)} ${patente.slice(1, 4)} ${patente.slice(4)}`;
    default:
      return patente;
  }
}

export { FORMATOS as FORMATOS_PATENTE };
