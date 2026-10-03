/**
 * Generación de CSV pensada para abrirse bien en Excel en español.
 *
 * Detalles que importan:
 *  · Separador `;` — el Excel en es-AR usa punto y coma, no coma.
 *  · BOM UTF-8 al inicio — sin esto los acentos y las ñ se ven rotos.
 *  · Se escapan comillas y se envuelve todo campo con separador o saltos de línea.
 *  · Se antepone `'` a valores que Excel interpretaría como fórmula (=, +, -, @):
 *    evita la inyección de fórmulas en CSV.
 */

const SEPARADOR = ';';
const BOM = '﻿';

function escaparCampo(valor) {
  if (valor === null || valor === undefined) return '';
  let texto = String(valor);

  // Defensa contra CSV injection
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;

  if (texto.includes('"') || texto.includes(SEPARADOR) || /[\n\r]/.test(texto)) {
    texto = `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

/**
 * @param {Array<{ key: string, label: string, format?: (fila: any) => unknown }>} columnas
 * @param {Array<object>} filas
 * @returns {string}
 */
export function generarCSV(columnas, filas) {
  const cabecera = columnas.map((c) => escaparCampo(c.label)).join(SEPARADOR);
  const cuerpo = filas.map((fila) =>
    columnas
      .map((c) => escaparCampo(c.format ? c.format(fila) : fila[c.key]))
      .join(SEPARADOR),
  );
  return BOM + [cabecera, ...cuerpo].join('\r\n');
}

/** Nombre de archivo seguro: reservas-humboldt-450-2026-09-21.csv */
export function nombreArchivoCSV(base, fecha = new Date()) {
  const iso = fecha.toISOString().slice(0, 10);
  const limpio = String(base)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${limpio}-${iso}.csv`;
}
