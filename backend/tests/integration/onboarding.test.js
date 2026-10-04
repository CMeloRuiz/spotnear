/**
 * Alta de estacionamientos por autogestión.
 *
 * Lo que se verifica acá es la regla que sostiene todo el flujo: una solicitud
 * pendiente NO existe para nadie salvo para el SUPERADMIN. No aparece en la
 * búsqueda pública, no deja entrar al panel, y solo la aprobación la enciende.
 *
 * Se prueba contra la API real y no contra la UI: que el botón "Aprobar" solo
 * se le muestre al SUPERADMIN no es una medida de seguridad.
 */
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import env from '../../src/config/env.js';
import { crearParkingDePrueba, crearSuperadminDePrueba, loguear, limpiar, SUFIJO } from '../helpers/fixtures.js';

const app = crearApp();
const agente = request(app);

const PASSWORD = 'ClaveDePrueba123';

/** Cuerpo válido del formulario público, con el email que se le pase. */
function solicitud(email, extra = {}) {
  return {
    duenio: {
      nombre: 'Ana',
      apellido: 'Gómez',
      email,
      telefono: '11 1234 5678',
      password: PASSWORD,
      ...extra.duenio,
    },
    parking: {
      nombre: `Cocheras ${email.split('@')[0]}`,
      direccion: 'Calle Falsa 123',
      barrio: 'Villa Crespo',
      lat: -34.5965,
      lng: -58.4489,
      capacidadTotal: 20,
      cubierto: true,
      tiposVehiculo: ['AUTO'],
      tipoHorario: 'FIJO',
      horarios: { lun: { abre: '08:00', cierra: '22:00' } },
      // Al menos una foto es obligatorio desde que el alta las exige.
      fotos: ['https://ejemplo.test/entrada.jpg'],
      ...extra.parking,
    },
    aceptaTerminos: true,
    aceptaComision: true,
    ...extra.raiz,
  };
}

let tokenSuper;
let tokenOwnerAjeno;
/** Ids de los estacionamientos creados por el formulario público. */
const creados = [];

before(async () => {
  const sa = await crearSuperadminDePrueba();
  tokenSuper = await loguear(agente, sa.usuario.email, sa.password);

  const otro = await crearParkingDePrueba({ nombre: 'Parking ajeno' });
  tokenOwnerAjeno = await loguear(agente, otro.owner.email, otro.password);
});

after(async () => {
  // Los estacionamientos que crea el endpoint público no pasan por los
  // fixtures, así que su limpieza va a mano.
  if (creados.length > 0) {
    await prisma.refreshToken.deleteMany({ where: { user: { parkingId: { in: creados } } } });
    await prisma.auditLog.deleteMany({ where: { parkingId: { in: creados } } });
    await prisma.user.deleteMany({ where: { parkingId: { in: creados } } });
    await prisma.parking.deleteMany({ where: { id: { in: creados } } });
  }
  await limpiar();
  await prisma.$disconnect();
});

describe('Solicitud pública de alta', () => {
  test('crea el estacionamiento apagado y su usuario OWNER', async () => {
    const email = `alta-1@${SUFIJO}.test`;

    const res = await agente.post('/api/v1/onboarding/parkings').send(solicitud(email));

    assert.equal(res.status, 201);
    assert.equal(res.body.solicitud.estado, 'PENDIENTE_APROBACION');
    creados.push(res.body.solicitud.id);

    const enBase = await prisma.parking.findUnique({
      where: { id: res.body.solicitud.id },
      include: { usuarios: true },
    });

    // Los tres interruptores que lo mantienen invisible.
    assert.equal(enBase.estado, 'PENDIENTE_APROBACION');
    assert.equal(enBase.activo, false);
    assert.equal(enBase.publicado, false);

    assert.equal(enBase.usuarios.length, 1);
    assert.equal(enBase.usuarios[0].role, 'OWNER');
    assert.equal(enBase.usuarios[0].activo, false);
    // La contraseña nunca se guarda en claro.
    assert.notEqual(enBase.usuarios[0].passwordHash, PASSWORD);
  });

  test('no aparece en la búsqueda pública mientras está pendiente', async () => {
    const email = `alta-2@${SUFIJO}.test`;
    const res = await agente.post('/api/v1/onboarding/parkings').send(solicitud(email));
    creados.push(res.body.solicitud.id);

    const inicio = new Date(Date.now() + 40 * 86_400_000);
    inicio.setHours(10, 0, 0, 0);
    const fin = new Date(inicio.getTime() + 4 * 3_600_000);

    const busqueda = await agente.get('/api/v1/parkings').query({
      lat: -34.5965,
      lng: -58.4489,
      radio: 2500,
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
    });

    assert.equal(busqueda.status, 200);
    assert.ok(
      !busqueda.body.resultados.some((p) => p.id === res.body.solicitud.id),
      'una solicitud pendiente no puede aparecer en los resultados',
    );
  });

  test('tampoco es accesible por su detalle público', async () => {
    const detalle = await agente.get(`/api/v1/parkings/${creados[0]}`);
    assert.equal(detalle.status, 404);
  });

  test('el dueño no puede entrar al panel hasta que se apruebe', async () => {
    const res = await agente
      .post('/api/v1/auth/login')
      .send({ email: `alta-1@${SUFIJO}.test`, password: PASSWORD });

    assert.equal(res.status, 403);
    // El mensaje importa: tiene que decir "en revisión", no "desactivado".
    assert.match(res.body.error.mensaje, /revisión/i);
  });

  test('rechaza un email ya registrado', async () => {
    const res = await agente
      .post('/api/v1/onboarding/parkings')
      .send(solicitud(`alta-1@${SUFIJO}.test`));

    assert.equal(res.status, 422);
    assert.match(res.body.error.mensaje, /email/i);
  });

  test('exige aceptar los términos y la comisión', async () => {
    const sinComision = await agente
      .post('/api/v1/onboarding/parkings')
      .send(solicitud(`alta-3@${SUFIJO}.test`, { raiz: { aceptaComision: false } }));
    assert.equal(sinComision.status, 422);

    const sinTerminos = await agente
      .post('/api/v1/onboarding/parkings')
      .send(solicitud(`alta-4@${SUFIJO}.test`, { raiz: { aceptaTerminos: false } }));
    assert.equal(sinTerminos.status, 422);
  });

  test('sin fotos: se rechaza si hay dónde subirlas; si no, se acepta', async () => {
    const res = await agente
      .post('/api/v1/onboarding/parkings')
      .send(solicitud(`alta-fotos@${SUFIJO}.test`, { parking: { fotos: [] } }));

    if (env.cloudinaryHabilitado) {
      assert.equal(res.status, 422);
      assert.match(JSON.stringify(res.body), /foto/i);
    } else {
      // Sin Cloudinary no hay dónde subirlas: trabar el alta sería peor.
      assert.equal(res.status, 201, JSON.stringify(res.body));
    }
  });

  test('sin Cloudinary, subir una foto avisa que no está configurado', async (t) => {
    if (env.cloudinaryHabilitado) {
      t.skip('hay credenciales de Cloudinary cargadas');
      return;
    }
    const res = await agente
      .post('/api/v1/onboarding/fotos')
      .attach('fotos', Buffer.from([0x89, 0x50, 0x4e, 0x47]), { filename: 'f.png', contentType: 'image/png' });
    assert.equal(res.status, 503);
    assert.equal(res.body.error.codigo, 'ALMACENAMIENTO_NO_CONFIGURADO');

    const config = await agente.get('/api/v1/config');
    assert.equal(config.body.fotos.configurado, false);
  });

  test('guarda los tres modos de horario', async () => {
    const modos = [
      { tipoHorario: 'FIJO', horarios: { lun: { abre: '08:00', cierra: '22:00' } } },
      { tipoHorario: 'ABIERTO_24HS', horarios: { abierto24h: true } },
      // En este modo el día trae solo `abre`: la hora de cierre no existe.
      { tipoHorario: 'FIN_EVENTO', horarios: { lun: { abre: '09:00' } } },
    ];

    for (const [i, modo] of modos.entries()) {
      const res = await agente
        .post('/api/v1/onboarding/parkings')
        .send(solicitud(`alta-modo-${i}@${SUFIJO}.test`, { parking: modo }));

      assert.equal(res.status, 201, `falló el modo ${modo.tipoHorario}`);
      creados.push(res.body.solicitud.id);

      const enBase = await prisma.parking.findUnique({ where: { id: res.body.solicitud.id } });
      assert.equal(enBase.tipoHorario, modo.tipoHorario);
    }
  });

  test('rechaza un modo de horario inventado', async () => {
    const res = await agente
      .post('/api/v1/onboarding/parkings')
      .send(solicitud(`alta-modo-malo@${SUFIJO}.test`, { parking: { tipoHorario: 'CUANDO_QUIERO' } }));

    assert.equal(res.status, 422);
  });

  test('valida los datos obligatorios del estacionamiento', async () => {
    const res = await agente
      .post('/api/v1/onboarding/parkings')
      .send(solicitud(`alta-5@${SUFIJO}.test`, { parking: { capacidadTotal: 0 } }));

    assert.equal(res.status, 422);
  });
});

describe('Revisión de solicitudes', () => {
  test('solo el SUPERADMIN ve la bandeja', async () => {
    const anonimo = await agente.get('/api/v1/admin/onboarding');
    assert.equal(anonimo.status, 401);

    const owner = await agente
      .get('/api/v1/admin/onboarding')
      .set('Authorization', `Bearer ${tokenOwnerAjeno}`);
    assert.equal(owner.status, 403);

    const superadmin = await agente
      .get('/api/v1/admin/onboarding')
      .set('Authorization', `Bearer ${tokenSuper}`);
    assert.equal(superadmin.status, 200);
  });

  test('un OWNER no puede aprobar una solicitud ajena', async () => {
    const res = await agente
      .post(`/api/v1/admin/onboarding/${creados[0]}/aprobar`)
      .set('Authorization', `Bearer ${tokenOwnerAjeno}`)
      .send({});

    assert.equal(res.status, 403);

    const enBase = await prisma.parking.findUnique({ where: { id: creados[0] } });
    assert.equal(enBase.estado, 'PENDIENTE_APROBACION', 'el intento no puede haber cambiado nada');
  });

  test('aprobar publica el estacionamiento y habilita al dueño', async () => {
    const res = await agente
      .post(`/api/v1/admin/onboarding/${creados[0]}/aprobar`)
      .set('Authorization', `Bearer ${tokenSuper}`)
      .send({ publicar: true });

    assert.equal(res.status, 200);

    const enBase = await prisma.parking.findUnique({
      where: { id: creados[0] },
      include: { usuarios: true },
    });
    assert.equal(enBase.estado, 'ACTIVO');
    assert.equal(enBase.activo, true);
    assert.equal(enBase.publicado, true);
    assert.ok(enBase.revisadoEn instanceof Date);
    assert.equal(enBase.usuarios[0].activo, true);

    // Y ahora sí entra al panel.
    const login = await agente
      .post('/api/v1/auth/login')
      .send({ email: `alta-1@${SUFIJO}.test`, password: PASSWORD });
    assert.equal(login.status, 200);
    assert.equal(login.body.usuario.role, 'OWNER');
  });

  test('no se puede aprobar dos veces', async () => {
    const res = await agente
      .post(`/api/v1/admin/onboarding/${creados[0]}/aprobar`)
      .set('Authorization', `Bearer ${tokenSuper}`)
      .send({});

    assert.equal(res.status, 409);
  });

  test('rechazar guarda el motivo y no borra el registro', async () => {
    const motivo = 'La dirección no coincide con el domicilio comercial.';

    const res = await agente
      .post(`/api/v1/admin/onboarding/${creados[1]}/rechazar`)
      .set('Authorization', `Bearer ${tokenSuper}`)
      .send({ motivo });

    assert.equal(res.status, 200);

    const enBase = await prisma.parking.findUnique({
      where: { id: creados[1] },
      include: { usuarios: true },
    });
    assert.ok(enBase, 'el registro tiene que seguir existiendo');
    assert.equal(enBase.estado, 'RECHAZADO');
    assert.equal(enBase.publicado, false);
    assert.equal(enBase.motivoRechazo, motivo);
    assert.equal(enBase.usuarios[0].activo, false);
  });
});
