/**
 * Las piezas de la integración con Mercado Pago que se pueden probar sin red.
 *
 * Son tres, y las tres rompen el flujo si fallan en silencio:
 *
 *  · la traducción de estados: confundir `in_process` con `rejected` le dice al
 *    cliente que su pago falló cuando en realidad está por acreditarse;
 *  · el reconocimiento de URLs públicas: mandarle a Mercado Pago una
 *    notification_url apuntando a localhost hace que rechace la preferencia
 *    entera y no se pueda ni empezar a cobrar;
 *  · el parseo del aviso: Mercado Pago tiene tres formatos vivos para avisar lo
 *    mismo, y el que no se reconozca queda ignorado sin que nadie se entere.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { traducirEstado, esAlcanzableDesdeInternet } from '../../src/services/payments/mercadopago.js';
import { idDelPagoDelAviso } from '../../src/modules/payments/payments.routes.js';

describe('estados de Mercado Pago', () => {
  test('solo `approved` y `authorized` valen como seña acreditada', () => {
    assert.equal(traducirEstado('approved'), 'PAGADO');
    assert.equal(traducirEstado('authorized'), 'PAGADO');
  });

  test('lo que todavía puede salir bien espera, no se rechaza', () => {
    assert.equal(traducirEstado('pending'), 'PENDIENTE');
    assert.equal(traducirEstado('in_process'), 'PENDIENTE');
    assert.equal(traducirEstado('in_mediation'), 'PENDIENTE');
  });

  test('lo que no va a salir bien queda para reintentar', () => {
    assert.equal(traducirEstado('rejected'), 'FALLIDO');
    assert.equal(traducirEstado('cancelled'), 'FALLIDO');
  });

  test('un estado desconocido espera en vez de dar la reserva por perdida', () => {
    assert.equal(traducirEstado('un_estado_que_no_existe'), 'PENDIENTE');
    assert.equal(traducirEstado(undefined), 'PENDIENTE');
  });
});

describe('qué URLs alcanza Mercado Pago', () => {
  test('una URL pública sí', () => {
    assert.equal(esAlcanzableDesdeInternet('https://api.spotnear.com.ar'), true);
    assert.equal(esAlcanzableDesdeInternet('https://algo.ngrok-free.app'), true);
  });

  test('localhost y las redes privadas no', () => {
    for (const url of [
      'http://localhost:4000',
      'http://127.0.0.1:4000',
      'http://192.168.0.10:4000',
      'http://10.0.0.5',
      'http://172.16.3.1',
      'http://api.local',
    ]) {
      assert.equal(esAlcanzableDesdeInternet(url), false, `${url} no la ve Mercado Pago`);
    }
  });

  test('una URL rota tampoco', () => {
    assert.equal(esAlcanzableDesdeInternet('esto no es una url'), false);
    assert.equal(esAlcanzableDesdeInternet(''), false);
  });
});

describe('avisos del webhook', () => {
  /** El request mínimo que necesita el parser. */
  const pedido = (body = {}, query = {}) => ({ body, query });

  test('formato nuevo: el id viene en el cuerpo', () => {
    const r = idDelPagoDelAviso(pedido({ type: 'payment', data: { id: 12345 } }));
    assert.deepEqual(r, { tipo: 'payment', id: '12345' });
  });

  test('formato con querystring', () => {
    const r = idDelPagoDelAviso(pedido({}, { type: 'payment', 'data.id': '999' }));
    assert.deepEqual(r, { tipo: 'payment', id: '999' });
  });

  test('IPN viejo: topic + id', () => {
    const r = idDelPagoDelAviso(pedido({}, { topic: 'payment', id: '777' }));
    assert.deepEqual(r, { tipo: 'payment', id: '777' });
  });

  test('un aviso de otro tema se reconoce y se deja pasar sin id', () => {
    const r = idDelPagoDelAviso(pedido({ type: 'plan', data: { id: 1 } }));
    assert.equal(r.id, null);
  });
});
