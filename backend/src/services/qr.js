/**
 * Generación del QR del comprobante.
 *
 * El QR apunta al link público del comprobante (no al código a secas): así el
 * playero lo escanea con la cámara del celular y le abre la reserva, sin tener
 * que tipear nada.
 */
import QRCode from 'qrcode';
import { urlComprobante } from './notifications/messages.js';

const OPCIONES = {
  errorCorrectionLevel: 'M',
  margin: 1,
  width: 320,
  color: { dark: '#0f172a', light: '#ffffff' },
};

/**
 * PNG en data URL, listo para <img src> y para incrustar en el email.
 * @param {object} reserva
 * @returns {Promise<string>}
 */
export async function qrDataUrl(reserva) {
  return QRCode.toDataURL(urlComprobante(reserva), OPCIONES);
}

/**
 * SVG del QR (escala sin pixelarse, ideal para imprimir el comprobante).
 * @param {object} reserva
 * @returns {Promise<string>}
 */
export async function qrSvg(reserva) {
  return QRCode.toString(urlComprobante(reserva), { ...OPCIONES, type: 'svg' });
}

/** Buffer PNG, para adjuntar al email. */
export async function qrBuffer(reserva) {
  return QRCode.toBuffer(urlComprobante(reserva), OPCIONES);
}

export default { qrDataUrl, qrSvg, qrBuffer };
