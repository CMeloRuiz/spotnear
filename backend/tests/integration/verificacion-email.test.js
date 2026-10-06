/**
 * Verificación de email en el alta por autogestión, de punta a punta:
 *
 *   registro → PENDIENTE_VERIFICACION → clic en el link → PENDIENTE_APROBACION
 *
 * Y lo que no puede pasar: que una solicitud sin confirmar aparezca en
 * Solicitudes, que se pueda aprobar, que el dueño entre, que un link inválido
 * o vencido confirme algo, o que el reenvío revele qué emails existen.
 *
 * En tests el email queda simulado y la API devuelve el link en
 * `enlaceDePrueba` (nunca en producción): es lo que usa el test como si fuera
 * el clic en el email.
 */
import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../../src/app.js';
import prisma from '../../src/config/prisma.js';
import { crearSuperadminDePrueba, loguear, limpiar, SUFIJO } from '../helpers/fixtures.js';
import { hashDeToken } from '../../src/modules/onboarding/verificacion.js';

const app = crearApp();
const agente = request(app);
const PASSWORD = 'ClaveDePrueba123';
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const tokenDe = (enlace) => enlace.split('/').pop();

function solicitud(email) {
  return {
    duenio: { nombre: 'Lucía', apellido: 'Paz', email, telefono: '11 4444 5555', password: PASSWORD },
    parking: {
      nombre: `Cocheras ${email.split('@')[0]}`,
      direccion: 'Av. Siempreviva 742',
      lat: -34.6,
      lng: -58.44,
      capacidadTotal: 10,
      tiposVehiculo: ['AUTO'],
      tipoHorario: 'ABIERTO_24HS',
      horarios: { abierto24h: true },
      fotos: ['https://ejemplo.test/foto.jpg'],
    },
    aceptaTerminos: true,
    aceptaComision: true,
  };
}

let tokenSuper;
const creados = [];

before(async () => {
  const sa = await crearSuperadminDePrueba();
  tokenSuper = await loguear(agente, sa.usuario.email, sa.password);
});

after(async () => {
  if (creados.length > 0) {
    await prisma.refreshToken.deleteMany({ where: { user: { parkingId: { in: creados } } } });
    await prisma.auditLog.deleteMany({ where: { parkingId: { in: creados } } });
    await prisma.user.deleteMany({ where: { parkingId: { in: creados } } });
    await prisma.parking.deleteMany({ where: { id: { in: creados } } });
  }
  await limpiar();
  await prisma.$disconnect();
});

describe('verificación de email en el alta', () => {
  const email = `verif-1@${SUFIJO}.test`;
  let parkingId;
  let enlace;

  test('el registro deja la solicitud esperando la confirmación y manda el link', async () => {
    const res = await agente.post('/api/v1/onboarding/parkings').send(solicitud(email));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    parkingId = res.body.solicitud.id;
    creados.push(parkingId);
    enlace = res.body.enlaceDePrueba;

    assert.equal(res.body.solicitud.estado, 'PENDIENTE_VERIFICACION');
    assert.match(res.body.mensaje, new RegExp(`Te enviamos un email a ${email}`));
    assert.match(enlace, /\/verificar-email\/[\w-]{40,}$/);

    // En la base se guarda el hash, nunca el token.
    const usuario = await prisma.user.findFirst({ where: { parkingId } });
    assert.equal(usuario.verificacionTokenHash, hashDeToken(tokenDe(enlace)));
    assert.notEqual(usuario.verificacionTokenHash, tokenDe(enlace));
    assert.equal(usuario.emailVerificadoEn, null);
    assert.ok(usuario.verificacionExpiraEn > new Date(Date.now() + 47 * 3_600_000));
  });

  test('sin confirmar, no aparece en Solicitudes (ni en "Todas") ni en Estacionamientos', async () => {
    for (const estado of ['PENDIENTE_APROBACION', 'TODAS']) {
      const res = await agente.get('/api/v1/admin/onboarding').query({ estado }).set(auth(tokenSuper));
      assert.equal(res.status, 200);
      assert.ok(!res.body.solicitudes.some((s) => s.id === parkingId), `apareció en ${estado}`);
    }
    const parkings = await agente
      .get('/api/v1/admin/parkings')
      .query({ incluirInactivos: 'true' })
      .set(auth(tokenSuper));
    assert.ok(!parkings.body.parkings.some((p) => p.id === parkingId));
  });

  test('sin confirmar, no se puede aprobar y el dueño no entra', async () => {
    const aprobar = await agente
      .post(`/api/v1/admin/onboarding/${parkingId}/aprobar`)
      .set(auth(tokenSuper))
      .send({});
    assert.equal(aprobar.status, 409);

    const login = await agente.post('/api/v1/auth/login').send({ email, password: PASSWORD });
    assert.equal(login.status, 403);
    assert.match(login.body.error.mensaje, /confirmaste tu email/i);
  });

  test('repetir el alta con el mismo email no crea otra: ofrece reenviar', async () => {
    const res = await agente.post('/api/v1/onboarding/parkings').send(solicitud(email));
    assert.equal(res.status, 409);
    assert.equal(res.body.error.codigo, 'VERIFICACION_PENDIENTE');
  });

  test('un link inventado no confirma nada', async () => {
    const res = await agente
      .post('/api/v1/onboarding/verificar-email')
      .send({ token: 'x'.repeat(43) });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.codigo, 'TOKEN_INVALIDO');
  });

  test('el reenvío manda un link nuevo y el anterior deja de servir', async () => {
    const res = await agente.post('/api/v1/onboarding/reenviar-verificacion').send({ email });
    assert.equal(res.status, 200);
    assert.ok(res.body.enlaceDePrueba);
    assert.notEqual(res.body.enlaceDePrueba, enlace);

    const viejo = await agente.post('/api/v1/onboarding/verificar-email').send({ token: tokenDe(enlace) });
    assert.equal(viejo.status, 400);

    enlace = res.body.enlaceDePrueba;
  });

  test('el reenvío no revela si un email existe', async () => {
    const res = await agente
      .post('/api/v1/onboarding/reenviar-verificacion')
      .send({ email: `no-existe@${SUFIJO}.test` });
    assert.equal(res.status, 200);
    assert.equal(res.body.enlaceDePrueba, undefined);
  });

  test('clic en el link: pasa a PENDIENTE_APROBACION y aparece en Solicitudes', async () => {
    const res = await agente.post('/api/v1/onboarding/verificar-email').send({ token: tokenDe(enlace) });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.estado, 'PENDIENTE_APROBACION');
    assert.equal(res.body.yaVerificado, false);
    assert.match(res.body.mensaje, /menos de 24 horas/);

    const parking = await prisma.parking.findUnique({ where: { id: parkingId } });
    assert.equal(parking.estado, 'PENDIENTE_APROBACION');
    const usuario = await prisma.user.findFirst({ where: { parkingId } });
    assert.ok(usuario.emailVerificadoEn instanceof Date);

    const bandeja = await agente.get('/api/v1/admin/onboarding').set(auth(tokenSuper));
    assert.ok(bandeja.body.solicitudes.some((s) => s.id === parkingId));

    // Y ahora el login dice "en revisión", no "confirmá tu email".
    const login = await agente.post('/api/v1/auth/login').send({ email, password: PASSWORD });
    assert.equal(login.status, 403);
    assert.match(login.body.error.mensaje, /revisión/i);
  });

  test('abrir el link de nuevo no es un error ni cambia nada', async () => {
    const res = await agente.post('/api/v1/onboarding/verificar-email').send({ token: tokenDe(enlace) });
    assert.equal(res.status, 200);
    assert.equal(res.body.yaVerificado, true);
  });
});

describe('link vencido', () => {
  test('después de 48 horas no confirma y pide uno nuevo', async () => {
    const email = `verif-2@${SUFIJO}.test`;
    const res = await agente.post('/api/v1/onboarding/parkings').send(solicitud(email));
    assert.equal(res.status, 201);
    creados.push(res.body.solicitud.id);

    await prisma.user.updateMany({
      where: { parkingId: res.body.solicitud.id },
      data: { verificacionExpiraEn: new Date(Date.now() - 1000) },
    });

    const vencido = await agente
      .post('/api/v1/onboarding/verificar-email')
      .send({ token: tokenDe(res.body.enlaceDePrueba) });
    assert.equal(vencido.status, 410);
    assert.equal(vencido.body.error.codigo, 'TOKEN_VENCIDO');

    const parking = await prisma.parking.findUnique({ where: { id: res.body.solicitud.id } });
    assert.equal(parking.estado, 'PENDIENTE_VERIFICACION');
  });
});

describe('con VERIFICACION_EMAIL_ALTA=false', () => {
  test('el alta pasa directo a revisión, sin token ni link', async () => {
    const env = (await import('../../src/config/env.js')).default;
    const antes = env.verificacionEmailAlta;
    env.verificacionEmailAlta = false;
    try {
      const res = await agente.post('/api/v1/onboarding/parkings').send(solicitud(`verif-3@${SUFIJO}.test`));
      assert.equal(res.status, 201, JSON.stringify(res.body));
      creados.push(res.body.solicitud.id);
      assert.equal(res.body.solicitud.estado, 'PENDIENTE_APROBACION');
      assert.equal(res.body.verificacion, null);
      assert.equal(res.body.enlaceDePrueba, undefined);

      const usuario = await prisma.user.findFirst({ where: { parkingId: res.body.solicitud.id } });
      assert.equal(usuario.verificacionTokenHash, null);

      const bandeja = await agente.get('/api/v1/admin/onboarding').set(auth(tokenSuper));
      assert.ok(bandeja.body.solicitudes.some((s) => s.id === res.body.solicitud.id));
    } finally {
      env.verificacionEmailAlta = antes;
    }
  });
});
