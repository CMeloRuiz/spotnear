/**
 * ¿Es una URL que un servicio externo puede alcanzar desde internet?
 *
 * La usan las integraciones a las que les pasamos una URL nuestra para que la
 * visiten ELLAS, desde sus servidores: el webhook de Mercado Pago y la imagen
 * del comprobante que descarga Twilio para adjuntarla en WhatsApp. Una URL de
 * localhost o de una red privada funciona en tu navegador pero no para ellos.
 */
export function esAlcanzableDesdeInternet(url) {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return false;
    if (hostname.endsWith('.local') || hostname.endsWith('.localhost')) return false;
    // Rangos privados: tampoco los ve nadie de afuera.
    if (/^(10|127)\./.test(hostname)) return false;
    if (/^192\.168\./.test(hostname)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export default { esAlcanzableDesdeInternet };
