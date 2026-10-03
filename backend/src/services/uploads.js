/**
 * Subida de imágenes a disco local.
 *
 * Guarda en `backend/uploads/parkings/` y devuelve URLs públicas servidas por
 * el mismo Express (`/uploads/...`). Es el almacenamiento más simple que
 * funciona; cuando haga falta S3 o Cloudinary se cambia solo este archivo,
 * porque el resto del código únicamente ve la URL que devuelve.
 *
 * ⚠️ Este endpoint lo usa el formulario público de alta, o sea que acepta
 * archivos de gente sin cuenta. Por eso:
 *   · el nombre del archivo lo inventa el servidor (nunca se usa el del
 *     cliente, que puede traer `../` o una extensión ejecutable);
 *   · solo se aceptan cinco tipos de imagen conocidos;
 *   · hay tope de peso y de cantidad;
 *   · se sirven con Content-Disposition y sin permitir sniffing, así un archivo
 *     disfrazado de imagen no se ejecuta en el navegador de nadie.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import env from '../config/env.js';
import errores from '../utils/errors.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));

/** backend/uploads */
export const DIR_UPLOADS = path.resolve(aqui, '../../uploads');
export const DIR_PARKINGS = path.join(DIR_UPLOADS, 'parkings');

export const MAX_FOTOS = 8;
export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Tipos aceptados y la extensión con la que se guarda cada uno. */
const TIPOS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/heic': '.heic',
};

export const TIPOS_ACEPTADOS = Object.keys(TIPOS);

fs.mkdirSync(DIR_PARKINGS, { recursive: true });

const almacenamiento = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DIR_PARKINGS),
  filename: (req, file, cb) => {
    // Nombre inventado por el servidor: el del cliente no se usa nunca.
    const nombre = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${TIPOS[file.mimetype]}`;
    cb(null, nombre);
  },
});

/** Middleware de multer para el campo `fotos`. */
export const subirFotosParking = multer({
  storage: almacenamiento,
  limits: { fileSize: MAX_BYTES, files: MAX_FOTOS },
  fileFilter: (req, file, cb) => {
    if (!TIPOS[file.mimetype]) {
      cb(errores.datosInvalidos(undefined, 'Solo se aceptan imágenes JPG, PNG, WebP, AVIF o HEIC.'));
      return;
    }
    cb(null, true);
  },
}).array('fotos', MAX_FOTOS);

/**
 * URL pública de un archivo ya guardado.
 * Absoluta y no relativa porque la consume el frontend, que corre en otro
 * origen en desarrollo (5173 vs 4000) y podría ser una app móvil mañana.
 */
export function urlPublica(nombreArchivo) {
  return `${env.PUBLIC_API_URL}/uploads/parkings/${nombreArchivo}`;
}

/** Traduce los errores de multer a la envoltura de errores de la API. */
export function traducirErrorDeSubida(error) {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return errores.datosInvalidos(undefined, 'Cada foto tiene que pesar menos de 5 MB.');
  }
  if (error?.code === 'LIMIT_FILE_COUNT' || error?.code === 'LIMIT_UNEXPECTED_FILE') {
    return errores.datosInvalidos(undefined, `Podés subir hasta ${MAX_FOTOS} fotos.`);
  }
  return error;
}

export default { subirFotosParking, urlPublica, traducirErrorDeSubida, MAX_FOTOS, MAX_BYTES };
