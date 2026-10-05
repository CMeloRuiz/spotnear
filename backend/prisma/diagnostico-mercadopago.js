/**
 * Diagnóstico de Mercado Pago, sin pasar por SpotNear.
 *
 *   npm run mp:diagnostico
 *
 * Responde, en este orden, las preguntas que hay que hacerse cuando un pago de
 * prueba falla con el genérico "Algo salió mal... No pudimos procesar tu pago":
 *
 *  1. ¿Hay credenciales y son del mismo tipo? (las dos TEST- o las dos APP_USR-)
 *  2. ¿El access token funciona y de qué cuenta es? ¿Está habilitada para vender?
 *  3. ¿Se puede crear una preferencia de Checkout Pro?
 *  4. ¿Se puede crear un PAGO? Con la tarjeta de prueba pública y titular APRO,
 *     directo contra la API. Si esto falla, el problema no está en SpotNear ni
 *     en Render: es de la cuenta o de la aplicación de Mercado Pago.
 *
 * No imprime credenciales: solo el prefijo y los últimos 4 caracteres. El pago
 * del paso 4 solo se intenta con credenciales de prueba (no cobra nada).
 */
import 'dotenv/config';
import crypto from 'node:crypto';

const API = 'https://api.mercadopago.com';
const token = process.env.MERCADOPAGO_ACCESS_TOKEN ?? '';
const publicKey = process.env.MERCADOPAGO_PUBLIC_KEY ?? '';

const ok = (msg) => console.log(`  ✔ ${msg}`);
const mal = (msg) => console.log(`  ✘ ${msg}`);
const info = (msg) => console.log(`    ${msg}`);
const enmascarar = (v) => (v ? `${v.split('-')[0]}-…${v.slice(-4)}` : '(vacía)');
// Por el prefijo solo se sabe el formato. APP_USR-… puede ser producción o
// una cuenta de prueba (lo que muestra hoy el panel en "Credenciales de
// prueba"); eso se resuelve en el paso 2 con el tag test_user de la cuenta.
const tipo = (v) => (v.startsWith('TEST-') ? 'TEST' : v.startsWith('APP_USR-') ? 'APP_USR' : 'desconocido');

async function api(metodo, ruta, cuerpo, { conToken = true } = {}) {
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(conToken ? { Authorization: `Bearer ${token}` } : {}),
      ...(metodo === 'POST' ? { 'X-Idempotency-Key': crypto.randomUUID() } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  let datos = null;
  try {
    datos = await res.json();
  } catch {
    /* sin cuerpo */
  }
  return { status: res.status, datos, requestId: res.headers.get('x-request-id') };
}

let fallas = 0;

console.log('\n1. Credenciales');
if (!token) {
  mal('Falta MERCADOPAGO_ACCESS_TOKEN.');
  process.exit(1);
}
info(`MERCADOPAGO_ACCESS_TOKEN = ${enmascarar(token)} (${tipo(token)})`);
info(`MERCADOPAGO_PUBLIC_KEY   = ${enmascarar(publicKey)} (${publicKey ? tipo(publicKey) : '—'})`);
if (publicKey && tipo(publicKey) !== tipo(token)) {
  mal('Las dos credenciales tienen distinto formato (una TEST- y otra APP_USR-). Tienen que ser del mismo par.');
  fallas++;
} else {
  ok('Mismo tipo de credenciales.');
}
// El token tiene el id de la aplicación después del prefijo: TEST-<appId>-...
const appDelToken = token.split('-')[1];
info(`Aplicación del access token: ${appDelToken}`);

console.log('\n2. Cuenta dueña del access token');
const yo = await api('GET', '/users/me');
if (yo.status !== 200) {
  mal(`El access token no sirve (HTTP ${yo.status}): ${yo.datos?.message ?? ''}`);
  process.exit(1);
}
const cuentaDePrueba = tipo(token) === 'TEST' || (yo.datos.tags ?? []).includes('test_user');
ok(`Cuenta ${yo.datos.id} (${yo.datos.site_id}) → credenciales de ${cuentaDePrueba ? 'PRUEBA' : 'PRODUCCIÓN'}.`);
if (tipo(token) === 'APP_USR' && cuentaDePrueba) {
  info('Es una cuenta de prueba con credenciales APP_USR-: el formato actual de las credenciales de prueba.');
}
if (yo.datos.status?.sell?.allow === false) {
  mal(`La cuenta no está habilitada para vender: ${JSON.stringify(yo.datos.status.sell.codes)}`);
  fallas++;
} else {
  ok('Habilitada para vender.');
}

console.log('\n3. Preferencia de Checkout Pro');
const pref = await api('POST', '/checkout/preferences', {
  items: [{ title: 'Diagnóstico SpotNear', quantity: 1, currency_id: 'ARS', unit_price: 100 }],
  payer: { email: 'diagnostico.spotnear@example.com' },
  expires: true,
  expiration_date_to: new Date(Date.now() + 10 * 60_000).toISOString(),
});
if (pref.status === 201) {
  ok(`Preferencia creada (${pref.datos.id}).`);
} else {
  mal(`No se pudo crear la preferencia (HTTP ${pref.status}): ${pref.datos?.message ?? ''}`);
  fallas++;
}

console.log('\n4. Pago de prueba directo contra la API');
if (!cuentaDePrueba) {
  info('Se saltea: con credenciales de producción esto sería un cobro real.');
} else if (tipo(token) === 'APP_USR') {
  // Con APP_USR-… de una cuenta de prueba, Mercado Pago rechaza SIEMPRE el
  // pago directo con tarjeta de prueba ("Unauthorized use of live
  // credentials"), con cualquier email: es una restricción de la API de Pagos,
  // no un problema de las credenciales. SpotNear no usa esa API sino Checkout
  // Pro, que sí funciona. La prueba que vale es esa, en el navegador.
  info('Se saltea: con credenciales APP_USR- de una cuenta de prueba, la API de Pagos directa');
  info('no acepta tarjetas de prueba ("Unauthorized use of live credentials") aunque todo esté bien.');
  info('SpotNear cobra con Checkout Pro: probalo reservando en la web y, en el checkout, tocando');
  info('"Ingresar con mi cuenta" con una cuenta de prueba COMPRADORA (como invitado Mercado Pago');
  info('responde "una de las partes es de prueba"). Ver README → "Si los pagos de prueba fallan".');
} else if (!publicKey) {
  info('Se saltea: falta MERCADOPAGO_PUBLIC_KEY para tokenizar la tarjeta de prueba.');
} else {
  const tarjeta = await api(
    'POST',
    `/v1/card_tokens?public_key=${encodeURIComponent(publicKey)}`,
    {
      card_number: '5031755734530604',
      expiration_month: 11,
      expiration_year: 2030,
      security_code: '123',
      cardholder: { name: 'APRO', identification: { type: 'DNI', number: '12345678' } },
    },
    { conToken: false },
  );
  if (!tarjeta.datos?.id) {
    mal(`La public key no tokenizó la tarjeta de prueba (HTTP ${tarjeta.status}): ${tarjeta.datos?.message ?? ''}`);
    fallas++;
  } else {
    const pago = await api('POST', '/v1/payments', {
      transaction_amount: 100,
      token: tarjeta.datos.id,
      installments: 1,
      payment_method_id: 'master',
      description: 'Diagnóstico SpotNear',
      payer: { email: 'diagnostico.spotnear@example.com' },
    });
    if (pago.status === 201 && pago.datos?.status === 'approved') {
      ok(`Pago de prueba aprobado (${pago.datos.id}). El sandbox funciona con estas credenciales.`);
    } else if (pago.status === 404 || pago.datos?.cause?.some?.((c) => String(c.code) === '2006')) {
      mal('La tarjeta tokenizada con la public key no existe para este access token: son de aplicaciones distintas.');
      fallas++;
    } else {
      mal(
        `Mercado Pago no creó el pago (HTTP ${pago.status}, ${pago.datos?.message ?? pago.datos?.status_detail ?? ''}). ` +
          `x-request-id: ${pago.requestId ?? '—'}`,
      );
      info('Si esto falla, el problema NO es de SpotNear ni de Render: es de la cuenta o la aplicación');
      info('de Mercado Pago. Ver README → "Si los pagos de prueba fallan con «Algo salió mal»".');
      fallas++;
    }
  }
}

console.log(fallas ? `\n${fallas} problema(s) encontrado(s).\n` : '\nTodo en orden.\n');
process.exit(fallas ? 1 : 0);
