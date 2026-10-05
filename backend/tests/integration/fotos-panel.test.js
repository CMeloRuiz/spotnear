/**
 * Subida de fotos desde el panel (Mi estacionamiento), contra la API real.
 *
 *  · un dueño no puede subir fotos al estacionamiento de otro;
 *  · sin Cloudinary configurado, avisa con 503 y no guarda nada;
 *  · el tablero muestra las reservas de los próximos días, no solo "ahora".
 */
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import env from '../../src/config/env.js';
import { crearParkingDePrueba, cuerpoReserva, loguear, limpiar } from '../helpers/fixtures.js';
import { picoDeOcupacion } from '../../src/services/availability.js';

const app = crearApp();
const agente = request(app);
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let A;
let B;
let tokenA;

before(async () => {
  A = await crearParkingDePrueba({ capacidad: 5, nombre: 'Fotos A' });
  B = await crearParkingDePrueba({ capacidad: 5, nombre: 'Fotos B' });
  tokenA = await loguear(agente, A.owner.email, A.password);
});

after(async () => {
  await limpiar();
  await prisma.$disconnect();
});

describe('fotos desde el panel', () => {
  test('un dueño no sube fotos a un estacionamiento ajeno', async () => {
    const res = await agente
      .post(`/api/v1/admin/parkings/${B.parking.id}/fotos/archivos`)
      .set(auth(tokenA))
      .attach('fotos', png, { filename: 'f.png', contentType: 'image/png' });
    assert.ok([403, 404].includes(res.status), `esperaba 403/404 y vino ${res.status}`);
    assert.equal(await prisma.parkingPhoto.count({ where: { parkingId: B.parking.id } }), 0);
  });

  test('sin Cloudinary, avisa que no está configurado y no guarda nada', async (t) => {
    if (env.cloudinaryHabilitado) {
      t.skip('hay credenciales de Cloudinary cargadas');
      return;
    }
    const res = await agente
      .post(`/api/v1/admin/parkings/${A.parking.id}/fotos/archivos`)
      .set(auth(tokenA))
      .attach('fotos', png, { filename: 'f.png', contentType: 'image/png' });
    assert.equal(res.status, 503);
    assert.equal(res.body.error.codigo, 'ALMACENAMIENTO_NO_CONFIGURADO');
    assert.equal(await prisma.parkingPhoto.count({ where: { parkingId: A.parking.id } }), 0);
  });
});

describe('ocupación de los próximos días', () => {
  test('una reserva para pasado mañana se cuenta, aunque "ahora" siga libre', async () => {
    // fechaFutura() suma 200 días: acá hace falta una dentro de la ventana.
    const inicio = new Date();
    inicio.setDate(inicio.getDate() + 2);
    inicio.setHours(10, 0, 0, 0);
    const fin = new Date(inicio.getTime() + 2 * 3_600_000);
    const r = await agente
      .post('/api/v1/reservations')
      .send(cuerpoReserva(A.parking.id, inicio, fin, { vehiculo: { patente: 'FT111AA' } }));
    assert.equal(r.status, 201, JSON.stringify(r.body));

    const ahora = new Date();
    const pico = await picoDeOcupacion(A.parking.id, ahora, new Date(ahora.getTime() + 7 * 86_400_000), 5);
    assert.equal(pico.reservas, 1);
    assert.equal(pico.picoOcupados, 1);
    assert.equal(pico.minimoLibres, 4);
  });
});
