/**
 * Generación de códigos de reserva y tokens públicos.
 */
import crypto from 'node:crypto';

/**
 * Alfabeto sin caracteres ambiguos (0/O, 1/I/L, 2/Z, 5/S, 8/B).
 * El código lo dicta gente por teléfono y lo tipea un playero apurado:
 * cuanto menos se preste a confusión, mejor.
 */
const ALFABETO = '34679ACDEFGHJKMNPQRTUVWXY';
const LARGO_CODIGO = 6;
export const PREFIJO_CODIGO = 'SN-';

/**
 * Código legible de reserva: SN-7K3P9Q
 * @returns {string}
 */
export function generarCodigoReserva() {
  const bytes = crypto.randomBytes(LARGO_CODIGO);
  let codigo = '';
  for (let i = 0; i < LARGO_CODIGO; i++) {
    codigo += ALFABETO[bytes[i] % ALFABETO.length];
  }
  return PREFIJO_CODIGO + codigo;
}

/**
 * Token no adivinable para el link público del comprobante.
 * 32 bytes en base64url ≈ 43 caracteres, imposible de enumerar.
 */
export function generarTokenPublico() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Normaliza lo que el usuario escribe en el buscador del panel
 * ("sn7k3p9q", "SN 7K3P9Q", "7k3p9q") al formato canónico SN-7K3P9Q.
 * @param {string} valor
 */
export function normalizarCodigo(valor) {
  const limpio = String(valor ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const sinPrefijo = limpio.startsWith('SN') ? limpio.slice(2) : limpio;
  return sinPrefijo ? PREFIJO_CODIGO + sinPrefijo : '';
}

/** Hash de un refresh token para guardarlo en base (nunca se guarda en claro). */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
