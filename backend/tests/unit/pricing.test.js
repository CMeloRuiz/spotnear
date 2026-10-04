/**
 * Cálculo de precio y comisión.
 *
 * Es la parte del sistema donde un error se traduce directamente en plata:
 * o se le cobra de menos al cliente, o se le liquida mal al estacionamiento.
 *
 * Dos números distintos, y conviene no confundirlos:
 *   · subtotal    → lo que cobra el estacionamiento (su tarifa).
 *   · precioTotal → lo que paga el cliente = subtotal + servicio de SpotNear.
 *
 * Los tests de cálculo de tarifa miran el subtotal; el bloque de comisión mira
 * cómo se arma el total.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { calcularPrecio, tarifaDesde } from '../../src/services/pricing.js';
import { calcularComision, redondear, formatearARS } from '../../src/utils/money.js';

const parking = { comisionPorcentaje: 10, moneda: 'ARS' };

const tarifa = (tipo, precio, extra = {}) => ({
  id: `t-${tipo}-${precio}`,
  tipo,
  precio,
  activo: true,
  vehicleType: null,
  vigenciaDesde: null,
  vigenciaHasta: null,
  ...extra,
});

const enHoras = (desde, horas) => new Date(desde.getTime() + horas * 3_600_000);
const BASE = new Date('2026-10-10T19:00:00.000Z');

describe('cálculo por hora', () => {
  const tarifas = [tarifa('HORA', 2000)];

  test('cobra las horas exactas', () => {
    const r = calcularPrecio({ parking, tarifas, inicio: BASE, fin: enHoras(BASE, 3) });
    assert.equal(r.subtotal, 6000);
    assert.equal(r.desglose.modo, 'HORA');
    assert.equal(r.desglose.unidades, 3);
  });

  test('redondea las fracciones para arriba', () => {
    const r = calcularPrecio({ parking, tarifas, inicio: BASE, fin: enHoras(BASE, 3.5) });
    assert.equal(r.desglose.unidades, 4, '3,5 horas se cobran como 4');
    assert.equal(r.subtotal, 8000);
  });

  test('cobra un mínimo de 1 hora', () => {
    const r = calcularPrecio({ parking, tarifas, inicio: BASE, fin: enHoras(BASE, 0.25) });
    assert.equal(r.desglose.unidades, 1);
    assert.equal(r.subtotal, 2000);
  });

  test('multiplica por la cantidad de vehículos', () => {
    const r = calcularPrecio({
      parking,
      tarifas,
      inicio: BASE,
      fin: enHoras(BASE, 2),
      cantidadVehiculos: 3,
    });
    assert.equal(r.subtotal, 12000);
    assert.equal(r.desglose.cantidadVehiculos, 3);
  });
});

describe('escalones de estadía', () => {
  // $2.000 la hora: media estadía $8.000 (×4), estadía completa $10.000 (×5).
  const tarifas = [tarifa('HORA', 2000)];
  const sub = (horas) =>
    calcularPrecio({ parking, tarifas, inicio: BASE, fin: enHoras(BASE, horas) });

  test('menos de 4 horas se cobra por hora', () => {
    assert.equal(sub(1).desglose.modo, 'HORA');
    assert.equal(sub(1).subtotal, 2000);
    assert.equal(sub(3).subtotal, 6000);
    // Las fracciones se redondean hacia arriba: 3,5 h se cobran como 4 h, que
    // es justo donde empieza la media estadía y da el mismo número.
    assert.equal(sub(3.5).subtotal, 8000);
  });

  test('de 4 a 12 horas es media estadía: 4 veces el valor de la hora', () => {
    for (const horas of [4, 6, 11, 11.99]) {
      const r = sub(horas);
      assert.equal(r.desglose.modo, 'MEDIA_ESTADIA', `${horas}h`);
      assert.equal(r.subtotal, 8000, `${horas}h`);
    }
  });

  test('las 12 horas exactas ya son estadía completa, no media', () => {
    const r = sub(12);
    assert.equal(r.desglose.modo, 'ESTADIA_COMPLETA');
    assert.equal(r.subtotal, 10000);
  });

  test('de 12 a 24 horas es estadía completa: 5 veces el valor de la hora', () => {
    for (const horas of [12, 20, 24]) {
      assert.equal(sub(horas).subtotal, 10000, `${horas}h`);
    }
  });

  test('pasadas las 24 horas el ciclo se reinicia', () => {
    // 29 h = un día completo ($10.000) + 5 h de media estadía ($8.000)
    assert.equal(sub(29).subtotal, 18000);
    // 48 h = dos días completos, sin resto
    assert.equal(sub(48).subtotal, 20000);
    // 50 h = dos días completos + 2 h por hora
    assert.equal(sub(50).subtotal, 24000);
  });

  test('nunca sale más caro dejar el auto más tiempo', () => {
    let anterior = 0;
    for (const horas of [1, 2, 4, 8, 12, 20, 24, 29, 48, 50]) {
      const r = sub(horas);
      assert.ok(
        r.precioTotal >= anterior,
        `${horas}h costó ${r.precioTotal}, menos que las ${anterior} de la franja anterior`,
      );
      anterior = r.precioTotal;
    }
  });
});

/**
 * Los cinco casos del reporte del bug de tarifas (Parking Thames 350, hora a
 * $7.500). El motor ya los calculaba bien: el error estaba en la barra de la
 * pantalla de resultados, que mostraba un horario y cotizaba otro. Quedan
 * fijados acá para que el motor no se rompa nunca en estos números.
 */
describe('los cinco casos del reporte, con la hora a $7.500', () => {
  const tarifas = [tarifa('HORA', 7500)];
  const casos = [
    [2, 15_000, 'por hora: 2 × 7.500'],
    [6, 30_000, 'media estadía: 4 × 7.500'],
    [12, 37_500, 'estadía completa: 5 × 7.500 (12 h exactas ya son completa)'],
    [20, 37_500, 'estadía completa: 5 × 7.500'],
    [26, 52_500, 'ciclo reiniciado: una completa (37.500) + 2 horas (15.000)'],
  ];

  for (const [horas, esperado, regla] of casos) {
    test(`${horas} h → $${esperado.toLocaleString('es-AR')} (${regla})`, () => {
      const r = calcularPrecio({ parking, tarifas, inicio: BASE, fin: enHoras(BASE, horas) });
      assert.equal(r.subtotal, esperado);
    });
  }
});

describe('por hora vs. por día', () => {
  const tarifas = [tarifa('HORA', 2000), tarifa('DIA', 15000)];

  test('estadía corta: gana la tarifa por hora', () => {
    const r = calcularPrecio({ parking, tarifas, inicio: BASE, fin: enHoras(BASE, 2) });
    assert.equal(r.desglose.modo, 'HORA');
    assert.equal(r.subtotal, 4000);
  });

  test('la media estadía le gana al día si es más barata', () => {
    // 10 h: media estadía $8.000 contra $15.000 el día
    const r = calcularPrecio({ parking, tarifas, inicio: BASE, fin: enHoras(BASE, 10) });
    assert.equal(r.desglose.modo, 'MEDIA_ESTADIA');
    assert.equal(r.subtotal, 8000);
  });

  test('se cobra el día cuando resulta más barato que los escalones', () => {
    // Con la hora a $3.000, la estadía completa son $15.000 contra $9.000 el día.
    const caras = [tarifa('HORA', 3000), tarifa('DIA', 9000)];
    const r = calcularPrecio({ parking, tarifas: caras, inicio: BASE, fin: enHoras(BASE, 14) });
    assert.equal(r.desglose.modo, 'DIA');
    assert.equal(r.subtotal, 9000);
  });

  test('25 horas: un día completo más una hora, no dos días', () => {
    const r = calcularPrecio({ parking, tarifas, inicio: BASE, fin: enHoras(BASE, 25) });
    assert.equal(r.subtotal, 12000, 'estadía completa $10.000 + 1 hora $2.000');
    assert.ok(r.subtotal < 30000, 'no se cobran 2 días');
  });
});

describe('tarifas por tipo de vehículo', () => {
  const tarifas = [
    tarifa('HORA', 2000),
    tarifa('HORA', 1100, { vehicleType: 'MOTO' }),
  ];

  test('la moto paga su tarifa', () => {
    const r = calcularPrecio({ parking, tarifas, inicio: BASE, fin: enHoras(BASE, 2), vehicleType: 'MOTO' });
    assert.equal(r.subtotal, 2200);
  });

  test('el auto paga la general, no la de moto', () => {
    const r = calcularPrecio({ parking, tarifas, inicio: BASE, fin: enHoras(BASE, 2), vehicleType: 'AUTO' });
    assert.equal(r.subtotal, 4000);
  });

  test('sin tipo de vehículo se cotiza con la tarifa general', () => {
    // Si no, la búsqueda mostraría el precio de moto a todo el mundo.
    const r = calcularPrecio({ parking, tarifas, inicio: BASE, fin: enHoras(BASE, 2) });
    assert.equal(r.subtotal, 4000);
  });
});

describe('estacionamiento con tarifas SOLO por tipo de vehículo', () => {
  // Regresión: un estacionamiento cuya única tarifa estaba atada a AUTO no
  // cotizaba en la búsqueda genérica (que no pregunta el vehículo), y la
  // búsqueda lo descartaba en silencio. Quedaba aprobado y publicado en el
  // panel, pero invisible para el público.
  const soloAuto = [tarifa('HORA', 6500, { vehicleType: 'AUTO' })];

  test('cotiza en la búsqueda genérica, sin tipo de vehículo', () => {
    const r = calcularPrecio({ parking, tarifas: soloAuto, inicio: BASE, fin: enHoras(BASE, 3) });
    assert.equal(r.subtotal, 19500);
  });

  test('su "desde" tampoco desaparece', () => {
    assert.equal(tarifaDesde(soloAuto).precio, 6500);
  });

  test('sigue sin cotizar para un vehículo que no acepta', () => {
    assert.throws(
      () => calcularPrecio({ parking, tarifas: soloAuto, inicio: BASE, fin: enHoras(BASE, 3), vehicleType: 'MOTO' }),
      /tarifa/i,
    );
  });

  test('con AUTO y MOTO pero sin general, la genérica usa la de AUTO', () => {
    // AUTO es el vehículo más frecuente: mostrar el precio de moto sería
    // prometer algo que después no se cumple.
    const ambas = [
      tarifa('HORA', 6500, { vehicleType: 'AUTO' }),
      tarifa('HORA', 2000, { vehicleType: 'MOTO' }),
    ];
    const r = calcularPrecio({ parking, tarifas: ambas, inicio: BASE, fin: enHoras(BASE, 2) });
    assert.equal(r.subtotal, 13000);
    assert.equal(tarifaDesde(ambas).precio, 6500);
  });

  test('un estacionamiento solo de motos cotiza con la de moto', () => {
    const soloMoto = [tarifa('HORA', 2000, { vehicleType: 'MOTO' })];
    const r = calcularPrecio({ parking, tarifas: soloMoto, inicio: BASE, fin: enHoras(BASE, 2) });
    assert.equal(r.subtotal, 4000);
  });

  test('sin ninguna tarifa sigue sin cotizar', () => {
    assert.throws(() => calcularPrecio({ parking, tarifas: [], inicio: BASE, fin: enHoras(BASE, 2) }), /tarifa/i);
  });
});

describe('comisión y servicio', () => {
  // El servicio se calcula sobre el subtotal y se SUMA. El estacionamiento
  // cobra su tarifa completa; el cliente paga esa tarifa más el servicio.
  test('20% por defecto: el ejemplo del checkout', () => {
    // Sin porcentaje configurado en el estacionamiento se usa el default.
    const r = calcularPrecio({
      parking: { moneda: 'ARS' },
      tarifas: [tarifa('HORA', 4000)],
      inicio: BASE,
      fin: enHoras(BASE, 3),
    });

    assert.equal(r.subtotal, 12000, 'lo que cobra el estacionamiento');
    assert.equal(r.montoComision, 2400, 'la seña de SpotNear: 20%');
    assert.equal(r.precioTotal, 14400, 'lo que paga el cliente');
    assert.equal(r.montoNeto, 12000, 'al dueño le queda su tarifa entera');
  });

  test('un estacionamiento con 20% cobra la seña sobre el precio de los escalones', () => {
    // El caso del reporte: 2 horas a $7.500 → $15.000 de tarifa, $3.000 de seña.
    const r = calcularPrecio({
      parking: { comisionPorcentaje: 20, moneda: 'ARS' },
      tarifas: [tarifa('HORA', 7500)],
      inicio: BASE,
      fin: enHoras(BASE, 2),
    });
    assert.equal(r.montoComision, 3000);
    assert.equal(r.precioTotal, 18000);
  });

  test('comisión + neto === total, sin centavos perdidos', () => {
    const r = calcularPrecio({ parking, tarifas: [tarifa('HORA', 2000)], inicio: BASE, fin: enHoras(BASE, 3) });
    assert.equal(redondear(r.montoComision + r.montoNeto), r.precioTotal);
  });

  test('respeta el porcentaje configurado por estacionamiento', () => {
    const caro = { comisionPorcentaje: 15, moneda: 'ARS' };
    const r = calcularPrecio({ parking: caro, tarifas: [tarifa('HORA', 2000)], inicio: BASE, fin: enHoras(BASE, 2) });

    assert.equal(r.subtotal, 4000);
    assert.equal(r.montoComision, 600);
    assert.equal(r.precioTotal, 4600);
  });

  test('con 0% el cliente paga exactamente la tarifa', () => {
    const sinComision = { comisionPorcentaje: 0, moneda: 'ARS' };
    const r = calcularPrecio({ parking: sinComision, tarifas: [tarifa('HORA', 2000)], inicio: BASE, fin: enHoras(BASE, 2) });

    assert.equal(r.montoComision, 0);
    assert.equal(r.precioTotal, r.subtotal);
    assert.equal(r.montoNeto, r.precioTotal);
  });

  test('el desglose expone los tres montos del modelo de seña', () => {
    const r = calcularPrecio({ parking, tarifas: [tarifa('HORA', 4000)], inicio: BASE, fin: enHoras(BASE, 3) });

    // Lo que cobra el estacionamiento: entero, sin descuentos.
    assert.equal(r.desglose.subtotal, 12000);
    assert.equal(r.desglose.aPagarEnElLugar, 12000);

    // La seña se SUMA al valor del estacionamiento, no se le resta.
    assert.equal(r.desglose.sena, 1200);
    assert.equal(r.desglose.aPagarAhora, 1200);

    assert.equal(r.precioTotal, 13200);
    assert.equal(
      r.desglose.aPagarAhora + r.desglose.aPagarEnElLugar,
      r.precioTotal,
      'lo que paga ahora más lo que paga allá tiene que dar el total',
    );
  });

  test('la seña se calcula sobre el precio que salió de los escalones', () => {
    // 6 h con la hora a $6.500 cae en media estadía: 6500 × 4 = $26.000.
    const r = calcularPrecio({ parking, tarifas: [tarifa('HORA', 6500)], inicio: BASE, fin: enHoras(BASE, 6) });

    assert.equal(r.desglose.modo, 'MEDIA_ESTADIA');
    assert.equal(r.subtotal, 26000);
    assert.equal(r.desglose.sena, 2600, 'el 10% del valor que dio el escalón, no de otro');
    assert.equal(r.precioTotal, 28600);
  });
});

describe('errores esperados', () => {
  test('sin tarifas cargadas avisa con un mensaje claro', () => {
    assert.throws(
      () => calcularPrecio({ parking, tarifas: [], inicio: BASE, fin: enHoras(BASE, 2) }),
      (e) => e.codigo === 'SIN_TARIFA' && /tarifas/i.test(e.message),
    );
  });

  test('rechaza un rango invertido', () => {
    assert.throws(
      () => calcularPrecio({ parking, tarifas: [tarifa('HORA', 2000)], inicio: BASE, fin: enHoras(BASE, -2) }),
      (e) => e.codigo === 'RANGO_INVALIDO',
    );
  });

  test('pedir mensual sin tarifa mensual avisa', () => {
    assert.throws(
      () =>
        calcularPrecio({
          parking,
          tarifas: [tarifa('HORA', 2000)],
          inicio: BASE,
          fin: enHoras(BASE, 24 * 30),
          modalidad: 'MENSUAL',
        }),
      (e) => e.codigo === 'SIN_TARIFA_MENSUAL',
    );
  });
});

describe('tarifaDesde', () => {
  test('devuelve la tarifa general más barata por hora', () => {
    const r = tarifaDesde([tarifa('HORA', 2500), tarifa('HORA', 1800), tarifa('DIA', 12000)]);
    assert.equal(r.precio, 1800);
  });

  test('prefiere la general sobre las atadas a un vehículo', () => {
    const r = tarifaDesde([tarifa('HORA', 2500), tarifa('HORA', 900, { vehicleType: 'MOTO' })]);
    assert.equal(r.precio, 2500, 'el "desde" no puede ser el precio de moto');
  });

  test('pero usa las específicas si no hay ninguna general', () => {
    // Antes devolvía null y el estacionamiento se caía de la búsqueda.
    const r = tarifaDesde([tarifa('HORA', 6500, { vehicleType: 'AUTO' })]);
    assert.equal(r.precio, 6500);
  });

  test('sin tarifa por hora devuelve null', () => {
    assert.equal(tarifaDesde([tarifa('DIA', 12000)]), null);
  });
});

describe('formato de moneda', () => {
  test('usa el formato argentino sin decimales redondos', () => {
    assert.equal(formatearARS(12000), '$12.000');
    assert.equal(formatearARS(1500000), '$1.500.000');
  });

  test('muestra centavos solo si los hay', () => {
    assert.equal(formatearARS(1234.5), '$1.234,50');
  });
});
