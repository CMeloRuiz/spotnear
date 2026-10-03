/**
 * Webhook de la pasarela: /api/v1/payments
 *
 * Es la vía por la que Mercado Pago avisa que un pago cambió de estado, sin que
 * nadie tenga que estar mirando. Hace falta porque el cliente puede cerrar el
 * navegador antes de volver al sitio, y porque un pago en efectivo se acredita
 * horas después.
 *
 * DOS REGLAS QUE NO SE NEGOCIAN
 *
 *  1. El aviso NO se cree. Trae un id de pago y nada más; el estado se lee
 *     consultando la API de Mercado Pago con nuestro access token. Un aviso
 *     falso, entonces, no puede confirmar nada: lo peor que logra es hacernos
 *     consultar un pago que no existe.
 *  2. Siempre se responde 200, incluso ante un error nuestro. Si se responde
 *     500, Mercado Pago reintenta el mismo aviso durante horas; y como la
 *     pantalla de pago igual consulta por su cuenta, un aviso perdido no deja
 *     la reserva colgada.
 *
 * Además se valida la firma `x-signature` cuando hay MERCADOPAGO_WEBHOOK_SECRET
 * cargado. Es defensa en profundidad: sin secreto configurado el webhook sigue
 * funcionando, apoyado en la regla 1.
 */
import crypto from 'node:crypto';
import { Router } from 'express';
import env from '../../config/env.js';
import { asyncHandler } from '../../middleware/error.js';
import { leerPago } from '../../services/payments/mercadopago.js';
import * as servicio from '../reservations/reservations.service.js';

const router = Router();

/**
 * Valida la firma del aviso.
 *
 * Mercado Pago manda `x-signature: ts=<ts>,v1=<hmac>` y `x-request-id`. El HMAC
 * se calcula sobre `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` con el
 * secreto de la aplicación.
 *
 * @returns {boolean} true si no hay secreto configurado (no se valida nada).
 */
export function firmaValida(req, idDelPago) {
  if (!env.MERCADOPAGO_WEBHOOK_SECRET) return true;

  const firma = req.get('x-signature');
  const requestId = req.get('x-request-id') ?? '';
  if (!firma) return false;

  const partes = Object.fromEntries(
    firma.split(',').map((p) => p.split('=').map((x) => x.trim())),
  );
  if (!partes.ts || !partes.v1) return false;

  const cadena = `id:${idDelPago};request-id:${requestId};ts:${partes.ts};`;
  const esperado = crypto
    .createHmac('sha256', env.MERCADOPAGO_WEBHOOK_SECRET)
    .update(cadena)
    .digest('hex');

  // Comparación en tiempo constante: si no, la diferencia de tiempos filtra
  // cuántos caracteres del HMAC acertó quien lo esté probando.
  const a = Buffer.from(esperado, 'utf8');
  const b = Buffer.from(partes.v1, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Saca el id del pago del aviso, sea cual sea el formato.
 *
 * Mercado Pago tiene tres formas vivas de avisar lo mismo, según la antigüedad
 * de la integración: el webhook nuevo (body `{ type, data: { id } }`), el mismo
 * dato en el querystring (`?type=payment&data.id=`) y el IPN viejo
 * (`?topic=payment&id=`). Se aceptan las tres.
 */
export function idDelPagoDelAviso(req) {
  const tipo = req.body?.type ?? req.query?.type ?? req.query?.topic ?? null;
  if (tipo && !['payment', 'merchant_order'].includes(tipo)) return { tipo, id: null };

  const id =
    req.body?.data?.id ??
    req.query?.['data.id'] ??
    req.body?.resource ??
    req.query?.id ??
    null;

  return { tipo: tipo ?? 'payment', id: id ? String(id) : null };
}

/**
 * POST /api/v1/payments/mercadopago/webhook
 * (también acepta GET, que es como prueba el panel de Mercado Pago)
 */
const manejarAviso = asyncHandler(async (req, res) => {
  const { tipo, id } = idDelPagoDelAviso(req);

  // Los avisos de merchant_order y compañía se aceptan y se ignoran: el que
  // interesa es el del pago.
  if (tipo !== 'payment' || !id) return res.status(200).json({ recibido: true, ignorado: true });

  if (!firmaValida(req, id)) {
    console.warn('[pagos] aviso con firma inválida, descartado. Pago:', id);
    return res.status(200).json({ recibido: true, ignorado: true });
  }

  try {
    const pago = await leerPago(id);

    if (!pago.reservaId) {
      console.warn('[pagos] el pago', id, 'no trae external_reference: no se sabe de qué reserva es.');
      return res.status(200).json({ recibido: true, ignorado: true });
    }

    if (pago.estado === 'PAGADO') {
      // Acá y solo acá salen el comprobante del cliente y el aviso al grupo
      // del estacionamiento. Ver acreditarSenaYAvisar en el servicio.
      await servicio.acreditarSenaYAvisar(pago.reservaId, {
        pagoId: pago.id,
        detalle: pago.detalle,
      });
    } else {
      await servicio.registrarSenaNoAcreditada(pago.reservaId, {
        estado: pago.estado,
        detalle: pago.detalle,
      });
    }
  } catch (error) {
    // Se registra y se responde OK igual: reintentar no arregla un error
    // nuestro, y la pantalla de pago consulta por su cuenta.
    console.error('[pagos] error procesando el aviso del pago', id, error.message);
  }

  return res.status(200).json({ recibido: true });
});

router.post('/mercadopago/webhook', manejarAviso);
router.get('/mercadopago/webhook', manejarAviso);

/** Lo que dice Mercado Pago en la URL de vuelta, traducido a una pista para la pantalla. */
const PISTAS_DE_VUELTA = {
  approved: 'aprobado',
  authorized: 'aprobado',
  pending: 'pendiente',
  in_process: 'pendiente',
  rejected: 'rechazado',
  cancelled: 'rechazado',
};

/** Cuánto se espera la consulta a Mercado Pago antes de redirigir igual. */
const ESPERA_MAXIMA_MS = 4000;

/**
 * GET /api/v1/payments/mercadopago/vuelta/:token
 *
 * La `back_url` de la preferencia. Mercado Pago manda acá al cliente apenas
 * termina en su checkout (aprobado, pendiente o rechazado: `auto_return: all`).
 *
 * Antes de redirigir a la pantalla de pago de la web, le pregunta a Mercado
 * Pago por el pago. Si está aprobado, la reserva se confirma en ese momento
 * —con el comprobante y los avisos, una sola vez aunque el webhook llegue en
 * paralelo—, así que el cliente suele llegar a SpotNear con el comprobante ya
 * listo, sin depender de que el webhook haya llegado.
 *
 * El `status` del querystring NO decide nada: lo escribe cualquiera. Solo viaja
 * como pista para que la pantalla elija qué mostrar mientras confirma.
 */
router.get(
  '/mercadopago/vuelta/:token',
  asyncHandler(async (req, res) => {
    const { token } = req.params;

    // El destino es siempre la web de SpotNear: no hay redirección abierta.
    if (!/^[\w-]{20,}$/.test(token)) return res.redirect(303, env.PUBLIC_WEB_URL);

    const estadoMP = String(req.query.collection_status ?? req.query.status ?? '');
    const pista = PISTAS_DE_VUELTA[estadoMP] ?? 'sin-dato';

    try {
      const reserva = await servicio.obtenerPorToken(token);
      if (servicio.esperandoLaSena(reserva)) {
        // Con tope de tiempo: si Mercado Pago tarda, la pantalla sigue
        // consultando por su cuenta. Lo que no puede pasar es dejar al cliente
        // mirando una pantalla en blanco.
        await Promise.race([
          servicio.sincronizarPago(reserva),
          new Promise((resolver) => setTimeout(resolver, ESPERA_MAXIMA_MS)),
        ]);
      }
    } catch (error) {
      console.warn('[pagos] no se pudo sincronizar el pago al volver del checkout:', error.message);
    }

    return res.redirect(303, `${env.PUBLIC_WEB_URL}/pago/${token}?vuelta=${pista}`);
  }),
);

/**
 * GET /api/v1/payments/estado
 * Diagnóstico rápido de la configuración de la pasarela. No expone secretos.
 */
router.get('/estado', (req, res) => {
  res.json({
    proveedor: env.PAYMENT_PROVIDER,
    credencialesCargadas: Boolean(env.MERCADOPAGO_ACCESS_TOKEN),
    modo: env.MERCADOPAGO_ACCESS_TOKEN
      ? env.MERCADOPAGO_ACCESS_TOKEN.startsWith('TEST-')
        ? 'prueba'
        : 'produccion'
      : null,
    firmaDeWebhook: Boolean(env.MERCADOPAGO_WEBHOOK_SECRET),
  });
});

export default router;
