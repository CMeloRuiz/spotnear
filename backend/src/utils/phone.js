/**
 * Normalización de teléfonos argentinos a E.164.
 *
 * Los clientes escriben el teléfono de mil maneras distintas:
 *   +54 9 11 1234-5678 · 011 15 1234 5678 · 1112345678 · 15-1234-5678 · 1234 5678
 * Todas tienen que terminar guardadas igual, porque el número es la llave
 * con la que se arma el link de WhatsApp.
 *
 * Reglas aplicadas:
 *  · Se descarta el prefijo internacional (00 / +) y el código de país 54.
 *  · Se descarta el 0 de larga distancia y el 15 de celular (marcación vieja).
 *  · El número nacional significativo argentino es SIEMPRE de 10 dígitos
 *    (código de área + abonado), con áreas de 2, 3 o 4 dígitos.
 *  · Se emite en formato móvil (+549...) porque el caso de uso principal
 *    es contactar al cliente por WhatsApp. Se puede forzar fijo con { movil: false }.
 */

const CODIGO_PAIS = '54';
/** Único código de área de 2 dígitos del país (AMBA). */
const AREA_2_DIGITOS = ['11'];

export const MENSAJE_TELEFONO_INVALIDO =
  'El teléfono no parece válido. Escribilo con código de área, por ejemplo 11 1234 5678.';

/** Deja solo dígitos. */
function soloDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

/**
 * Saca el "15" de la marcación vieja de celular, que va justo después del área.
 *
 * El número nacional significativo siempre tiene 10 dígitos (área + abonado),
 * así que con el 15 intercalado quedan 12, sea cual sea el largo del área:
 *   área 2 + 15 + abonado 8 = 12   (11 15 1234 5678)
 *   área 3 + 15 + abonado 7 = 12   (351 15 123 4567)
 *   área 4 + 15 + abonado 6 = 12   (2257 15 123456)
 *
 * @param {string} nacional
 * @returns {{ nacional: string, eraMovil: boolean }}
 */
function quitarPrefijo15(nacional) {
  if (nacional.length !== 12) return { nacional, eraMovil: false };

  // Área de 2 dígitos (11) → el 15 estaría en las posiciones 2-3
  if (AREA_2_DIGITOS.includes(nacional.slice(0, 2)) && nacional.slice(2, 4) === '15') {
    return { nacional: nacional.slice(0, 2) + nacional.slice(4), eraMovil: true };
  }
  // Área de 3 dígitos → el 15 estaría en las posiciones 3-4
  if (nacional.slice(3, 5) === '15') {
    return { nacional: nacional.slice(0, 3) + nacional.slice(5), eraMovil: true };
  }
  // Área de 4 dígitos → el 15 estaría en las posiciones 4-5
  if (nacional.slice(4, 6) === '15') {
    return { nacional: nacional.slice(0, 4) + nacional.slice(6), eraMovil: true };
  }
  return { nacional, eraMovil: false };
}

/**
 * @param {string} valor
 * @param {{ movil?: boolean }} [opciones]
 * @returns {{
 *   valido: boolean,
 *   e164: string|null,
 *   nacional: string|null,
 *   movil: boolean,
 *   areaAsumida: boolean,
 *   motivo?: string
 * }}
 */
export function normalizarTelefono(valor, opciones = {}) {
  const original = String(valor ?? '').trim();
  if (!original) {
    return { valido: false, e164: null, nacional: null, movil: false, areaAsumida: false, motivo: 'vacio' };
  }

  let digitos = soloDigitos(original);

  // Prefijo internacional escrito como 00
  if (digitos.startsWith('00')) digitos = digitos.slice(2);

  let movilExplicito = false;

  // Código de país
  if (digitos.startsWith(CODIGO_PAIS) && digitos.length > 10) {
    digitos = digitos.slice(CODIGO_PAIS.length);
    // El 9 después del 54 marca celular en formato internacional
    if (digitos.startsWith('9') && digitos.length > 10) {
      digitos = digitos.slice(1);
      movilExplicito = true;
    }
  }

  // 0 de larga distancia nacional
  if (digitos.startsWith('0')) digitos = digitos.slice(1);

  // 15 de celular pegado al área (011 15 1234 5678)
  const sinQuince = quitarPrefijo15(digitos);
  digitos = sinQuince.nacional;
  if (sinQuince.eraMovil) movilExplicito = true;

  // Alguien escribió solo el abonado de CABA (8 dígitos): asumimos área 11.
  // SpotNear opera en Buenos Aires, así que es la suposición razonable.
  let areaAsumida = false;
  if (digitos.length === 8) {
    digitos = '11' + digitos;
    areaAsumida = true;
  }

  // Caso "15 1234 5678" sin área: 10 dígitos que arrancan con 15 y no son un área válida
  if (digitos.length === 10 && digitos.startsWith('15')) {
    digitos = '11' + digitos.slice(2);
    areaAsumida = true;
    movilExplicito = true;
  }

  if (digitos.length !== 10) {
    return {
      valido: false,
      e164: null,
      nacional: null,
      movil: false,
      areaAsumida,
      motivo: 'longitud',
    };
  }

  // El código de área no puede arrancar en 0 ni en 1 (salvo el 11)
  if (digitos.startsWith('0') || (digitos.startsWith('1') && !digitos.startsWith('11'))) {
    return { valido: false, e164: null, nacional: null, movil: false, areaAsumida, motivo: 'area' };
  }

  // Por defecto asumimos celular: es el caso de uso (WhatsApp).
  // `movilExplicito` queda expuesto para saber si el dato vino confirmado o inferido.
  const movil = opciones.movil ?? true;
  const e164 = movil ? `+${CODIGO_PAIS}9${digitos}` : `+${CODIGO_PAIS}${digitos}`;

  return { valido: true, e164, nacional: digitos, movil, movilExplicito, areaAsumida };
}

/** @param {string} valor */
export function esTelefonoValido(valor) {
  return normalizarTelefono(valor).valido;
}

/**
 * Formato legible para pantalla: +54 9 11 1234-5678
 * @param {string} e164
 */
export function formatearTelefono(e164) {
  const digitos = soloDigitos(e164);
  // 54 + 9 + 10 = 13
  if (digitos.length === 13 && digitos.startsWith('549')) {
    const nac = digitos.slice(3);
    return `+54 9 ${nac.slice(0, 2)} ${nac.slice(2, 6)}-${nac.slice(6)}`;
  }
  if (digitos.length === 12 && digitos.startsWith('54')) {
    const nac = digitos.slice(2);
    return `+54 ${nac.slice(0, 2)} ${nac.slice(2, 6)}-${nac.slice(6)}`;
  }
  return e164;
}

/**
 * Número tal como lo espera wa.me: solo dígitos, sin +.
 * @param {string} e164
 */
export function aWhatsApp(e164) {
  return soloDigitos(e164);
}
