/**
 * Cobro de la seña con Mercado Pago — Checkout Pro.
 *
 * Por qué Checkout Pro y no un checkout embebido (Payment Bricks): con Checkout
 * Pro los datos de la tarjeta nunca pasan por nuestro servidor. Se crea una
 * "preferencia de pago" por el monto de la seña, se manda al cliente al
 * checkout de Mercado Pago y él elige ahí con qué pagar (tarjeta, dinero en
 * cuenta, efectivo). Nosotros solo necesitamos saber si se acreditó. Si más
 * adelante se quiere el pago en la misma página, se migra a Bricks sin tocar el
 * resto del flujo: el contrato de este archivo no cambia.
 *
 * DOS CAMINOS PARA ENTERARSE DEL PAGO, Y LOS DOS HACEN FALTA
 *
 *  1. El webhook (`notification_url`): Mercado Pago avisa por su cuenta. Es el
 *     confiable, porque no depende de que el cliente vuelva al sitio. Un pago
 *     en efectivo se acredita horas después, con el navegador cerrado.
 *  2. La consulta directa (`consultarEstado`): le preguntamos a la API por el
 *     pago. Es la que usa la pantalla de "estamos confirmando tu pago" y la que
 *     hace que todo esto sea probable en localhost, donde el webhook no puede
 *     llegar porque Mercado Pago no alcanza una URL privada.
 *
 * En los dos casos el estado se lee de la API de Mercado Pago. Nunca se cree
 * que un pago está aprobado porque el navegador volvió con `?status=approved`
 * en la URL: eso lo escribe cualquiera.
 */
import { MercadoPagoConfig, Preference, Payment, User } from 'mercadopago';
import env from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { esAlcanzableDesdeInternet } from '../../utils/urls.js';

/** Minutos que la preferencia queda abierta antes de vencer. */
export const MINUTOS_PARA_PAGAR = 30;

/**
 * Traducción de los estados de Mercado Pago a los nuestros.
 *
 *  · approved              → la seña está. La reserva se confirma.
 *  · pending / in_process  → puede terminar bien (un cupón de pago fácil, una
 *                            tarjeta en revisión). Se espera, no se cancela.
 *  · rejected / cancelled  → no hay seña. La reserva queda para reintentar.
 *  · refunded / charged_back → plata devuelta.
 */
const ESTADOS = {
  approved: 'PAGADO',
  authorized: 'PAGADO',
  pending: 'PENDIENTE',
  in_process: 'PENDIENTE',
  in_mediation: 'PENDIENTE',
  rejected: 'FALLIDO',
  cancelled: 'FALLIDO',
  refunded: 'REEMBOLSADO',
  charged_back: 'REEMBOLSADO',
};

export function traducirEstado(estadoMP) {
  return ESTADOS[estadoMP] ?? 'PENDIENTE';
}

let configCacheada = null;

function config() {
  if (!env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new AppError(
      'El pago en línea no está disponible en este momento.',
      503,
      'PASARELA_NO_CONFIGURADA',
      { detalle: 'Falta MERCADOPAGO_ACCESS_TOKEN en el .env del backend.' },
    );
  }
  configCacheada ??= new MercadoPagoConfig({
    accessToken: env.MERCADOPAGO_ACCESS_TOKEN,
    options: { timeout: 10_000 },
  });
  return configCacheada;
}

/**
 * El webhook (`notification_url`) solo se manda si la API es alcanzable desde
 * internet: Mercado Pago le pega desde sus servidores. En desarrollo, sin
 * túnel, no se manda y la confirmación entra por la consulta directa.
 */
export { esAlcanzableDesdeInternet };

/** URL a la que Mercado Pago manda los avisos de cambio de estado. */
export function urlDelWebhook() {
  return `${env.PUBLIC_API_URL}/api/v1/payments/mercadopago/webhook`;
}

/**
 * ¿Mercado Pago acepta esta URL para devolver al cliente solo (`auto_return`)?
 *
 * La regla real es el protocolo, no que sea pública. Probado contra la API:
 * rechaza `auto_return` con cualquier `http://` —incluso
 * `http://example.com`— con el error "auto_return invalid. back_url.success
 * must be defined", y lo acepta con cualquier `https://`, incluso con puerto o
 * con un dominio que apunta a 127.0.0.1. Con localhost en http no hay vuelta
 * automática posible, por más que el resto esté bien configurado.
 */
export function admiteVueltaAutomatica(url) {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Ruta de la API que recibe al cliente cuando vuelve del checkout. */
export const RUTA_DE_VUELTA = '/api/v1/payments/mercadopago/vuelta';

/**
 * A dónde manda Mercado Pago al cliente cuando termina de pagar.
 *
 * Si la API está en https, la vuelta pasa por ella (`/payments/mercadopago/
 * vuelta/:token`): ahí se le pregunta a Mercado Pago por el pago ANTES de que
 * cargue la pantalla —así el comprobante suele estar listo al llegar, aunque el
 * webhook no haya llegado todavía— y se redirige a `/pago/:token` de la web.
 * Es el mismo camino en producción y en desarrollo con un túnel https hacia el
 * backend (ver README): lo que se prueba en local es lo que corre en
 * producción, y la web puede seguir en http://localhost.
 *
 * Sin API en https, se vuelve directo a la web, si ella lo está. Y si ninguna
 * lo está, la URL se manda igual —sirve para el botón "Volver al sitio"— pero
 * sin vuelta automática.
 */
export function urlDeVuelta(reserva) {
  if (admiteVueltaAutomatica(env.PUBLIC_API_URL)) {
    return `${env.PUBLIC_API_URL}${RUTA_DE_VUELTA}/${reserva.publicToken}`;
  }
  return `${env.PUBLIC_WEB_URL}/pago/${reserva.publicToken}`;
}

/** ¿El cliente vuelve solo a SpotNear cuando termina de pagar? */
export function hayVueltaAutomatica() {
  return admiteVueltaAutomatica(env.PUBLIC_API_URL) || admiteVueltaAutomatica(env.PUBLIC_WEB_URL);
}

/**
 * Crea la preferencia de Checkout Pro por el monto de la seña.
 *
 * @param {object} reserva      Con parking, customer y vehicle incluidos.
 * @param {number} monto        La seña, en pesos.
 * @returns {Promise<{ requierePago: true, estado: 'PENDIENTE', urlPago: string, ref: string }>}
 */
async function crearPreferencia(reserva, monto) {
  const preference = new Preference(config());

  const ahora = new Date();
  const vence = new Date(ahora.getTime() + MINUTOS_PARA_PAGAR * 60_000);
  const vuelta = urlDeVuelta(reserva);
  const webhook = urlDelWebhook();

  const body = {
    items: [
      {
        id: reserva.codigo,
        // Lo que el cliente ve en el resumen del checkout de Mercado Pago. Se
        // dice que es la seña y de qué estacionamiento, porque el resto de la
        // tarifa la va a pagar allá y no queremos que crea que pagó todo.
        title: `Seña de reserva ${reserva.codigo}`,
        description: `Reserva en ${reserva.parking?.nombre ?? 'el estacionamiento'}. El resto de la tarifa se paga en el lugar.`,
        category_id: 'services',
        quantity: 1,
        currency_id: reserva.moneda ?? env.MONEDA,
        unit_price: monto,
      },
    ],
    payer: {
      name: reserva.clienteNombre ?? reserva.customer?.nombre ?? undefined,
      surname: reserva.clienteApellido ?? reserva.customer?.apellido ?? undefined,
      // Solo el email que la persona escribió en ESTA reserva. Nunca el del
      // Customer: ese se reutiliza por teléfono y arrastra el de reservas
      // anteriores, así que se le mandaría a Mercado Pago un comprador que
      // nadie declaró (y, si el teléfono es el del dueño de la cuenta, el checkout
      // se bloquea porque comprador y vendedor coinciden). Sin email, Mercado
      // Pago se lo pide en su pantalla.
      email: reserva.clienteEmail ?? undefined,
    },
    // La bisagra de todo: con esto el webhook sabe de qué reserva habla.
    external_reference: reserva.id,
    metadata: { reserva_id: reserva.id, codigo: reserva.codigo },
    statement_descriptor: 'SPOTNEAR',
    // La preferencia vence: un lugar apartado no puede quedar tomado para
    // siempre por alguien que abrió el checkout y se fue.
    expires: true,
    expiration_date_from: ahora.toISOString(),
    expiration_date_to: vence.toISOString(),
  };

  // Las back_urls van SIEMPRE: el link de vuelta lo sigue el navegador del
  // cliente, no Mercado Pago. Las tres apuntan al mismo lugar porque la
  // pantalla de pago no se fía de cuál de ellas se usó: le pregunta el estado
  // al backend, que se lo pregunta a Mercado Pago.
  body.back_urls = { success: vuelta, pending: vuelta, failure: vuelta };

  // auto_return: el cliente vuelve SOLO, sin tocar nada. 'all' y no
  // 'approved': así también vuelve cuando el pago queda pendiente (efectivo) o
  // rechazado, y es SpotNear quien le explica qué pasó y le ofrece reintentar,
  // en vez de dejarlo en la pantalla de Mercado Pago. Mercado Pago solo lo
  // acepta con una URL https (ver admiteVueltaAutomatica).
  if (admiteVueltaAutomatica(vuelta)) {
    body.auto_return = 'all';
  } else {
    console.warn(
      `[mercadopago] la URL de vuelta (${vuelta}) no es https: Mercado Pago no devuelve al ` +
        'cliente solo. Para tenerlo en desarrollo, exponé el backend con un túnel https ' +
        '(cloudflared) y poné esa URL en PUBLIC_API_URL. Ver README → "La vuelta a SpotNear".',
    );
  }
  if (esAlcanzableDesdeInternet(webhook)) {
    body.notification_url = webhook;
  } else {
    console.warn(
      `[mercadopago] PUBLIC_API_URL (${env.PUBLIC_API_URL}) no es alcanzable desde internet: ` +
        'la preferencia se crea sin webhook y el pago se confirma consultando la API ' +
        'desde la pantalla de pago. Para probar el webhook, exponé el backend con un túnel ' +
        '(ngrok, cloudflared) y poné esa URL en PUBLIC_API_URL.',
    );
  }

  const creada = await preference.create({ body });

  // sandbox_init_point existe solo con credenciales de prueba; init_point es el
  // que sirve en los dos casos.
  const urlPago = creada.init_point ?? creada.sandbox_init_point;
  if (!urlPago) {
    throw new AppError(
      'Mercado Pago no devolvió el link de pago.',
      502,
      'PASARELA_SIN_LINK',
      { detalle: JSON.stringify(creada).slice(0, 300) },
    );
  }

  return { requierePago: true, estado: 'PENDIENTE', urlPago, ref: String(creada.id) };
}

/**
 * Busca el pago de una reserva en Mercado Pago y devuelve su estado.
 *
 * Se busca por `external_reference` (el id de la reserva) y no por el id de la
 * preferencia: una preferencia puede tener varios intentos de pago y lo que
 * interesa es si ALGUNO se acreditó.
 *
 * @param {object} reserva
 * @returns {Promise<{ estado: string, detalle: string|null, pagoId: string|null }>}
 */
async function consultarEstado(reserva) {
  const payment = new Payment(config());

  const encontrados = await payment.search({
    options: { external_reference: reserva.id, sort: 'date_created', criteria: 'desc', limit: 20 },
  });

  const pagos = encontrados?.results ?? [];
  if (pagos.length === 0) {
    // Todavía no intentó pagar, o abandonó el checkout antes de elegir medio.
    return { estado: 'PENDIENTE', detalle: null, pagoId: null };
  }

  // Si hay uno aprobado, ese manda: da igual que antes le hayan rechazado dos.
  const aprobado = pagos.find((p) => traducirEstado(p.status) === 'PAGADO');
  const enEspera = pagos.find((p) => ['pending', 'in_process'].includes(p.status));
  const elegido = aprobado ?? enEspera ?? pagos[0];

  return {
    estado: traducirEstado(elegido.status),
    detalle: elegido.status_detail ? `${elegido.status}/${elegido.status_detail}` : elegido.status,
    pagoId: String(elegido.id),
  };
}

/**
 * Lee un pago puntual por su id. Es lo que usa el webhook: el aviso trae el id
 * del pago y nada más, así que el estado se consulta contra la API en vez de
 * confiar en el cuerpo del aviso.
 *
 * @param {string|number} pagoId
 */
export async function leerPago(pagoId) {
  const payment = new Payment(config());
  const pago = await payment.get({ id: String(pagoId) });

  return {
    id: String(pago.id),
    reservaId: pago.external_reference ?? pago.metadata?.reserva_id ?? null,
    estado: traducirEstado(pago.status),
    estadoMP: pago.status,
    detalle: pago.status_detail ? `${pago.status}/${pago.status_detail}` : pago.status,
    monto: pago.transaction_amount ?? null,
  };
}

let emailVendedorCacheado;
let cuentaVendedoraCacheada;

/**
 * Datos de la cuenta dueña del access token (GET /users/me), una sola vez.
 * Si la consulta falla no se cachea: se reintenta en la próxima.
 */
async function cuentaVendedora() {
  if (cuentaVendedoraCacheada) return cuentaVendedoraCacheada;
  cuentaVendedoraCacheada = await new User(config()).get();
  return cuentaVendedoraCacheada;
}

/**
 * ¿Las credenciales son de prueba (sandbox)?
 *
 * No alcanza con mirar el prefijo. Hay dos formatos de credenciales de prueba
 * y los dos están vigentes:
 *  · `TEST-…`: las de prueba de una cuenta REAL (el formato viejo);
 *  · `APP_USR-…` de una CUENTA DE PRUEBA: es lo que muestra hoy el panel de
 *    Mercado Pago en "Credenciales de prueba". Tienen el mismo prefijo que las
 *    de producción; lo que las distingue es que la cuenta tiene el tag
 *    `test_user`.
 *
 * @returns {Promise<boolean|null>} null si no se pudo averiguar.
 */
export async function credencialesDePrueba() {
  if (!env.MERCADOPAGO_ACCESS_TOKEN) return null;
  if (env.MERCADOPAGO_ACCESS_TOKEN.startsWith('TEST-')) return true;
  try {
    const yo = await cuentaVendedora();
    return Array.isArray(yo?.tags) && yo.tags.includes('test_user');
  } catch (error) {
    console.warn('[mercadopago] no se pudo saber si la cuenta es de prueba:', error.message);
    return null;
  }
}

/**
 * Email de la cuenta de Mercado Pago dueña del access token (la vendedora).
 *
 * Existe por una trampa que costó dos tardes: Mercado Pago no deja que el
 * comprador sea el mismo que el vendedor, y cuando pasa, el botón "Pagar" de su
 * checkout no hace NADA —ni error, ni aviso, ni una petición—. Sabiendo este
 * email, SpotNear lo rechaza en su propio formulario con un mensaje que se
 * entiende, en vez de dejar al cliente frente a un botón muerto.
 *
 * Se consulta una vez y se cachea. Si la consulta falla, devuelve null y el
 * chequeo simplemente no se hace: nunca bloquea una reserva por esto.
 */
export async function emailDelVendedor() {
  if (emailVendedorCacheado !== undefined) return emailVendedorCacheado;
  try {
    const yo = await cuentaVendedora();
    emailVendedorCacheado = yo?.email ? String(yo.email).toLowerCase() : null;
  } catch (error) {
    console.warn('[mercadopago] no se pudo leer el email de la cuenta vendedora:', error.message);
    return null;
  }
  return emailVendedorCacheado;
}

export const proveedorMercadoPago = {
  nombre: 'mercadopago',
  /** Sin access token no se puede cobrar, y conviene saberlo antes de reservar. */
  listo: () => Boolean(env.MERCADOPAGO_ACCESS_TOKEN),
  crearPreferencia,
  consultarEstado,
};

export default proveedorMercadoPago;
