/**
 * Normalización de teléfonos argentinos a E.164.
 *
 * Es el dato más sucio que entra al sistema y el más importante: de él depende
 * que el link de WhatsApp abra el chat correcto.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarTelefono, formatearTelefono, aWhatsApp } from '../../src/utils/phone.js';

describe('normalizarTelefono · CABA', () => {
  const esperado = '+5491112345678';

  const variantes = [
    ['formato internacional completo', '+54 9 11 1234 5678'],
    ['internacional sin espacios', '+5491112345678'],
    ['internacional con 00', '005491112345678'],
    ['con 0 y 15 (marcación vieja)', '011 15 1234-5678'],
    ['con 15 pegado', '01115 1234 5678'],
    ['solo área y abonado', '11 1234 5678'],
    ['todo junto', '1112345678'],
    ['con guiones y paréntesis', '(011) 1234-5678'],
    ['con 15 sin área', '15 1234 5678'],
    ['solo abonado (se asume área 11)', '1234-5678'],
  ];

  for (const [descripcion, entrada] of variantes) {
    test(`${descripcion}: "${entrada}"`, () => {
      const r = normalizarTelefono(entrada);
      assert.equal(r.valido, true, `debería ser válido: ${r.motivo ?? ''}`);
      assert.equal(r.e164, esperado);
    });
  }
});

describe('normalizarTelefono · interior', () => {
  test('Córdoba con área de 3 dígitos y 15', () => {
    const r = normalizarTelefono('0351 15 123 4567');
    assert.equal(r.valido, true);
    assert.equal(r.e164, '+5493511234567');
    assert.equal(r.nacional, '3511234567');
  });

  test('área de 4 dígitos con 15', () => {
    const r = normalizarTelefono('02257 15 123456');
    assert.equal(r.valido, true);
    assert.equal(r.e164, '+5492257123456');
  });

  test('Rosario sin 15', () => {
    const r = normalizarTelefono('341 456 7890');
    assert.equal(r.valido, true);
    assert.equal(r.e164, '+5493414567890');
  });
});

describe('normalizarTelefono · rechazos', () => {
  test('rechaza números demasiado cortos o largos', () => {
    for (const malo of ['', '123', '11', '1234567890123456']) {
      assert.equal(normalizarTelefono(malo).valido, false, `debería rechazar "${malo}"`);
    }
  });

  test('rechaza códigos de área imposibles', () => {
    // Un área que arranca en 1 y no es 11 no existe en Argentina.
    assert.equal(normalizarTelefono('1234567890').valido, false);
  });

  test('tolera null y undefined', () => {
    assert.equal(normalizarTelefono(null).valido, false);
    assert.equal(normalizarTelefono(undefined).valido, false);
  });
});

describe('formato de salida', () => {
  test('formatearTelefono deja el número legible', () => {
    assert.equal(formatearTelefono('+5491112345678'), '+54 9 11 1234-5678');
  });

  test('aWhatsApp deja solo dígitos', () => {
    assert.equal(aWhatsApp('+54 9 11 1234-5678'), '5491112345678');
  });

  test('marca cuando se asumió el código de área', () => {
    assert.equal(normalizarTelefono('1234-5678').areaAsumida, true);
    assert.equal(normalizarTelefono('11 1234 5678').areaAsumida, false);
  });
});
