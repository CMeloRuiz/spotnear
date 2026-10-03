/**
 * La vuelta desde Mercado Pago y el botón "Enviar a mi WhatsApp".
 *
 *  · La vuelta siempre termina en la pantalla de pago de SpotNear, con una
 *    pista de lo que dijo Mercado Pago, y nunca en otro sitio: no puede usarse
 *    como redirección abierta.
 *  · El botón de WhatsApp no manda nada sin seña pagada, y sin proveedor
 *    configurado lo dice en vez de armar un mensaje de texto.
 */
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import env from '../../src/config/env.js';
import { crearReserva } from '../../src/modules/reservations/reservations.service.js';
import { crearParkingDePrueba, fechaFutura, limpiar } from '../helpers/fixtures.js';

const app = crearApp();
const agente = request(app);

const TELEFONO = '11 5555 4444';
const PATENTES = ['VU111AA', 'VU222BB', 'VU333CC'];

let confirmada;
let sinSena;
let otraSinSena;

before(async () => {
  const { parking } = await crearParkingDePrueba({ capacidad: 10, nombre: 'Vuelta' });
  const reservar = (patente, dias) =>
    crearReserva({
      parkingId: parking.id,
      inicio: fechaFutura(dias, 10),
      fin: fechaFutura(dias, 12),
      cliente: { nombre: 'Vera', apellido: 'Vuelta', telefono: TELEFONO },
      vehiculo: { patente, tipo: 'AUTO' },
      desdePanel: true,
    });

  const aEsperarLaSena = (r) =>
    prisma.reservation.update({
      where: { id: r.id },
      data: { estado: 'PENDIENTE', paymentStatus: 'PENDIENTE', pagadaEn: null },
    });

  confirmada = await reservar('VU111AA', 50);
  sinSena = await aEsperarLaSena(await reservar('VU222BB', 51));
  otraSinSena = await aEsperarLaSena(await reservar('VU333CC', 52));
});

after(async () => {
  await limpiar();
  await prisma.vehicle.deleteMany({ where: { patente: { in: PATENTES }, reservas: { none: {} } } });
  await prisma.customer.deleteMany({ where: { telefono: { contains: '55554444' }, reservas: { none: {} } } });
  await prisma.$disconnect();
});

const vuelta = (token, query = {}) =>
  agente.get(`/api/v1/payments/mercadopago/vuelta/${token}`).query(query);

describe('vuelta desde Mercado Pago', () => {
  test('aprobado: redirige a la pantalla de pago de esa reserva, que confirma y muestra el comprobante', async () => {
    const res = await vuelta(confirmada.publicToken, {
      collection_status: 'approved',
      payment_id: '123',
    });

    assert.equal(res.status, 303);
    assert.equal(res.headers.location, `${env.PUBLIC_WEB_URL}/pago/${confirmada.publicToken}?vuelta=aprobado`);
  });

  test('rechazado, pendiente o sin pagar: también vuelve a SpotNear, con la pista que corresponde', async () => {
    // Con el proveedor simulado la consulta da todo por pagado: estas vueltas
    // se hacen sobre la reserva confirmada para no cambiarle el estado a nadie.
    const casos = [
      [{ collection_status: 'rejected' }, 'rechazado'],
      [{ status: 'in_process' }, 'pendiente'],
      [{ collection_status: 'null' }, 'sin-dato'],
      [{}, 'sin-dato'],
    ];
    for (const [query, pista] of casos) {
      const res = await vuelta(confirmada.publicToken, query);
      assert.equal(res.status, 303);
      assert.ok(res.headers.location.endsWith(`?vuelta=${pista}`), `${JSON.stringify(query)} → ${pista}`);
    }
  });

  test('el estado lo decide la pasarela, no la URL: dice "rechazado" pero el pago está, y se confirma', async () => {
    // La URL de vuelta la puede escribir cualquiera. Lo que cuenta es lo que
    // responde la consulta a la pasarela (acá, la simulada: pago acreditado).
    const res = await vuelta(otraSinSena.publicToken, { collection_status: 'rejected' });
    assert.equal(res.status, 303);

    const actual = await prisma.reservation.findUnique({ where: { id: otraSinSena.id } });
    assert.equal(actual.estado, 'CONFIRMADA');
    assert.equal(actual.paymentStatus, 'PAGADO');
  });

  test('un token inválido no redirige a ningún lado raro: va al inicio de SpotNear', async () => {
    const res = await vuelta('..%2F..%2Fevil.com');
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, env.PUBLIC_WEB_URL);
  });
});

describe('"Enviar a mi WhatsApp"', () => {
  test('sin seña pagada no hay comprobante que mandar', async () => {
    const res = await agente.post(`/api/v1/reservations/comprobante/${sinSena.publicToken}/enviar-whatsapp`);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.codigo, 'SENA_PENDIENTE');
  });

  test('sin proveedor de WhatsApp configurado lo dice, sin romper', async () => {
    const res = await agente.post(`/api/v1/reservations/comprobante/${confirmada.publicToken}/enviar-whatsapp`);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.estado, 'NO_CONFIGURADO');
    assert.match(res.body.mensaje, /no está configurado/);
  });
});
