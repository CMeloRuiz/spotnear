/**
 * El nombre del cliente se congela en la reserva.
 *
 * Regresión del peor bug que tuvo el sistema: varias personas comparten un
 * teléfono (una familia, una oficina, un playero que reserva para un cliente),
 * así que comparten la fila de `Customer`. Al reservar, el código le pisaba el
 * nombre a ese contacto con el de la reserva nueva, y como las reservas
 * mostraban el nombre a través de la relación, TODAS las anteriores de ese
 * teléfono quedaban re-etiquetadas. Nueve reservas quedaron mal antes de que
 * se detectara.
 *
 * Una reserva es un documento de algo que ya pasó: no se re-escribe sola.
 */
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../src/config/prisma.js';
import { crearReserva } from '../../src/modules/reservations/reservations.service.js';
import { crearParkingDePrueba, limpiar } from '../helpers/fixtures.js';

describe('el cliente queda congelado en la reserva', () => {
  // El mismo teléfono para las dos reservas: es la condición que dispara el bug.
  const TELEFONO = '11 4444 5555';
  let parking;
  let primera;

  before(async () => {
    ({ parking } = await crearParkingDePrueba({ capacidad: 20, nombre: 'Congelado' }));
  });

  after(async () => {
    await limpiar();
    await prisma.customer.deleteMany({ where: { telefono: { contains: '44445555' }, reservas: { none: {} } } });
    await prisma.vehicle.deleteMany({ where: { patente: { in: ['CG111AA', 'CG222BB'] }, reservas: { none: {} } } });
  });

  /** Reserva con un nombre dado, siempre sobre el mismo teléfono. */
  const reservar = ({ nombre, apellido, patente, offsetHoras }) => {
    const inicio = new Date(Date.now() + offsetHoras * 3_600_000);
    inicio.setMinutes(0, 0, 0);
    return crearReserva({
      parkingId: parking.id,
      inicio,
      fin: new Date(inicio.getTime() + 2 * 3_600_000),
      cliente: { nombre, apellido, telefono: TELEFONO },
      vehiculo: { patente, tipo: 'AUTO' },
      desdePanel: true,
    });
  };

  test('una reserva nueva no renombra a las anteriores del mismo teléfono', async () => {
    primera = await reservar({
      nombre: 'Ana', apellido: 'Gómez', patente: 'CG111AA', offsetHoras: 48,
    });

    assert.equal(primera.clienteNombre, 'Ana');
    assert.equal(primera.clienteApellido, 'Gómez');

    // Segunda reserva, MISMO teléfono, otra persona.
    const segunda = await reservar({
      nombre: 'Bruno', apellido: 'Díaz', patente: 'CG222BB', offsetHoras: 72,
    });

    assert.equal(segunda.clienteNombre, 'Bruno');

    // Lo que importa: la primera sigue diciendo Ana.
    const primeraAhora = await prisma.reservation.findUnique({
      where: { id: primera.id },
      select: { clienteNombre: true, clienteApellido: true },
    });

    assert.equal(
      primeraAhora.clienteNombre,
      'Ana',
      'la reserva de Ana no puede pasar a ser de Bruno',
    );
    assert.equal(primeraAhora.clienteApellido, 'Gómez');
  });

  test('comparten el contacto, y ese contacto tampoco se renombra', async () => {
    const reservas = await prisma.reservation.findMany({
      where: { parkingId: parking.id },
      select: { customerId: true },
    });

    const contactos = new Set(reservas.map((r) => r.customerId));
    assert.equal(contactos.size, 1, 'mismo teléfono ⇒ un solo contacto: eso está bien');

    const contacto = await prisma.customer.findUnique({ where: { id: [...contactos][0] } });
    assert.equal(
      contacto.nombre,
      'Ana',
      'el contacto conserva el nombre con el que se creó: reservar de nuevo no lo pisa',
    );
  });
});
