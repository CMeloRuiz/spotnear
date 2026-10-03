/**
 * Los proveedores de email y WhatsApp, sin red.
 *
 * No se le pega a Resend, Twilio ni Meta: se reemplaza `fetch` y se mira QUÉ
 * se les manda. Es lo que se rompe en silencio —un adjunto mal codificado, la
 * imagen que no viaja, un remitente que el proveedor rechaza— y lo que hace
 * que, apenas se carguen las credenciales reales, los envíos funcionen sin
 * tocar código.
 */
import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import env from '../../src/config/env.js';
import {
  enviarEmail,
  REMITENTE_DE_PRUEBA_RESEND,
  esRestriccionDeModoPrueba,
} from '../../src/services/notifications/email.js';
import { enviarWhatsApp } from '../../src/services/notifications/whatsapp.js';
import {
  admiteVueltaAutomatica,
  urlDeVuelta,
  hayVueltaAutomatica,
} from '../../src/services/payments/mercadopago.js';

const fetchOriginal = globalThis.fetch;
let envOriginal;
let pedidos;

/** Reemplaza fetch por una lista de respuestas, en orden. */
function responder(...respuestas) {
  globalThis.fetch = async (url, opciones) => {
    pedidos.push({ url: String(url), opciones });
    const r = respuestas.shift() ?? { status: 200, body: {} };
    return new Response(JSON.stringify(r.body), { status: r.status });
  };
}

beforeEach(() => {
  envOriginal = { ...env };
  pedidos = [];
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
  Object.assign(env, envOriginal);
});

describe('email con Resend', () => {
  beforeEach(() => {
    Object.assign(env, { RESEND_API_KEY: 're_prueba', resendHabilitado: true });
  });

  test('manda el comprobante con la imagen adjunta en base64', async () => {
    responder({ status: 200, body: { id: 'email-1' } });

    const r = await enviarEmail({
      destino: 'cliente@ejemplo.com',
      asunto: 'Reserva SN-ABC123',
      html: '<p>hola</p>',
      adjuntos: [{ filename: 'spotnear-SN-ABC123.png', content: Buffer.from('png') }],
    });

    assert.equal(r.estado, 'ENVIADO');
    assert.equal(pedidos[0].url, 'https://api.resend.com/emails');
    assert.equal(pedidos[0].opciones.headers.Authorization, 'Bearer re_prueba');
    const cuerpo = JSON.parse(pedidos[0].opciones.body);
    assert.deepEqual(cuerpo.to, ['cliente@ejemplo.com']);
    assert.equal(cuerpo.attachments[0].content, Buffer.from('png').toString('base64'));
  });

  test('si el dominio no está verificado, reintenta desde el remitente de prueba de Resend', async () => {
    responder(
      { status: 403, body: { message: 'The spotnear.com.ar domain is not verified. Please, add and verify your domain.' } },
      { status: 200, body: { id: 'email-2' } },
    );

    const r = await enviarEmail({ destino: 'yo@ejemplo.com', asunto: 'x', html: 'x' });

    assert.equal(r.estado, 'ENVIADO');
    assert.equal(pedidos.length, 2);
    assert.equal(JSON.parse(pedidos[0].opciones.body).from, env.MAIL_FROM);
    assert.equal(JSON.parse(pedidos[1].opciones.body).from, REMITENTE_DE_PRUEBA_RESEND);
  });

  test('en modo prueba, mandar a otra casilla falla con un motivo reconocible', async () => {
    const motivo = 'You can only send testing emails to your own email address (yo@ejemplo.com).';
    responder({ status: 403, body: { message: motivo } });

    const r = await enviarEmail({ destino: 'otro@ejemplo.com', asunto: 'x', html: 'x' });

    assert.equal(r.estado, 'FALLIDO');
    assert.equal(esRestriccionDeModoPrueba(r.error), true);
  });

  test('sin API key no rompe: queda SIMULADO', async () => {
    Object.assign(env, { RESEND_API_KEY: '', resendHabilitado: false, smtpHabilitado: false });
    responder();

    const r = await enviarEmail({ destino: 'a@b.com', asunto: 'x', html: 'x' });

    assert.equal(r.estado, 'SIMULADO');
    assert.equal(pedidos.length, 0);
  });
});

describe('WhatsApp con imagen', () => {
  const png = async () => Buffer.from('imagen-del-comprobante');

  test('Twilio adjunta la imagen del comprobante como MediaUrl', async () => {
    Object.assign(env, {
      whatsappTwilioHabilitado: true,
      whatsappCloudHabilitado: false,
      TWILIO_ACCOUNT_SID: 'AC123',
      TWILIO_AUTH_TOKEN: 'tok',
      TWILIO_WHATSAPP_FROM: '+14155238886',
    });
    responder({ status: 201, body: { sid: 'SM1' } });

    const imagenUrl = 'https://api.spotnear.com.ar/api/v1/reservations/comprobante/t/comprobante.png';
    const r = await enviarWhatsApp({ destino: '+5491161173398', texto: 'Código SN-1', imagenUrl, imagenPng: png });

    assert.equal(r.estado, 'ENVIADO');
    const cuerpo = new URLSearchParams(pedidos[0].opciones.body);
    assert.equal(cuerpo.get('MediaUrl'), imagenUrl);
    assert.equal(cuerpo.get('To'), 'whatsapp:+5491161173398');
    assert.equal(cuerpo.get('Body'), 'Código SN-1');
  });

  test('Twilio no recibe un link a localhost: falla antes, con el motivo', async () => {
    Object.assign(env, {
      whatsappTwilioHabilitado: true,
      TWILIO_ACCOUNT_SID: 'AC123',
      TWILIO_AUTH_TOKEN: 'tok',
    });
    responder();

    const r = await enviarWhatsApp({
      destino: '+5491161173398',
      texto: 'x',
      imagenUrl: 'http://localhost:4000/api/v1/reservations/comprobante/t/comprobante.png',
    });

    assert.equal(r.estado, 'FALLIDO');
    assert.match(r.error, /PUBLIC_API_URL/);
    assert.equal(pedidos.length, 0, 'no se llamó a Twilio');
  });

  test('Cloud API sube la imagen y la manda por su id, sin depender de una URL pública', async () => {
    Object.assign(env, {
      whatsappTwilioHabilitado: false,
      whatsappCloudHabilitado: true,
      WHATSAPP_PHONE_NUMBER_ID: '999',
      WHATSAPP_ACCESS_TOKEN: 'meta',
    });
    responder({ status: 200, body: { id: 'media-77' } }, { status: 200, body: { messages: [{ id: 'wamid.1' }] } });

    const r = await enviarWhatsApp({
      destino: '+54 9 11 6117-3398',
      texto: 'Código SN-1',
      imagenUrl: 'http://localhost:4000/no-publica.png',
      imagenPng: png,
    });

    assert.equal(r.estado, 'ENVIADO');
    assert.match(pedidos[0].url, /\/999\/media$/);
    assert.ok(pedidos[0].opciones.body instanceof FormData);
    const mensaje = JSON.parse(pedidos[1].opciones.body);
    assert.equal(mensaje.type, 'image');
    assert.equal(mensaje.image.id, 'media-77');
    assert.equal(mensaje.image.caption, 'Código SN-1');
    assert.equal(mensaje.to, '5491161173398');
  });
});

describe('vuelta automática de Mercado Pago', () => {
  test('la regla es https: http no sirve, ni siquiera con un dominio público', () => {
    assert.equal(admiteVueltaAutomatica('https://abc.trycloudflare.com'), true);
    assert.equal(admiteVueltaAutomatica('https://127.0.0.1.nip.io'), true);
    assert.equal(admiteVueltaAutomatica('http://localhost:5173'), false);
    assert.equal(admiteVueltaAutomatica('http://example.com'), false);
    assert.equal(admiteVueltaAutomatica('no es una url'), false);
  });

  test('con la API en https, la vuelta pasa por ella; si no, va directo a la web', () => {
    const reserva = { publicToken: 'tok_123456789012345678901' };

    Object.assign(env, { PUBLIC_API_URL: 'https://abc.trycloudflare.com', PUBLIC_WEB_URL: 'http://localhost:5173' });
    assert.equal(
      urlDeVuelta(reserva),
      'https://abc.trycloudflare.com/api/v1/payments/mercadopago/vuelta/tok_123456789012345678901',
    );
    assert.equal(hayVueltaAutomatica(), true);

    Object.assign(env, { PUBLIC_API_URL: 'http://localhost:4000', PUBLIC_WEB_URL: 'http://localhost:5173' });
    assert.equal(urlDeVuelta(reserva), 'http://localhost:5173/pago/tok_123456789012345678901');
    assert.equal(hayVueltaAutomatica(), false);
  });
});
