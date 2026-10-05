/**
 * Detección del tipo de vehículo por marca y modelo, sin base de datos.
 *
 * Lo que no se puede romper: que la forma de escribir no importe ("VW
 * T-Cross", "volkswagen tcross"), que la versión detrás del modelo no lo
 * confunda ("Hilux SRV 4x4"), que un modelo más específico gane ("Corolla
 * Cross" no es "Corolla") y que lo desconocido NO se adivine.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, normalizarMarca, buscarEnCatalogo } from '../../src/modules/vehiculos/clasificar.js';
import { CATALOGO_INICIAL } from '../../src/modules/vehiculos/catalogo-inicial.js';

const filas = CATALOGO_INICIAL.map(([marca, modelo, tipo]) => ({
  marca,
  modelo,
  tipo,
  marcaNormalizada: normalizarMarca(marca),
  modeloNormalizado: normalizar(modelo),
}));

const tipo = (marca, modelo) => buscarEnCatalogo(filas, marca, modelo)?.tipo ?? null;

describe('catálogo de vehículos', () => {
  test('trae al menos 40 modelos y sin repetidos', () => {
    assert.ok(CATALOGO_INICIAL.length >= 40);
    const claves = filas.map((f) => `${f.marcaNormalizada}|${f.modeloNormalizado}`);
    assert.equal(new Set(claves).size, claves.length);
  });

  test('los ejemplos del pedido quedan bien clasificados', () => {
    assert.equal(tipo('Renault', 'Duster'), 'SUV');
    assert.equal(tipo('Renault', 'Sandero'), 'AUTO');
    assert.equal(tipo('Toyota', 'Hilux'), 'CAMIONETA');
    assert.equal(tipo('Toyota', 'Corolla'), 'AUTO');
    assert.equal(tipo('Chevrolet', 'Tracker'), 'SUV');
    assert.equal(tipo('Volkswagen', 'Amarok'), 'CAMIONETA');
    assert.equal(tipo('Fiat', 'Cronos'), 'AUTO');
    assert.equal(tipo('Honda', 'CR-V'), 'SUV');
  });

  test('no importa cómo se escriba: mayúsculas, tildes, guiones, espacios, alias de marca', () => {
    assert.equal(tipo('VW', 'T-Cross'), 'SUV');
    assert.equal(tipo('volkswagen', 'tcross'), 'SUV');
    assert.equal(tipo('CITROEN', 'c4 cactus'), 'SUV');
    assert.equal(tipo('Chevy', 'onix'), 'AUTO');
    assert.equal(tipo('Honda', 'crv'), 'SUV');
  });

  test('la versión escrita detrás del modelo no molesta', () => {
    assert.equal(tipo('Toyota', 'Hilux SRV 4x4'), 'CAMIONETA');
    assert.equal(tipo('Peugeot', '208 GT'), 'AUTO');
  });

  test('gana el modelo más específico', () => {
    assert.equal(tipo('Toyota', 'Corolla Cross XEi'), 'SUV');
    assert.equal(tipo('Toyota', 'Corolla SE-G'), 'AUTO');
    assert.equal(tipo('Peugeot', '2008'), 'SUV');
    assert.equal(tipo('Peugeot', '208'), 'AUTO');
  });

  test('Mercedes-Benz y BMW: la línea y la denominación con número', () => {
    assert.equal(tipo('Mercedes-Benz', 'Clase C'), 'AUTO');
    assert.equal(tipo('Mercedes', 'C200 Avantgarde'), 'AUTO');
    assert.equal(tipo('Mercedez Benz', 'GLA 200'), 'SUV');
    assert.equal(tipo('Mercedes-Benz', 'GLC Coupé'), 'SUV');
    assert.equal(tipo('Mercedes-Benz', 'Sprinter 415'), 'UTILITARIO');
    assert.equal(tipo('Mercedes-Benz', 'Clase X'), 'CAMIONETA');
    assert.equal(tipo('BMW', '320i'), 'AUTO');
    assert.equal(tipo('BMW', 'Serie 3'), 'AUTO');
    assert.equal(tipo('bmw', 'X1 sDrive20i'), 'SUV');
    assert.equal(tipo('BMW', 'X5 M'), 'SUV');
    assert.equal(tipo('BMW', 'R 1250 GS'), 'MOTO');
  });

  test('lo que no está en el catálogo no se adivina', () => {
    assert.equal(tipo('Fiat', 'Modelo Inventado'), null);
    assert.equal(tipo('Marca Rara', 'Corolla'), null);
    assert.equal(tipo('', 'Corolla'), null);
    assert.equal(tipo('Toyota', ''), null);
  });
});
