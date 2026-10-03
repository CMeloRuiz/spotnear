/**
 * El cobro de la seña, sin seña no hay reserva.
 *
 * Lo que se prueba acá es la mitad NUESTRA del flujo: qué pasa cuando llega la
 * novedad de que el pago se acreditó. No se simula ninguna respuesta de Mercado
 * Pago —eso sería probarnos a nosotros mismos—: se toma una reserva pendiente
 * de verdad y se le aplica la acreditación, que es exactamente lo que hacen el
 * webhook y la pantalla de pago cuando Mercado Pago dice `approved`.
 *
 * Las tres cosas que no se pueden romper:
 *
 *  1. Mientras la seña no esté, la reserva NO está confirmada y no sale ni el
 *     comprobante ni el aviso al estacionamiento.
 *  2. Cuando la seña entra, salen los dos, juntos y en ese momento.
 *  3. Si la novedad llega dos veces —el webhook reintenta y además la pantalla
 *     consulta en paralelo—, el aviso sale UNA sola vez.
 */
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../../src/config/prisma.js';
import {
  crearReserva,
  acreditarSenaYAvisar,
  esperandoLaSena,
  registrarSenaNoAcreditada,
  cambiarEstado,
  SOLO_CON_SENA,
} from '../../src/modules/reservations/reservations.service.js';
import { crearParkingDePrueba, limpiar } from '../helpers/fixtures.js';

/** Deja la reserva como la deja Mercado Pago mientras el cliente todavía paga. */
async function ponerAEsperarLaSena(id) {
  await prisma.reservation.update({
    where: { id },
    data: {
      estado: 'PENDIENTE',
      paymentStatus: 'PENDIENTE',
      pagadaEn: null,
      paymentProvider: 'mercadopago',
      paymentRef: 'pref-de-prueba',
      paymentUrl: 'https://www.mercadopago.com.ar/checkout/de-prueba',
    },
  });
  // Las notificaciones de la creación no cuentan para esta prueba.
  await prisma.notificationLog.deleteMany({ where: { reservationId: id } });
}

const avisos = (id) => prisma.notificationLog.count({ where: { reservationId: id } });

describe('la seña confirma la reserva', () => {
  const TELEFONO = '11 7777 8888';
  let parking;

  before(async () => {
    ({ parking } = await crearParkingDePrueba({ capacidad: 10, nombre: 'Seña' }));
  });

  after(async () => {
    await limpiar();
    await prisma.customer.deleteMany({ where: { telefono: { contains: '77778888' }, reservas: { none: {} } } });
    await prisma.vehicle.deleteMany({ where: { patente: { in: ['SE111AA', 'SE222BB', 'SE333CC'] }, reservas: { none: {} } } });
  });

  const reservar = async (patente, offsetHoras) => {
    const inicio = new Date(Date.now() + offsetHoras * 3_600_000);
    inicio.setMinutes(0, 0, 0);
    return crearReserva({
      parkingId: parking.id,
      inicio,
      fin: new Date(inicio.getTime() + 2 * 3_600_000),
      cliente: { nombre: 'Paula', apellido: 'Sena', telefono: TELEFONO },
      vehiculo: { patente, tipo: 'AUTO' },
      desdePanel: true,
    });
  };

  test('sin la seña acreditada la reserva no está confirmada y no sale ningún aviso', async () => {
    const reserva = await reservar('SE111AA', 120);
    await ponerAEsperarLaSena(reserva.id);

    const pendiente = await prisma.reservation.findUnique({ where: { id: reserva.id } });

    assert.equal(esperandoLaSena(pendiente), true);
    assert.equal(pendiente.estado, 'PENDIENTE');
    assert.equal(
      await avisos(reserva.id),
      0,
      'sin seña no se le avisa a nadie: ni al cliente ni al estacionamiento',
    );
  });

  test('cuando la seña se acredita, la reserva se confirma y salen los avisos', async () => {
    const reserva = await reservar('SE222BB', 144);
    await ponerAEsperarLaSena(reserva.id);

    const { reserva: confirmada, reciénConfirmada } = await acreditarSenaYAvisar(reserva.id, {
      pagoId: '1234567890',
      detalle: 'approved/accredited',
    });

    assert.equal(reciénConfirmada, true);
    assert.equal(confirmada.estado, 'CONFIRMADA');
    assert.equal(confirmada.paymentStatus, 'PAGADO');
    assert.ok(confirmada.pagadaEn, 'queda asentado cuándo entró la plata');
    assert.equal(esperandoLaSena(confirmada), false);

    // Dos avisos: el comprobante al cliente y la novedad al estacionamiento.
    // Que sean exactamente estos dos es el punto: el estacionamiento se entera
    // de la reserva en el mismo momento en que la reserva empieza a existir.
    const emitidos = await prisma.notificationLog.findMany({
      where: { reservationId: reserva.id },
      select: { canal: true, payload: true },
    });

    assert.equal(emitidos.length, 2);
    assert.ok(
      emitidos.some((n) => n.canal === 'WHATSAPP' && n.payload?.tipo === 'grupo'),
      'tiene que salir el aviso al grupo del estacionamiento',
    );
    assert.ok(
      emitidos.some((n) => n.canal === 'WHATSAPP' && n.payload?.tipo !== 'grupo'),
      'y el comprobante al WhatsApp del cliente',
    );
  });

  test('el mismo pago avisado dos veces no duplica el aviso al estacionamiento', async () => {
    const reserva = await reservar('SE222BB', 168);
    await ponerAEsperarLaSena(reserva.id);

    const primero = await acreditarSenaYAvisar(reserva.id, { pagoId: '55', detalle: 'approved' });
    // El webhook reintenta y, en paralelo, la pantalla de pago consulta.
    const segundo = await acreditarSenaYAvisar(reserva.id, { pagoId: '55', detalle: 'approved' });

    assert.equal(primero.reciénConfirmada, true);
    assert.equal(segundo.reciénConfirmada, false, 'la segunda vuelta no vuelve a disparar nada');
    assert.equal(await avisos(reserva.id), 2, 'siguen siendo dos avisos, no cuatro');
  });

  test('un pago rechazado deja la reserva para reintentar, no la cancela', async () => {
    const reserva = await reservar('SE111AA', 192);
    await ponerAEsperarLaSena(reserva.id);

    const rechazada = await registrarSenaNoAcreditada(reserva.id, {
      estado: 'FALLIDO',
      detalle: 'rejected/cc_rejected_insufficient_amount',
    });

    assert.equal(rechazada.paymentStatus, 'FALLIDO');
    assert.equal(
      rechazada.estado,
      'PENDIENTE',
      'cancelarla obligaría al cliente a cargar todo de nuevo por una tarjeta que no pasó',
    );
    assert.equal(esperandoLaSena(rechazada), true);
    assert.equal(await avisos(reserva.id), 0);
  });

  test('un aviso viejo no puede dar de baja una seña que ya entró', async () => {
    const reserva = await reservar('SE222BB', 216);
    await ponerAEsperarLaSena(reserva.id);

    await acreditarSenaYAvisar(reserva.id, { pagoId: '77', detalle: 'approved' });
    // Llega, tarde, el aviso del intento anterior que había sido rechazado.
    const despues = await registrarSenaNoAcreditada(reserva.id, {
      estado: 'FALLIDO',
      detalle: 'rejected',
    });

    assert.equal(despues.paymentStatus, 'PAGADO', 'la plata que entró no se borra sola');
    assert.equal(despues.estado, 'CONFIRMADA');
  });

  test('el panel no puede hacer check-in ni confirmar una reserva sin seña', async () => {
    const reserva = await reservar('SE333CC', 240);
    await ponerAEsperarLaSena(reserva.id);

    for (const estado of ['EN_CURSO', 'CONFIRMADA', 'NO_SHOW']) {
      await assert.rejects(
        cambiarEstado(reserva.id, estado),
        (e) => e.status === 409 && /seña/.test(e.message),
        `pasar a ${estado} sin seña tiene que rechazarse`,
      );
    }

    // Lo único que sí se puede hacer: cancelarla, que libera el lugar.
    const cancelada = await cambiarEstado(reserva.id, 'CANCELADA');
    assert.equal(cancelada.estado, 'CANCELADA');
  });

  test('las vistas del panel dejan afuera las reservas sin seña', async () => {
    const reserva = await reservar('SE333CC', 264);
    await ponerAEsperarLaSena(reserva.id);

    const visible = await prisma.reservation.findFirst({ where: { id: reserva.id, ...SOLO_CON_SENA } });
    assert.equal(visible, null, 'sin seña no aparece en el listado por defecto');

    await acreditarSenaYAvisar(reserva.id, { pagoId: '99', detalle: 'approved' });
    const ahora = await prisma.reservation.findFirst({ where: { id: reserva.id, ...SOLO_CON_SENA } });
    assert.ok(ahora, 'con la seña acreditada ya es una reserva y aparece');
  });
});
