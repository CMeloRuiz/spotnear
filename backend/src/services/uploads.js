/**
 * Subida de imágenes: fotos de los estacionamientos, a Cloudinary.
 *
 * POR QUÉ NO AL DISCO
 * Antes se guardaban en `backend/uploads/` y se servían desde el mismo
 * Express. En Render eso no sirve: el disco de un Web Service es efímero y se
 * borra en cada deploy y cada vez que el plan gratuito duerme el servicio por
 * inactividad. Las fotos desaparecían y en la base quedaban URLs rotas. Ahora
 * el archivo se sube a Cloudinary y en la base se guarda solo la URL pública
 * (https://res.cloudinary.com/...), que no depende del backend.
 *
 * El archivo pasa por memoria (multer.memoryStorage) y de ahí directo a
 * Cloudinary: el backend no escribe nada en su disco en ningún momento.
 *
 * ⚠️ Este endpoint lo usa el formulario público de alta, o sea que acepta
 * archivos de gente sin cuenta. Por eso:
 *   · el nombre del archivo lo inventa el servidor (nunca se usa el del
 *     cliente, que puede traer `../` o una extensión ejecutable);
 *   · solo se aceptan cinco tipos de imagen conocidos, y Cloudinary vuelve a
 *     verificar que sea una imagen (`resource_type: 'image'`);
 *   · hay tope de peso y de cantidad.
 *
 * Sin las tres credenciales de Cloudinary no se rompe nada: la subida responde
 * 503 con un mensaje claro ("la subida de fotos no está configurada") que el
 * formulario muestra tal cual, y el resto del alta sigue funcionando sin fotos.
 */
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import env from '../config/env.js';
import errores, { AppError } from '../utils/errors.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));

/**
 * backend/uploads: solo LECTURA, para las fotos que se subieron en desarrollo
 * antes del cambio a Cloudinary. No se escribe más ahí.
 */
export const DIR_UPLOADS = path.resolve(aqui, '../../uploads');

/** Carpeta de Cloudinary donde quedan las fotos. */
export const CARPETA_CLOUDINARY = 'spotnear/parkings';

export const MAX_FOTOS = 8;
export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Tipos aceptados. */
const TIPOS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/heic': '.heic',
};

export const TIPOS_ACEPTADOS = Object.keys(TIPOS);

/** ¿Están las credenciales? Lo consulta también GET /config. */
export function almacenamientoConfigurado() {
  return env.cloudinaryHabilitado;
}

let configurado = false;
function cliente() {
  if (!configurado) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configurado = true;
  }
  return cloudinary;
}

function errorSinAlmacenamiento() {
  return new AppError(
    'La subida de fotos todavía no está configurada. Podés mandar la solicitud sin fotos y agregarlas más adelante.',
    503,
    'ALMACENAMIENTO_NO_CONFIGURADO',
    { detalle: 'Faltan CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y/o CLOUDINARY_API_SECRET en el backend.' },
  );
}

/**
 * Middleware de multer para el campo `fotos`. En memoria: el archivo nunca
 * toca el disco del servidor. Si no hay Cloudinary, corta ANTES de leer el
 * cuerpo, así nadie espera a que suban 40 MB para enterarse.
 */
const multerFotos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: MAX_FOTOS },
  fileFilter: (req, file, cb) => {
    if (!TIPOS[file.mimetype]) {
      cb(errores.datosInvalidos(undefined, 'Solo se aceptan imágenes JPG, PNG, WebP, AVIF o HEIC.'));
      return;
    }
    cb(null, true);
  },
}).array('fotos', MAX_FOTOS);

export function subirFotosParking(req, res, next) {
  if (!almacenamientoConfigurado()) {
    next(errorSinAlmacenamiento());
    return;
  }
  multerFotos(req, res, next);
}

/** Sube un archivo en memoria y devuelve la URL https permanente. */
function subirUna(archivo) {
  return new Promise((resolve, reject) => {
    const subida = cliente().uploader.upload_stream(
      {
        folder: CARPETA_CLOUDINARY,
        // Nombre inventado por el servidor: el del cliente no se usa nunca.
        public_id: `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
        resource_type: 'image',
        overwrite: false,
        // Las fotos se muestran como miniatura y en la ficha: con 1600 px de
        // lado alcanza y sobra, y no se guardan originales de 12 MP.
        transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto' }],
      },
      (error, resultado) => (error ? reject(error) : resolve(resultado)),
    );
    subida.end(archivo.buffer);
  });
}

/**
 * Sube todas las fotos del pedido a Cloudinary.
 * @param {Express.Multer.File[]} archivos
 * @returns {Promise<{ url: string, nombre: string, bytes: number }[]>}
 */
export async function guardarFotos(archivos) {
  if (!almacenamientoConfigurado()) throw errorSinAlmacenamiento();
  try {
    const subidas = await Promise.all(archivos.map(subirUna));
    return subidas.map((s, i) => ({
      url: s.secure_url,
      nombre: archivos[i].originalname,
      bytes: s.bytes ?? archivos[i].size,
    }));
  } catch (error) {
    // Credenciales mal copiadas, cuenta suspendida, Cloudinary caído: el
    // detalle va al log; al cliente, un mensaje que pueda entender.
    console.error('[cloudinary] no se pudo subir la foto:', error?.message ?? error);
    const credenciales = error?.http_code === 401 || /api_key|signature|cloud_name/i.test(error?.message ?? '');
    throw new AppError(
      credenciales
        ? 'La subida de fotos no está bien configurada. Avisanos y mientras tanto mandá la solicitud sin fotos.'
        : 'No pudimos guardar las fotos. Probá de nuevo en un momento.',
      credenciales ? 503 : 502,
      credenciales ? 'ALMACENAMIENTO_MAL_CONFIGURADO' : 'ALMACENAMIENTO_NO_DISPONIBLE',
    );
  }
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

export default { subirFotosParking, guardarFotos, traducirErrorDeSubida, MAX_FOTOS, MAX_BYTES };
