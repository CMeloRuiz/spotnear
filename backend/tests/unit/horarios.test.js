/**
 * Horarios de atención: los tres modos de cierre.
 *
 * Lo que importa acá es que cada modo valide lo suyo y nada más. En particular
 * FIN_EVENTO: ese estacionamiento no tiene hora de cierre, así que validar
 * contra una sería inventar un dato. Solo se controla que no se entre antes de
 * abrir.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  tipoDeHorario,
  validarHorario,
  describirHorario,
  aMinutos,
} from '../../src/utils/horarios.js';

/** Un miércoles cualquiera, a la hora que se pida. */
const miercoles = (hora, minuto = 0) => new Date(2026, 8, 23, hora, minuto, 0, 0);

describe('aMinutos', () => {
  test('convierte horas válidas', () => {
    assert.equal(aMinutos('00:00'), 0);
    assert.equal(aMinutos('07:30'), 450);
    assert.equal(aMinutos('23:59'), 1439);
  });

  test('rechaza basura', () => {
    for (const v of ['24:00', '12:60', 'nueve', '', null, undefined, 7]) {
      assert.equal(aMinutos(v), null, `debería rechazar ${JSON.stringify(v)}`);
    }
  });
});

describe('tipoDeHorario', () => {
  test('usa la columna cuando está', () => {
    assert.equal(tipoDeHorario({ tipoHorario: 'FIN_EVENTO' }), 'FIN_EVENTO');
    assert.equal(tipoDeHorario({ tipoHorario: 'ABIERTO_24HS' }), 'ABIERTO_24HS');
  });

  test('deduce el modo de los datos viejos, que no tienen columna', () => {
    assert.equal(tipoDeHorario({ horarios: { abierto24h: true } }), 'ABIERTO_24HS');
    assert.equal(tipoDeHorario({ horarios: { lun: { abre: '08:00' } } }), 'FIJO');
    assert.equal(tipoDeHorario({}), 'FIJO');
    assert.equal(tipoDeHorario(null), 'FIJO');
  });

  test('ignora un valor inventado y cae al deducido', () => {
    assert.equal(tipoDeHorario({ tipoHorario: 'CUANDO_QUIERO' }), 'FIJO');
  });
});

describe('validarHorario · ABIERTO_24HS', () => {
  const parking = { tipoHorario: 'ABIERTO_24HS', horarios: { abierto24h: true } };

  test('acepta cualquier hora', () => {
    for (const h of [0, 4, 12, 23]) {
      assert.equal(validarHorario(parking, miercoles(h)), null);
    }
  });
});

describe('validarHorario · FIJO', () => {
  const parking = {
    tipoHorario: 'FIJO',
    horarios: { mie: { abre: '07:00', cierra: '23:00' } },
  };

  test('acepta dentro del horario', () => {
    assert.equal(validarHorario(parking, miercoles(7)), null);
    assert.equal(validarHorario(parking, miercoles(15)), null);
    assert.equal(validarHorario(parking, miercoles(23)), null);
  });

  test('rechaza fuera del horario', () => {
    assert.match(validarHorario(parking, miercoles(6, 59)), /horario de atención/);
    assert.match(validarHorario(parking, miercoles(23, 30)), /horario de atención/);
  });

  test('maneja el cierre después de medianoche', () => {
    const nocturno = { tipoHorario: 'FIJO', horarios: { mie: { abre: '08:00', cierra: '02:00' } } };
    assert.equal(validarHorario(nocturno, miercoles(23)), null);
    assert.equal(validarHorario(nocturno, miercoles(1)), null, 'la 1 AM sigue dentro');
    assert.match(validarHorario(nocturno, miercoles(4)), /horario de atención/);
  });

  test('rechaza un día marcado como cerrado', () => {
    const cerrado = { tipoHorario: 'FIJO', horarios: { mie: { cerrado: true } } };
    assert.match(validarHorario(cerrado, miercoles(12)), /cerrado/i);
  });
});

describe('validarHorario · FIN_EVENTO', () => {
  const parking = { tipoHorario: 'FIN_EVENTO', horarios: { mie: { abre: '09:00' } } };

  test('rechaza ingresar antes de abrir', () => {
    assert.match(validarHorario(parking, miercoles(8, 59)), /abre a las 09:00/);
  });

  test('acepta desde la apertura y a cualquier hora posterior', () => {
    assert.equal(validarHorario(parking, miercoles(9)), null);
    assert.equal(validarHorario(parking, miercoles(23, 59)), null);
  });

  test('no inventa una hora de cierre aunque el JSON traiga una vieja', () => {
    // Si el estacionamiento pasó de FIJO a FIN_EVENTO, el `cierra` puede haber
    // quedado en el JSON. El modo manda: ese dato se ignora.
    const conRestoViejo = {
      tipoHorario: 'FIN_EVENTO',
      horarios: { mie: { abre: '09:00', cierra: '18:00' } },
    };
    assert.equal(validarHorario(conRestoViejo, miercoles(22)), null);
  });

  test('sigue respetando el día cerrado', () => {
    const cerrado = { tipoHorario: 'FIN_EVENTO', horarios: { mie: { cerrado: true } } };
    assert.match(validarHorario(cerrado, miercoles(12)), /cerrado/i);
  });
});

describe('describirHorario', () => {
  test('un texto distinto y legible por modo', () => {
    assert.equal(
      describirHorario({ tipoHorario: 'ABIERTO_24HS', horarios: { abierto24h: true } }, miercoles(12)),
      'Abierto las 24 horas',
    );
    assert.equal(
      describirHorario({ tipoHorario: 'FIJO', horarios: { mie: { abre: '07:00', cierra: '23:00' } } }, miercoles(12)),
      '07:00 a 23:00',
    );
    assert.equal(
      describirHorario({ tipoHorario: 'FIN_EVENTO', horarios: { mie: { abre: '09:00' } } }, miercoles(12)),
      'Abre 09:00 · cierra al finalizar el evento',
    );
    assert.equal(
      describirHorario({ tipoHorario: 'FIJO', horarios: { mie: { cerrado: true } } }, miercoles(12)),
      'Cerrado',
    );
  });
});
