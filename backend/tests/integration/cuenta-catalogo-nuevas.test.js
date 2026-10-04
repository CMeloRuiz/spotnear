/**
 * Las piezas nuevas del panel y del checkout, contra la API real:
 *
 *  · la reserva pública exige marca, modelo, color y tipo de vehículo;
 *  · el catálogo clasifica y solo el SUPERADMIN lo edita;
 *  · el contador de reservas nuevas sube y vuelve a 0 al abrir la lista;
 *  · corregir el tipo de vehículo en el check-in ajusta lo que se paga allá;
 *  · cada usuario cambia su propia contraseña, con la actual como llave.
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
const auth = (token) => ({ Authorization: `Bearer ${token}` });

let P;
let tokenOwner;
let tokenStaff;
let tokenSuper;
let filaDePrueba;

before(async () => {
  P = await crearParkingDePrueba({ capacidad: 10, precioHora: 1000, nombre: 'Nuevas' });
  // Tarifa propia de camioneta: más cara que la general.
  await prisma.rate.create({
    data: { parkingId: P.parking.id, tipo: 'HORA', precio: 1500, vehicleType: 'CAMIONETA', activo: true },
  });
  const sa = await crearSuperadminDePrueba();
  tokenOwner = await loguear(agente, P.owner.email, P.password);
  tokenStaff = await loguear(agente, P.staff.email, P.password);
  tokenSuper = await loguear(agente, sa.usuario.email, sa.password);
});

after(async () => {
  if (filaDePrueba) await prisma.vehicleModelCatalog.deleteMany({ where: { id: filaDePrueba } });
  await limpiar();
  await prisma.$disconnect();
});

describe('reserva pública: datos del vehículo', () => {
  test('sin marca, modelo, color ni tipo no se puede reservar', async () => {
    const res = await agente
      .post('/api/v1/reservations')
      .send(
        cuerpoReserva(P.parking.id, fechaFutura(60, 10), fechaFutura(60, 12), {
          vehiculo: { tipo: undefined, marca: '', modelo: '', color: '' },
        }),
      );
    assert.equal(res.status, 422);
    const campos = res.body.error.detalle.campos.map((c) => c.campo);
    for (const c of ['vehiculo.tipo', 'vehiculo.marca', 'vehiculo.modelo', 'vehiculo.color']) {
      assert.ok(campos.includes(c), `falta el error de ${c}`);
    }
    const marca = res.body.error.detalle.campos.find((c) => c.campo === 'vehiculo.marca');
    assert.equal(marca.mensaje, 'La marca es obligatoria.');
  });
});

describe('catálogo de vehículos', () => {
  test('clasifica marca y modelo con la carga inicial', async () => {
    const res = await agente.get('/api/v1/vehiculos/clasificar').query({ marca: 'VW', modelo: 'Amarok V6' });
    assert.equal(res.status, 200);
    assert.equal(res.body.coincidencia.tipo, 'CAMIONETA');

    const nada = await agente.get('/api/v1/vehiculos/clasificar').query({ marca: 'Fiat', modelo: 'Inexistente' });
    assert.equal(nada.body.coincidencia, null);
  });

  test('solo el SUPERADMIN lo edita, y lo nuevo se reconoce al instante', async () => {
    const owner = await agente
      .post('/api/v1/admin/vehiculos-catalogo')
      .set(auth(tokenOwner))
      .send({ marca: 'Marca Prueba', modelo: 'Modelo X', tipo: 'SUV' });
    assert.equal(owner.status, 403);

    const alta = await agente
      .post('/api/v1/admin/vehiculos-catalogo')
      .set(auth(tokenSuper))
      .send({ marca: 'Marca Prueba', modelo: 'Modelo X', tipo: 'SUV' });
    assert.equal(alta.status, 201, JSON.stringify(alta.body));
    filaDePrueba = alta.body.modelo.id;

    const repetido = await agente
      .post('/api/v1/admin/vehiculos-catalogo')
      .set(auth(tokenSuper))
      .send({ marca: 'marca prueba', modelo: 'modelo-x', tipo: 'AUTO' });
    assert.equal(repetido.status, 409, 'misma marca y modelo escritos distinto');

    const c = await agente.get('/api/v1/vehiculos/clasificar').query({ marca: 'MARCA PRUEBA', modelo: 'modelo x full' });
    assert.equal(c.body.coincidencia.tipo, 'SUV');

    const editar = await agente
      .patch(`/api/v1/admin/vehiculos-catalogo/${filaDePrueba}`)
      .set(auth(tokenSuper))
      .send({ marca: 'Marca Prueba', modelo: 'Modelo X', tipo: 'CAMIONETA' });
    assert.equal(editar.status, 200);
    const c2 = await agente.get('/api/v1/vehiculos/clasificar').query({ marca: 'Marca Prueba', modelo: 'Modelo X' });
    assert.equal(c2.body.coincidencia.tipo, 'CAMIONETA');

    const borrar = await agente.delete(`/api/v1/admin/vehiculos-catalogo/${filaDePrueba}`).set(auth(tokenSuper));
    assert.equal(borrar.status, 200);
    filaDePrueba = null;
    const c3 = await agente.get('/api/v1/vehiculos/clasificar').query({ marca: 'Marca Prueba', modelo: 'Modelo X' });
    assert.equal(c3.body.coincidencia, null);
  });
});

describe('contador de reservas nuevas', () => {
  test('cuenta las confirmadas después de abrir la lista, y vuelve a 0', async () => {
    await agente.post('/api/v1/admin/reservations/vistas').set(auth(tokenOwner));
    const antes = await agente.get('/api/v1/admin/reservations/nuevas').set(auth(tokenOwner));
    assert.equal(antes.body.nuevas, 0);

    const r = await agente
      .post('/api/v1/reservations')
      .send(cuerpoReserva(P.parking.id, fechaFutura(61, 10), fechaFutura(61, 12), { vehiculo: { patente: 'NV111AA' } }));
    assert.equal(r.status, 201, JSON.stringify(r.body));

    const despues = await agente.get('/api/v1/admin/reservations/nuevas').set(auth(tokenOwner));
    assert.equal(despues.body.nuevas, 1);

    // Cada usuario tiene su propio "visto": el playero también la ve como nueva.
    const staff = await agente.get('/api/v1/admin/reservations/nuevas').set(auth(tokenStaff));
    assert.ok(staff.body.nuevas >= 1);

    await agente.post('/api/v1/admin/reservations/vistas').set(auth(tokenOwner));
    const otraVez = await agente.get('/api/v1/admin/reservations/nuevas').set(auth(tokenOwner));
    assert.equal(otraVez.body.nuevas, 0);
  });

  test('el SUPERADMIN no tiene contador', async () => {
    const res = await agente.get('/api/v1/admin/reservations/nuevas').set(auth(tokenSuper));
    assert.equal(res.body.nuevas, 0);
  });
});

describe('corregir el tipo de vehículo en el check-in', () => {
  test('de auto a camioneta: sube lo que se paga en el lugar, la seña no cambia', async () => {
    const r = await agente
      .post('/api/v1/reservations')
      .send(cuerpoReserva(P.parking.id, fechaFutura(62, 10), fechaFutura(62, 12), { vehiculo: { patente: 'CV222BB' } }));
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const reserva = await prisma.reservation.findUnique({ where: { codigo: r.body.reserva.codigo } });
    assert.equal(Number(reserva.subtotal), 2000, '2 h × 1.000 (tarifa general)');

    const res = await agente
      .patch(`/api/v1/admin/reservations/${reserva.id}/vehiculo`)
      .set(auth(tokenStaff))
      .send({ tipo: 'CAMIONETA' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.ajuste.aPagarEnElLugarAhora, 3000, '2 h × 1.500 (tarifa de camioneta)');
    assert.equal(res.body.ajuste.diferencia, 1000);

    const actual = await prisma.reservation.findUnique({ where: { id: reserva.id }, include: { vehicle: true } });
    assert.equal(actual.vehicle.tipo, 'CAMIONETA');
    assert.equal(Number(actual.montoNeto), 3000);
    assert.equal(Number(actual.montoComision), Number(reserva.montoComision), 'la seña cobrada no se toca');
    assert.equal(Number(actual.precioTotal), 3000 + Number(reserva.montoComision));
  });
});

describe('cambiar la contraseña propia', () => {
  test('pide la actual, no acepta la misma, y después solo entra la nueva', async () => {
    const mal = await agente
      .post('/api/v1/auth/cambiar-password')
      .set(auth(tokenStaff))
      .send({ actual: 'no-es-esta', nueva: 'OtraClaveNueva123' });
    assert.equal(mal.status, 422);

    const igual = await agente
      .post('/api/v1/auth/cambiar-password')
      .set(auth(tokenStaff))
      .send({ actual: P.password, nueva: P.password });
    assert.equal(igual.status, 422);

    const corta = await agente
      .post('/api/v1/auth/cambiar-password')
      .set(auth(tokenStaff))
      .send({ actual: P.password, nueva: 'corta' });
    assert.equal(corta.status, 422);

    const ok = await agente
      .post('/api/v1/auth/cambiar-password')
      .set(auth(tokenStaff))
      .send({ actual: P.password, nueva: 'OtraClaveNueva123' });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));

    const vieja = await agente.post('/api/v1/auth/login').send({ email: P.staff.email, password: P.password });
    assert.equal(vieja.status, 401);
    const nueva = await agente.post('/api/v1/auth/login').send({ email: P.staff.email, password: 'OtraClaveNueva123' });
    assert.equal(nueva.status, 200);

    // Solo cambió la del playero: el dueño sigue entrando con la suya.
    const owner = await agente.post('/api/v1/auth/login').send({ email: P.owner.email, password: P.password });
    assert.equal(owner.status, 200);
  });
});
