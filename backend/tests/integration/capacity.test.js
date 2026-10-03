/**
 * Control de capacidad: el sistema NO puede sobrevender.
 *
 * Es la regla de negocio más delicada: si se vende un lugar que no existe,
 * alguien llega al estacionamiento un día de recital y se queda afuera.
 */
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import {
  crearParkingDePrueba,
  cuerpoReserva,
  fechaFutura,
  loguear,
  limpiar,
} from '../helpers/fixtures.js';

const app = crearApp();
const agente = request(app);

after(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('capacidad · no sobrevender', () => {
  test('rechaza la reserva que supera la capacidad', async () => {
    const { parking } = await crearParkingDePrueba({ capacidad: 2 });
    const inicio = fechaFutura(1, 10);
    const fin = fechaFutura(1, 14);

    for (let i = 0; i < 2; i++) {
      const res = await agente
        .post('/api/v1/reservations')
        .send(cuerpoReserva(parking.id, inicio, fin, { vehiculo: { patente: `AB12${i}CD` } }));
      assert.equal(res.status, 201, `la reserva ${i + 1} debería entrar: ${JSON.stringify(res.body)}`);
    }

    const tercera = await agente
      .post('/api/v1/reservations')
      .send(cuerpoReserva(parking.id, inicio, fin, { vehiculo: { patente: 'ZZ999ZZ' } }));

    assert.equal(tercera.status, 409);
    assert.equal(tercera.body.error.codigo, 'SIN_CUPO');
    assert.match(tercera.body.error.mensaje, /no quedan lugares/i);
  });

  test('una reserva que NO se pisa sí entra', async () => {
    const { parking } = await crearParkingDePrueba({ capacidad: 1 });

    const primera = await agente
      .post('/api/v1/reservations')
      .send(cuerpoReserva(parking.id, fechaFutura(2, 10), fechaFutura(2, 14)));
    assert.equal(primera.status, 201);

    // Arranca justo cuando termina la anterior: los rangos son [inicio, fin)
    const segunda = await agente
      .post('/api/v1/reservations')
      .send(cuerpoReserva(parking.id, fechaFutura(2, 14), fechaFutura(2, 18), { vehiculo: { patente: 'CD456EF' } }));
    assert.equal(segunda.status, 201, 'salir 14:00 y entrar 14:00 no se pisa');
  });

  test('una reserva cancelada libera el lugar', async () => {
    const { parking, owner, password } = await crearParkingDePrueba({ capacidad: 1 });
    const inicio = fechaFutura(3, 10);
    const fin = fechaFutura(3, 14);

    const primera = await agente.post('/api/v1/reservations').send(cuerpoReserva(parking.id, inicio, fin));
    assert.equal(primera.status, 201);

    const bloqueada = await agente
      .post('/api/v1/reservations')
      .send(cuerpoReserva(parking.id, inicio, fin, { vehiculo: { patente: 'CD456EF' } }));
    assert.equal(bloqueada.body.error.codigo, 'SIN_CUPO');

    // Se cancela desde el panel
    const token = await loguear(agente, owner.email, password);
    const reserva = await prisma.reservation.findUnique({
      where: { codigo: primera.body.reserva.codigo },
    });
    const cancelacion = await agente
      .post(`/api/v1/admin/reservations/${reserva.id}/cancelar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: 'Prueba' });
    assert.equal(cancelacion.status, 200);

    const reintento = await agente
      .post('/api/v1/reservations')
      .send(cuerpoReserva(parking.id, inicio, fin, { vehiculo: { patente: 'CD456EF' } }));
    assert.equal(reintento.status, 201, 'al cancelar se libera el lugar');
  });

  test('los cupos bloqueados a mano también ocupan', async () => {
    const { parking, owner, password } = await crearParkingDePrueba({ capacidad: 3 });
    const token = await loguear(agente, owner.email, password);
    const inicio = fechaFutura(4, 10);
    const fin = fechaFutura(4, 14);

    const bloqueo = await agente
      .post(`/api/v1/admin/parkings/${parking.id}/bloqueos`)
      .set('Authorization', `Bearer ${token}`)
      .send({ desde: inicio.toISOString(), hasta: fin.toISOString(), lugares: 3, motivo: 'Mantenimiento' });
    assert.equal(bloqueo.status, 201);

    const res = await agente.post('/api/v1/reservations').send(cuerpoReserva(parking.id, inicio, fin));
    assert.equal(res.body.error?.codigo, 'SIN_CUPO');
  });

  test('una reserva de varios vehículos ocupa varios lugares', async () => {
    const { parking } = await crearParkingDePrueba({ capacidad: 3 });
    const inicio = fechaFutura(5, 10);
    const fin = fechaFutura(5, 14);

    const grupal = await agente
      .post('/api/v1/reservations')
      .send({ ...cuerpoReserva(parking.id, inicio, fin), cantidadVehiculos: 3 });
    assert.equal(grupal.status, 201);
    assert.equal(grupal.body.reserva.cantidadVehiculos, 3);

    const extra = await agente
      .post('/api/v1/reservations')
      .send(cuerpoReserva(parking.id, inicio, fin, { vehiculo: { patente: 'CD456EF' } }));
    assert.equal(extra.body.error?.codigo, 'SIN_CUPO', 'los 3 lugares ya están tomados');
  });
});

describe('capacidad · concurrencia', () => {
  test('con 1 lugar y 5 pedidos simultáneos entra exactamente 1', async () => {
    const { parking } = await crearParkingDePrueba({ capacidad: 1 });
    const inicio = fechaFutura(6, 10);
    const fin = fechaFutura(6, 14);

    // Todas salen al mismo tiempo: sin la transacción serializable, entrarían varias.
    const respuestas = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        agente
          .post('/api/v1/reservations')
          .send(cuerpoReserva(parking.id, inicio, fin, { vehiculo: { patente: `XY${i}45ZW` } })),
      ),
    );

    const creadas = respuestas.filter((r) => r.status === 201);
    const rechazadas = respuestas.filter((r) => r.status === 409);

    assert.equal(creadas.length, 1, `entró más de una reserva: ${creadas.length}`);
    assert.equal(rechazadas.length, 4);
    assert.ok(rechazadas.every((r) => r.body.error.codigo === 'SIN_CUPO'));

    // Y en la base quedó una sola.
    const enBase = await prisma.reservation.count({
      where: { parkingId: parking.id, estado: { in: ['PENDIENTE', 'CONFIRMADA', 'EN_CURSO'] } },
    });
    assert.equal(enBase, 1);
  });
});

describe('capacidad · validaciones del rango', () => {
  test('rechaza salida anterior al ingreso', async () => {
    const { parking } = await crearParkingDePrueba();
    const res = await agente
      .post('/api/v1/reservations')
      .send(cuerpoReserva(parking.id, fechaFutura(7, 14), fechaFutura(7, 10)));
    assert.equal(res.status, 422);
  });

  test('rechaza reservas en el pasado desde la web', async () => {
    const { parking } = await crearParkingDePrueba();
    const ayer = new Date(Date.now() - 48 * 3_600_000);
    const res = await agente
      .post('/api/v1/reservations')
      .send(cuerpoReserva(parking.id, ayer, new Date(ayer.getTime() + 3_600_000)));
    assert.equal(res.status, 422);
    assert.equal(res.body.error.codigo, 'FECHA_PASADA');
  });

  test('rechaza un tipo de vehículo que el estacionamiento no acepta', async () => {
    const { parking } = await crearParkingDePrueba();
    await prisma.parking.update({
      where: { id: parking.id },
      data: { tiposVehiculo: ['AUTO'] },
    });

    const res = await agente
      .post('/api/v1/reservations')
      .send(
        cuerpoReserva(parking.id, fechaFutura(8, 10), fechaFutura(8, 12), {
          vehiculo: { patente: 'A123BCD', tipo: 'MOTO' },
        }),
      );
    assert.equal(res.status, 422);
    assert.equal(res.body.error.codigo, 'TIPO_VEHICULO_NO_ACEPTADO');
  });
});
