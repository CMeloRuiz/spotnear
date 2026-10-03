/**
 * Validación de patentes argentinas.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarPatente,
  esPatenteValida,
  normalizarPatente,
  formatearPatente,
} from '../../src/utils/patente.js';

describe('normalizarPatente', () => {
  test('pasa a mayúsculas y saca separadores', () => {
    assert.equal(normalizarPatente('ab 123 cd'), 'AB123CD');
    assert.equal(normalizarPatente('abc-123'), 'ABC123');
    assert.equal(normalizarPatente(' aa.111.bb '), 'AA111BB');
  });

  test('tolera entradas que no son texto', () => {
    assert.equal(normalizarPatente(null), '');
    assert.equal(normalizarPatente(undefined), '');
    assert.equal(normalizarPatente(123), '');
  });
});

describe('validarPatente', () => {
  test('acepta el formato viejo ABC123', () => {
    const r = validarPatente('ABC123');
    assert.equal(r.valida, true);
    assert.equal(r.formato, 'VIEJO');
    assert.equal(r.patente, 'ABC123');
  });

  test('acepta el formato Mercosur AB123CD', () => {
    const r = validarPatente('AB123CD');
    assert.equal(r.valida, true);
    assert.equal(r.formato, 'MERCOSUR');
  });

  test('acepta patentes de moto en ambos formatos', () => {
    assert.equal(validarPatente('123ABC').formato, 'MOTO_VIEJO');
    assert.equal(validarPatente('A123BCD').formato, 'MOTO_MERCOSUR');
  });

  test('normaliza antes de validar', () => {
    const r = validarPatente('ab 123 cd');
    assert.equal(r.valida, true);
    assert.equal(r.patente, 'AB123CD');
  });

  test('rechaza formatos que no existen', () => {
    for (const mala of ['', 'XX', 'ABCD12', '12345678', 'AB123C', 'ABC12', 'AB-CD-12']) {
      assert.equal(esPatenteValida(mala), false, `debería rechazar "${mala}"`);
    }
  });
});

describe('formatearPatente', () => {
  test('separa los bloques para mostrarla', () => {
    assert.equal(formatearPatente('AB123CD'), 'AB 123 CD');
    assert.equal(formatearPatente('ABC123'), 'ABC 123');
  });

  test('devuelve la entrada normalizada si no reconoce el formato', () => {
    assert.equal(formatearPatente('XX'), 'XX');
  });
});
