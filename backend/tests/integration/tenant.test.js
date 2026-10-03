/**
 * Aislamiento multi-tenant.
 *
 * Un OWNER o STAFF tiene que ser incapaz de leer o modificar datos de otro
 * estacionamiento, aunque escriba los ids a mano. Se valida contra la API real,
 * no contra la UI: esconder un botón no es una medida de seguridad.
 */
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
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

let A; // estacionamiento A + su gente
let B; // estacionamiento B + su gente
let tokenOwnerA;
let tokenStaffA;
let tokenOwnerB;
let tokenSuper;
let reservaA;

before(async () => {
  A = await crearParkingDePrueba({ capacidad: 20, nombre: 'Parking A' });
  B = await crearParkingDePrueba({ capacidad: 20, nombre: 'Parking B' });
  const sa = await crearSuperadminDePrueba();

  tokenOwnerA = await loguear(agente, A.owner.email, A.password);
  tokenStaffA = await loguear(agente, A.staff.email, A.password);
  tokenOwnerB = await loguear(agente, B.owner.email, B.password);
  tokenSuper = await loguear(agente, sa.usuario.email, sa.password);

  const res = await agente
    .post('/api/v1/reservations')
    .send(cuerpoReserva(A.parking.id, fechaFutura(20, 10), fechaFutura(20, 14)));
  assert.equal(res.status, 201, JSON.stringify(res.body));

  reservaA = await prisma.reservation.findUnique({ where: { codigo: res.body.reserva.codigo } });
});

after(async () => {
  await limpiar();
  await prisma.$disconnect();
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('lectura de reservas', () => {
  test('el OWNER de A ve su reserva', async () => {
    const res = await agente.get('/api/v1/admin/reservations').set(auth(tokenOwnerA));
    assert.equal(res.status, 200);
    assert.ok(res.body.reservas.some((r) => r.id === reservaA.id));
  });

  test('el OWNER de B NO la ve en su listado', async () => {
    const res = await agente.get('/api/v1/admin/reservations').set(auth(tokenOwnerB));
    assert.equal(res.status, 200);
    assert.equal(
      res.body.reservas.some((r) => r.id === reservaA.id),
      false,
      'se filtró una reserva de otro estacionamiento',
    );
  });

  test('el OWNER de B NO puede abrirla por id directo', async () => {
    const res = await agente.get(`/api/v1/admin/reservations/${reservaA.id}`).set(auth(tokenOwnerB));
    assert.equal(res.status, 404);
  });

  test('buscar por el código exacto tampoco la expone', async () => {
    const res = await agente
      .get(`/api/v1/admin/reservations?q=${reservaA.codigo}`)
      .set(auth(tokenOwnerB));
    assert.equal(res.body.reservas.length, 0);
  });

  test('la búsqueda rápida está acotada al propio estacionamiento', async () => {
    const res = await agente
      .get(`/api/v1/admin/reservations/buscar?q=${reservaA.codigo}`)
      .set(auth(tokenOwnerB));
    assert.equal(res.status, 200);
    assert.equal(res.body.reservas.length, 0);
  });

  test('pasar ?parkingId= ajeno no sirve para espiar', async () => {
    const res = await agente
      .get(`/api/v1/admin/reservations?parkingId=${A.parking.id}`)
      .set(auth(tokenOwnerB));
    assert.equal(res.status, 200);
    assert.equal(
      res.body.reservas.some((r) => r.id === reservaA.id),
      false,
      'el parkingId de la query pisó el del token',
    );
  });
});

describe('escritura sobre datos ajenos', () => {
  test('no puede hacer check-in de una reserva ajena', async () => {
    const res = await agente
      .post(`/api/v1/admin/reservations/${reservaA.id}/check-in`)
      .set(auth(tokenOwnerB))
      .send({});
    assert.equal(res.status, 404);

    const sinTocar = await prisma.reservation.findUnique({ where: { id: reservaA.id } });
    assert.equal(sinTocar.estado, 'CONFIRMADA', 'la reserva fue modificada por otro tenant');
    assert.equal(sinTocar.checkInAt, null);
  });

  test('no puede cancelar una reserva ajena', async () => {
    const res = await agente
      .post(`/api/v1/admin/reservations/${reservaA.id}/cancelar`)
      .set(auth(tokenOwnerB))
      .send({ motivo: 'no debería poder' });
    assert.equal(res.status, 404);
  });

  test('no puede editar el estacionamiento ajeno', async () => {
    const res = await agente
      .patch(`/api/v1/admin/parkings/${A.parking.id}`)
      .set(auth(tokenOwnerB))
      .send({ nombre: 'Secuestrado' });
    assert.equal(res.status, 403);

    const sinTocar = await prisma.parking.findUnique({ where: { id: A.parking.id } });
    assert.notEqual(sinTocar.nombre, 'Secuestrado');
  });

  test('no puede cargar una reserva en el estacionamiento ajeno', async () => {
    const res = await agente
      .post('/api/v1/admin/reservations')
      .set(auth(tokenOwnerB))
      .send(cuerpoReserva(A.parking.id, fechaFutura(21, 10), fechaFutura(21, 14)));
    assert.equal(res.status, 403);
  });

  test('no puede crear tarifas en el estacionamiento ajeno', async () => {
    const res = await agente
      .post('/api/v1/admin/rates')
      .set(auth(tokenOwnerB))
      .send({ parkingId: A.parking.id, tipo: 'HORA', precio: 1 });
    assert.equal(res.status, 403);
  });

  test('no puede bloquear cupos en el estacionamiento ajeno', async () => {
    const res = await agente
      .post(`/api/v1/admin/parkings/${A.parking.id}/bloqueos`)
      .set(auth(tokenOwnerB))
      .send({
        desde: fechaFutura(22, 10).toISOString(),
        hasta: fechaFutura(22, 14).toISOString(),
        lugares: 20,
      });
    assert.equal(res.status, 403);
  });
});

describe('límites por rol', () => {
  test('el STAFF puede hacer check-in en su estacionamiento', async () => {
    const res = await agente
      .post('/api/v1/reservations')
      .send(
        cuerpoReserva(A.parking.id, fechaFutura(23, 10), fechaFutura(23, 14), {
          vehiculo: { patente: 'ST123FF' },
        }),
      );
    const creada = await prisma.reservation.findUnique({ where: { codigo: res.body.reserva.codigo } });

    const checkin = await agente
      .post(`/api/v1/admin/reservations/${creada.id}/check-in`)
      .set(auth(tokenStaffA))
      .send({});
    assert.equal(checkin.status, 200);
    assert.equal(checkin.body.reserva.estado, 'EN_CURSO');
  });

  test('el STAFF no puede editar el estacionamiento', async () => {
    const res = await agente
      .patch(`/api/v1/admin/parkings/${A.parking.id}`)
      .set(auth(tokenStaffA))
      .send({ capacidadTotal: 999 });
    assert.equal(res.status, 403);
  });

  test('el STAFF no puede administrar usuarios', async () => {
    const res = await agente.get('/api/v1/admin/staff').set(auth(tokenStaffA));
    assert.equal(res.status, 403);
  });

  test('el OWNER no puede cambiarse la comisión', async () => {
    const antes = await prisma.parking.findUnique({ where: { id: A.parking.id } });

    const res = await agente
      .patch(`/api/v1/admin/parkings/${A.parking.id}`)
      .set(auth(tokenOwnerA))
      .send({ comisionPorcentaje: 0, nombre: 'Parking A renombrado' });
    assert.equal(res.status, 200, 'el resto de la edición sí debe funcionar');

    const despues = await prisma.parking.findUnique({ where: { id: A.parking.id } });
    assert.equal(
      Number(despues.comisionPorcentaje),
      Number(antes.comisionPorcentaje),
      'el OWNER logró bajarse la comisión',
    );
    assert.equal(despues.nombre, 'Parking A renombrado');
  });

  test('el OWNER no puede crear un usuario SUPERADMIN', async () => {
    const res = await agente
      .post('/api/v1/admin/staff')
      .set(auth(tokenOwnerA))
      .send({
        nombre: 'Intruso',
        email: `intruso@${A.parking.slug}.test`,
        password: 'ClaveDePrueba123',
        role: 'SUPERADMIN',
      });
    assert.equal(res.status, 403);
  });

  test('el OWNER no puede dar de alta usuarios en otro estacionamiento', async () => {
    const res = await agente
      .post('/api/v1/admin/staff')
      .set(auth(tokenOwnerA))
      .send({
        nombre: 'Infiltrado',
        email: `infiltrado@${A.parking.slug}.test`,
        password: 'ClaveDePrueba123',
        role: 'STAFF',
        parkingId: B.parking.id,
      });
    assert.equal(res.status, 403);
  });
});

describe('alcance del SUPERADMIN', () => {
  test('ve las reservas de todos los estacionamientos', async () => {
    const res = await agente
      .get(`/api/v1/admin/reservations?q=${reservaA.codigo}`)
      .set(auth(tokenSuper));
    assert.equal(res.status, 200);
    assert.ok(res.body.reservas.some((r) => r.id === reservaA.id));
  });

  test('puede acotar la consulta a un estacionamiento', async () => {
    const res = await agente
      .get(`/api/v1/admin/reservations?parkingId=${B.parking.id}`)
      .set(auth(tokenSuper));
    assert.equal(res.status, 200);
    assert.equal(
      res.body.reservas.some((r) => r.id === reservaA.id),
      false,
    );
  });

  test('sí puede cambiar la comisión', async () => {
    const res = await agente
      .patch(`/api/v1/admin/parkings/${A.parking.id}`)
      .set(auth(tokenSuper))
      .send({ comisionPorcentaje: 18 });
    assert.equal(res.status, 200);
    assert.equal(res.body.parking.comisionPorcentaje, 18);
  });
});

describe('comisión en la respuesta', () => {
  test('el comprobante público no expone la comisión', async () => {
    const reserva = await prisma.reservation.findUnique({ where: { id: reservaA.id } });
    const res = await agente.get(`/api/v1/reservations/comprobante/${reserva.publicToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.reserva.montoComision, undefined);
    assert.equal(res.body.reserva.montoNeto, undefined);
    assert.equal(res.body.reserva.comisionPorcentaje, undefined);
  });

  test('el dashboard del OWNER no expone la comisión de la plataforma', async () => {
    const res = await agente.get('/api/v1/admin/reports/dashboard').set(auth(tokenOwnerA));
    assert.equal(res.status, 200);
    assert.equal(res.body.hoy.comision, undefined);
    assert.equal(res.body.mes.comision, undefined);
  });

  test('el dashboard del SUPERADMIN sí la expone', async () => {
    const res = await agente.get('/api/v1/admin/reports/dashboard').set(auth(tokenSuper));
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.hoy.comision, 'number');
  });
});
