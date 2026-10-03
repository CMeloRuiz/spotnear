/**
 * Eliminar reservas terminadas desde el panel.
 *
 * Lo que no se puede romper:
 *
 *  · Solo se eliminan reservas que ya no son actividad futura (finalizada,
 *    cancelada, no se presentó). Una confirmada, en curso o pendiente, no.
 *  · Cada estacionamiento elimina solo lo suyo; el SUPERADMIN, cualquiera.
 *  · Es un borrado lógico: desaparece del panel, pero el reporte de Comisiones
 *    la sigue contando, y el link del comprobante del cliente sigue andando.
 */
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { crearReserva } from '../../src/modules/reservations/reservations.service.js';
import {
  crearParkingDePrueba,
  crearSuperadminDePrueba,
  fechaFutura,
  loguear,
  limpiar,
} from '../helpers/fixtures.js';

const app = crearApp();
const agente = request(app);
const auth = (token) => ({ Authorization: `Bearer ${token}` });

const TELEFONO = '11 6666 9999';
const PATENTES = ['EL111AA', 'EL222BB', 'EL333CC', 'EL444DD'];

let A;
let B;
let tokenOwnerA;
let tokenStaffA;
let tokenOwnerB;
let tokenSuper;

/** Crea una reserva y la deja en el estado pedido. */
async function reservaEn(parking, patente, estado, dias) {
  const reserva = await crearReserva({
    parkingId: parking.id,
    inicio: fechaFutura(dias, 10),
    fin: fechaFutura(dias, 12),
    cliente: { nombre: 'Eli', apellido: 'Minar', telefono: TELEFONO },
    vehiculo: { patente, tipo: 'AUTO' },
    desdePanel: true,
  });
  return prisma.reservation.update({ where: { id: reserva.id }, data: { estado } });
}

const dia = (fecha) => fecha.toISOString().slice(0, 10);

before(async () => {
  A = await crearParkingDePrueba({ capacidad: 10, nombre: 'Eliminar A' });
  B = await crearParkingDePrueba({ capacidad: 10, nombre: 'Eliminar B' });
  const sa = await crearSuperadminDePrueba();

  tokenOwnerA = await loguear(agente, A.owner.email, A.password);
  tokenStaffA = await loguear(agente, A.staff.email, A.password);
  tokenOwnerB = await loguear(agente, B.owner.email, B.password);
  tokenSuper = await loguear(agente, sa.usuario.email, sa.password);
});

after(async () => {
  // Las eliminadas quedan fuera del findMany de limpiar(): se borran acá.
  await prisma.notificationLog.deleteMany({
    where: { reservation: { vehicle: { patente: { in: PATENTES } } } },
  });
  await prisma.reservation.deleteMany({
    where: { vehicle: { patente: { in: PATENTES } }, eliminadaEn: { not: undefined } },
  });
  await limpiar();
  await prisma.vehicle.deleteMany({ where: { patente: { in: PATENTES }, reservas: { none: {} } } });
  await prisma.customer.deleteMany({ where: { telefono: { contains: '66669999' }, reservas: { none: {} } } });
  await prisma.$disconnect();
});

describe('eliminar reservas terminadas', () => {
  test('una reserva confirmada no se puede eliminar: primero se cancela', async () => {
    const r = await reservaEn(A.parking, 'EL111AA', 'CONFIRMADA', 40);

    const res = await agente.delete(`/api/v1/admin/reservations/${r.id}`).set(auth(tokenOwnerA));

    assert.equal(res.status, 409, JSON.stringify(res.body));
    assert.equal(res.body.error.codigo, 'RESERVA_ACTIVA');
    const sigue = await prisma.reservation.findUnique({ where: { id: r.id } });
    assert.ok(sigue, 'la reserva activa sigue en el panel');
  });

  test('el dueño de otro estacionamiento no puede eliminarla (ni saber que existe)', async () => {
    const r = await reservaEn(A.parking, 'EL222BB', 'FINALIZADA', 41);

    const res = await agente.delete(`/api/v1/admin/reservations/${r.id}`).set(auth(tokenOwnerB));

    assert.equal(res.status, 404);
  });

  test('el dueño elimina una finalizada: sale del panel, pero no de Comisiones ni del comprobante', async () => {
    const r = await prisma.reservation.findFirst({
      where: { parkingId: A.parking.id, estado: 'FINALIZADA' },
    });
    const rango = { desde: dia(fechaFutura(41)), hasta: dia(fechaFutura(41)) };

    const antes = await agente
      .get('/api/v1/admin/reports/comisiones')
      .query(rango)
      .set(auth(tokenOwnerA));
    assert.equal(antes.status, 200, JSON.stringify(antes.body));

    const res = await agente.delete(`/api/v1/admin/reservations/${r.id}`).set(auth(tokenOwnerA));
    assert.equal(res.status, 200, JSON.stringify(res.body));

    // Fuera del listado y del detalle.
    const listado = await agente
      .get('/api/v1/admin/reservations')
      .query({ estado: 'FINALIZADA' })
      .set(auth(tokenOwnerA));
    assert.ok(!listado.body.reservas.some((x) => x.id === r.id), 'no aparece en el listado');
    const detalle = await agente.get(`/api/v1/admin/reservations/${r.id}`).set(auth(tokenOwnerA));
    assert.equal(detalle.status, 404);

    // Borrado lógico: la fila sigue, marcada.
    const fila = await prisma.reservation.findFirst({
      where: { id: r.id, eliminadaEn: { not: undefined } },
    });
    assert.ok(fila?.eliminadaEn, 'queda marcada con eliminadaEn');

    // Comisiones la sigue contando: lo facturado no cambia.
    const despues = await agente
      .get('/api/v1/admin/reports/comisiones')
      .query(rango)
      .set(auth(tokenOwnerA));
    assert.equal(despues.body.totales.cantidad, antes.body.totales.cantidad);
    assert.equal(despues.body.totales.precioTotal, antes.body.totales.precioTotal);
    assert.ok(despues.body.totales.cantidad >= 1);

    // El comprobante del cliente sigue andando.
    const comprobante = await agente.get(`/api/v1/reservations/comprobante/${r.publicToken}`);
    assert.equal(comprobante.status, 200);
  });

  test('el playero (STAFF) puede eliminar una cancelada de su estacionamiento', async () => {
    const r = await reservaEn(A.parking, 'EL333CC', 'CANCELADA', 42);

    const res = await agente.delete(`/api/v1/admin/reservations/${r.id}`).set(auth(tokenStaffA));

    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  test('el SUPERADMIN puede eliminar la de cualquier estacionamiento (no se presentó)', async () => {
    const r = await reservaEn(B.parking, 'EL444DD', 'NO_SHOW', 43);

    const res = await agente.delete(`/api/v1/admin/reservations/${r.id}`).set(auth(tokenSuper));

    assert.equal(res.status, 200, JSON.stringify(res.body));
  });
});
