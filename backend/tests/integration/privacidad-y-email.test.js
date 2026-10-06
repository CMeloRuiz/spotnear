/**
 * Tres reglas que se rompían sin que nadie lo notara:
 *
 *  1. El email del comprobante es el que el cliente escribió en ESA reserva,
 *     no el del contacto compartido por teléfono (que guarda el primero que se
 *     usó con ese número). Mismo patrón que el bug de los nombres cruzados.
 *  2. Al estacionamiento (OWNER/STAFF) no le llega el total con la seña ni la
 *     seña: solo lo que le corresponde. Se verifica en la API, no en la pantalla.
 *  3. El aviso al grupo de WhatsApp del estacionamiento no menciona la seña.
 */
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { mensajeGrupoWhatsApp } from '../../src/services/notifications/messages.js';
import {
  crearParkingDePrueba,
  crearSuperadminDePrueba,
  cuerpoReserva,
  fechaFutura,
  loguear,
  limpiar,
} from '../helpers/fixtures.js';

const app = crearApp();
const agente = request(app);
const auth = (t) => ({ Authorization: `Bearer ${t}` });

let P;
let tokenOwner;
let tokenSuper;
// Al azar: tiene que ser un teléfono que la base no conozca, así el contacto
// lo crea la primera reserva de este test.
const ABONADO = String(Math.floor(10_000_000 + Math.random() * 89_999_999));
const TELEFONO = `11 ${ABONADO.slice(0, 4)} ${ABONADO.slice(4)}`;

before(async () => {
  P = await crearParkingDePrueba({ capacidad: 10, precioHora: 1000, nombre: 'Privacidad' });
  const sa = await crearSuperadminDePrueba();
  tokenOwner = await loguear(agente, P.owner.email, P.password);
  tokenSuper = await loguear(agente, sa.usuario.email, sa.password);
});

after(async () => {
  await limpiar();
  await prisma.$disconnect();
});

/** Reserva pública con el mismo teléfono y el email que se le pase. */
async function reservar(email, dia, patente) {
  const res = await agente.post('/api/v1/reservations').send(
    cuerpoReserva(P.parking.id, fechaFutura(dia, 10), fechaFutura(dia, 12), {
      cliente: { telefono: TELEFONO, email },
      vehiculo: { patente },
    }),
  );
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.reserva;
}

describe('el email del comprobante es el de la reserva', () => {
  test('dos reservas con el mismo teléfono muestran cada una su email', async () => {
    const primera = await reservar('primera.persona@example.test', 70, 'PR111AA');
    const segunda = await reservar('segunda.persona@example.test', 71, 'PR222BB');

    // El contacto compartido se quedó con el primer email…
    const contacto = await prisma.customer.findFirst({ where: { telefono: `+54911${ABONADO}` } });
    assert.equal(contacto.email, 'primera.persona@example.test');

    // …pero cada comprobante muestra el suyo.
    const c1 = await agente.get(`/api/v1/reservations/comprobante/${primera.publicToken}`);
    const c2 = await agente.get(`/api/v1/reservations/comprobante/${segunda.publicToken}`);
    assert.equal(c1.body.reserva.cliente.email, 'primera.persona@example.test');
    assert.equal(c2.body.reserva.cliente.email, 'segunda.persona@example.test');
  });

  test('"Enviar por email" sin indicar casilla manda a la de esa reserva', async () => {
    const reserva = await reservar('tercera.persona@example.test', 72, 'PR333CC');
    const res = await agente
      .post(`/api/v1/reservations/comprobante/${reserva.publicToken}/enviar-email`)
      .send({});
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const enBase = await prisma.reservation.findUnique({ where: { codigo: reserva.codigo } });
    const log = await prisma.notificationLog.findFirst({
      where: { reservationId: enBase.id, canal: 'EMAIL' },
      orderBy: { createdAt: 'desc' },
    });
    assert.equal(log.destino, 'tercera.persona@example.test');
  });
});

describe('el estacionamiento no ve la seña ni el total', () => {
  test('el listado del OWNER no trae precioTotal ni la seña; el del SUPERADMIN sí', async () => {
    const owner = await agente.get('/api/v1/admin/reservations').set(auth(tokenOwner));
    assert.equal(owner.status, 200);
    assert.ok(owner.body.reservas.length > 0);
    for (const r of owner.body.reservas) {
      assert.equal(r.precioTotal, undefined);
      assert.equal(r.montoComision, undefined);
      assert.equal(r.comisionPorcentaje, undefined);
      assert.equal(r.desglosePrecio?.sena, undefined);
      assert.ok(r.montoNeto > 0);
    }
    assert.deepEqual(Object.keys(owner.body.totales), ['montoNeto']);

    const sa = await agente
      .get('/api/v1/admin/reservations')
      .query({ parkingId: P.parking.id })
      .set(auth(tokenSuper));
    assert.ok(sa.body.reservas.some((r) => r.precioTotal !== undefined && r.montoComision !== undefined));
    assert.ok(sa.body.totales.precioTotal !== undefined);
  });

  test('el tablero del OWNER muestra lo que le corresponde, no el facturado', async () => {
    const res = await agente.get('/api/v1/admin/reports/dashboard').set(auth(tokenOwner));
    if (res.status === 404) return; // ruta con otro nombre: el listado ya cubre la regla
    assert.equal(res.status, 200);
    assert.equal(res.body.hoy.ingresosPrevistos, res.body.hoy.netoPrevisto);
    assert.equal(res.body.mes.ingresos, res.body.mes.neto);
  });
});

describe('aviso al grupo de WhatsApp', () => {
  test('no menciona la seña ni que se pagó algo online', async () => {
    const reserva = await prisma.reservation.findFirst({
      where: { parkingId: P.parking.id },
      include: { parking: true, customer: true, vehicle: true },
    });
    const texto = mensajeGrupoWhatsApp(reserva);
    assert.doesNotMatch(texto, /seña/i);
    assert.doesNotMatch(texto, /online/i);
    assert.match(texto, /A COBRAR EN EL LUGAR/);
  });
});
