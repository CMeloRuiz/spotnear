/**
 * Adaptador de WhatsApp.
 *
 * Tres proveedores, elegidos por WHATSAPP_PROVIDER. La interfaz no cambia entre
 * ellos: quien consume este módulo llama a `enviarWhatsApp()` y no se entera de
 * cuál está activo.
 *
 *  · link (default)  No envía nada solo. Devuelve un link wa.me para que una
 *                    persona lo abra. Es lo que ya se hacía a mano, pero con el
 *                    mensaje armado. NO sirve para automatizar: wa.me solo
 *                    prellena texto y exige que alguien toque "Enviar".
 *
 *  · twilio          Envío automático de verdad, desde el servidor, sin que
 *                    nadie toque nada. Es el camino corto: el sandbox de Twilio
 *                    se activa en minutos, sin verificar una empresa.
 *
 *  · cloud_api       Envío automático con la Cloud API de Meta. Más barato a
 *                    escala y sin intermediario, pero pide Business Manager con
 *                    el número verificado y plantillas aprobadas.
 *
 * Con twilio o cloud_api, el aviso al grupo del estacionamiento sale solo
 * apenas el cliente termina de reservar. Si faltan credenciales, el envío
 * devuelve PENDIENTE con un log claro y la reserva se confirma igual: una
 * notificación no puede tirar abajo una reserva ya hecha.
 */
import env from '../../config/env.js';
import { esAlcanzableDesdeInternet } from '../../utils/urls.js';
import { linkWhatsApp } from './messages.js';

/**
 * @typedef {object} ResultadoEnvio
 * @property {boolean} enviado         ¿Salió de verdad?
 * @property {'ENVIADO'|'SIMULADO'|'FALLIDO'|'PENDIENTE'} estado
 * @property {string}  proveedor
 * @property {string} [link]           Link wa.me (modo link)
 * @property {string} [idExterno]      Id del mensaje en Meta (modo cloud_api)
 * @property {string} [error]
 */

/** Proveedor "link": arma el wa.me y lo devuelve para que lo abra una persona. */
const proveedorLink = {
  nombre: 'wa.me',
  /**
   * `wa.me` solo arma texto prellenado: no puede adjuntar archivos. Por eso
   * `imagenUrl` viaja dentro del texto (quien lo arma ya la incluyó) y acá
   * solo se propaga para que quede registrada en el log.
   *
   * @param {{ destino: string, texto: string, imagenUrl?: string }} params
   * @returns {Promise<ResultadoEnvio>}
   */
  async enviar({ destino, texto, imagenUrl }) {
    const link = linkWhatsApp(destino, texto);
    return {
      enviado: false, // requiere que una persona toque el link
      estado: 'PENDIENTE',
      proveedor: 'wa.me',
      link,
      imagenUrl,
    };
  },
};

/**
 * Proveedor "cloud_api": envío real vía Meta.
 * Queda implementado y listo; solo hay que cargar las credenciales en el .env
 * y aprobar la plantilla del mensaje en el Business Manager.
 */
const proveedorCloudApi = {
  nombre: 'cloud_api',
  /**
   * Con imagen manda un mensaje de tipo `image`, con el texto de pie: es el
   * envío que de verdad le deja el comprobante visual en el chat.
   *
   * La imagen se SUBE a Meta (`/media`) y se manda por su id, en vez de
   * pasarle una URL para que la descargue: así funciona aunque la API de
   * SpotNear no sea alcanzable desde internet (en desarrollo, por ejemplo). Si
   * la subida falla y hay una URL pública, se usa la URL.
   *
   * @param {{ destino: string, texto: string, imagenUrl?: string, imagenPng?: () => Promise<Buffer> }} params
   * @returns {Promise<ResultadoEnvio>}
   */
  async enviar({ destino, texto, imagenUrl, imagenPng }) {
    const numero = String(destino ?? '').replace(/\D/g, '');
    const base = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}`;
    const url = `${base}/messages`;

    let imagen = null;
    if (imagenPng) {
      try {
        const formulario = new FormData();
        formulario.append('messaging_product', 'whatsapp');
        formulario.append('type', 'image/png');
        formulario.append('file', new Blob([await imagenPng()], { type: 'image/png' }), 'comprobante.png');
        const subida = await fetch(`${base}/media`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
          body: formulario,
        });
        const datos = await subida.json().catch(() => ({}));
        if (subida.ok && datos?.id) imagen = { id: datos.id };
        else console.error('[whatsapp] Meta no aceptó la imagen:', datos?.error?.message ?? subida.status);
      } catch (error) {
        console.error('[whatsapp] no se pudo subir la imagen a Meta:', error.message);
      }
    }
    if (!imagen && imagenUrl && esAlcanzableDesdeInternet(imagenUrl)) imagen = { link: imagenUrl };
    if (!imagen && (imagenUrl || imagenPng)) {
      // Pedían imagen y no se pudo adjuntar: mejor fallar con un motivo claro
      // que mandar un mensaje que no es el comprobante.
      return {
        enviado: false,
        estado: 'FALLIDO',
        proveedor: 'cloud_api',
        error: 'No se pudo adjuntar la imagen del comprobante.',
      };
    }

    try {
      const respuesta = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: numero,
          ...(imagen
            // El caption de Meta admite 1024 caracteres; el pie del
            // comprobante es corto justamente para entrar acá.
            ? { type: 'image', image: { ...imagen, caption: texto.slice(0, 1024) } }
            : { type: 'text', text: { preview_url: true, body: texto } }),
        }),
      });

      const datos = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        return {
          enviado: false,
          estado: 'FALLIDO',
          proveedor: 'cloud_api',
          error: datos?.error?.message ?? `HTTP ${respuesta.status}`,
        };
      }

      return {
        enviado: true,
        estado: 'ENVIADO',
        proveedor: 'cloud_api',
        idExterno: datos?.messages?.[0]?.id,
      };
    } catch (error) {
      return {
        enviado: false,
        estado: 'FALLIDO',
        proveedor: 'cloud_api',
        error: error.message,
      };
    }
  },
};

/**
 * Proveedor "twilio": envío automático a través de la API de Twilio.
 *
 * Es un POST con autenticación básica (Account SID + Auth Token) al endpoint de
 * mensajes. Los números van con el prefijo `whatsapp:` que pide Twilio.
 *
 * Con `imagenUrl` adjunta la imagen como media: Twilio la DESCARGA de esa
 * URL desde sus servidores (no acepta el archivo subido), así que la API de
 * SpotNear tiene que ser alcanzable desde internet. En producción lo es; en
 * desarrollo hace falta el túnel de PUBLIC_API_URL (ver README). Si no lo es,
 * se corta acá con un error claro: mandar igual terminaría en un mensaje sin
 * imagen, o con un link a localhost que no abre nadie.
 */
const proveedorTwilio = {
  nombre: 'twilio',
  /**
   * @param {{ destino: string, texto: string, imagenUrl?: string }} params
   * @returns {Promise<ResultadoEnvio>}
   */
  async enviar({ destino, texto, imagenUrl }) {
    const numero = String(destino ?? '').replace(/[^\d+]/g, '');

    if (imagenUrl && !esAlcanzableDesdeInternet(imagenUrl)) {
      const motivo =
        `Twilio no puede descargar la imagen del comprobante desde ${new URL(imagenUrl).origin}: ` +
        'PUBLIC_API_URL tiene que ser una URL pública (en desarrollo, la del túnel).';
      console.error(`[whatsapp] ${motivo}`);
      return { enviado: false, estado: 'FALLIDO', proveedor: 'twilio', error: motivo };
    }
    const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;

    const cuerpo = new URLSearchParams({
      From: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
      To: `whatsapp:${numero}`,
      Body: texto,
    });
    if (imagenUrl) cuerpo.append('MediaUrl', imagenUrl);

    try {
      const respuesta = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`,
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: cuerpo,
      });

      const datos = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        const motivo = datos?.message ?? `HTTP ${respuesta.status}`;
        console.error(`[whatsapp] Twilio rechazó el envío a ${numero}: ${motivo}`);
        return { enviado: false, estado: 'FALLIDO', proveedor: 'twilio', error: motivo };
      }

      return {
        enviado: true,
        estado: 'ENVIADO',
        proveedor: 'twilio',
        idExterno: datos?.sid,
      };
    } catch (error) {
      console.error(`[whatsapp] no se pudo enviar por Twilio a ${numero}: ${error.message}`);
      return { enviado: false, estado: 'FALLIDO', proveedor: 'twilio', error: error.message };
    }
  },
};

/** Elige el proveedor según la configuración. */
function proveedorActivo() {
  if (env.whatsappTwilioHabilitado) return proveedorTwilio;
  if (env.whatsappCloudHabilitado) return proveedorCloudApi;
  return proveedorLink;
}

/** ¿El envío sale solo, sin que nadie toque nada? Lo usan los logs y el panel. */
export function envioAutomatico() {
  return proveedorActivo().nombre !== 'wa.me';
}

/**
 * Punto de entrada único. El resto del sistema llama solo a esta función.
 *
 * La imagen es opcional y cada proveedor la resuelve como puede: Twilio la
 * descarga de `imagenUrl`, cloud_api sube el PNG que devuelve `imagenPng`, y
 * wa.me no puede adjuntar nada. Quien llama no necesita saber cuál está activo.
 *
 * @param {{ destino: string, texto: string, imagenUrl?: string, imagenPng?: () => Promise<Buffer> }} params
 * @returns {Promise<ResultadoEnvio>}
 */
export async function enviarWhatsApp({ destino, texto, imagenUrl, imagenPng }) {
  return proveedorActivo().enviar({ destino, texto, imagenUrl, imagenPng });
}

/** Link wa.me sin pasar por el proveedor (lo usa el panel para el botón "Compartir"). */
export { linkWhatsApp };

export default { enviarWhatsApp, linkWhatsApp };
