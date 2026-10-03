/**
 * Cliente HTTP de la API de SpotNear.
 *
 * Toda la comunicación con el backend pasa por acá. El resto de la app no
 * conoce fetch, ni los tokens, ni el formato de los errores: solo llama
 * funciones y recibe datos o un ApiError con un mensaje ya listo para mostrar.
 *
 * Si el access token vence, se renueva solo con el refresh token y se
 * reintenta la llamada una vez, sin que el usuario se entere.
 */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const TIMEOUT_MS = 20_000;

/**
 * Esperas entre reintentos cuando el pedido no llegó al servidor.
 *
 * Suman ~5 s, que es lo que puede tardar en volver un backend reiniciándose o
 * un hosting despertando de dormido. Arranca corto para que una caída de medio
 * segundo se resuelva sin que se note, y se va estirando para no martillar un
 * servidor que todavía está levantando.
 */
const ESPERAS_DE_RED = [300, 700, 1500, 2500];

const CLAVE_ACCESS = 'spotnear.accessToken';
const CLAVE_REFRESH = 'spotnear.refreshToken';
const CLAVE_USUARIO = 'spotnear.usuario';

/* ─────────────────────────── Error de API ─────────────────────────── */

export class ApiError extends Error {
  constructor(mensaje, { status = 0, codigo = 'ERROR', detalle = null } = {}) {
    super(mensaje);
    this.name = 'ApiError';
    this.status = status;
    this.codigo = codigo;
    this.detalle = detalle;
  }

  /** Errores de validación por campo, tal como los manda el backend. */
  get erroresDeCampo() {
    const campos = this.detalle?.campos;
    if (!Array.isArray(campos)) return {};
    return Object.fromEntries(
      campos.map((c) => [c.campo.replace(/^(cliente|vehiculo)\./, ''), c.mensaje]),
    );
  }
}

/* ─────────────────────────── Tokens ─────────────────────────── */

/**
 * El almacenamiento puede fallar (modo incógnito, cookies bloqueadas).
 * Nunca debe tirar abajo la app: si no se puede guardar, se sigue en memoria.
 */
const memoria = {};

const guardar = (clave, valor) => {
  memoria[clave] = valor;
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch {
    /* sin localStorage la sesión dura lo que dura la pestaña */
  }
};

const leer = (clave) => {
  if (memoria[clave] !== undefined) return memoria[clave];
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
};

export const tokens = {
  get access() {
    return leer(CLAVE_ACCESS);
  },
  get refresh() {
    return leer(CLAVE_REFRESH);
  },
  guardar({ accessToken, refreshToken, usuario }) {
    if (accessToken) guardar(CLAVE_ACCESS, accessToken);
    if (refreshToken) guardar(CLAVE_REFRESH, refreshToken);
    if (usuario) guardar(CLAVE_USUARIO, JSON.stringify(usuario));
  },
  get usuario() {
    const crudo = leer(CLAVE_USUARIO);
    if (!crudo) return null;
    try {
      return JSON.parse(crudo);
    } catch {
      return null;
    }
  },
  limpiar() {
    guardar(CLAVE_ACCESS, null);
    guardar(CLAVE_REFRESH, null);
    guardar(CLAVE_USUARIO, null);
  },
};

/* ─────────────────────── Renovación de sesión ─────────────────────── */

/** Promesa compartida: si 3 llamadas fallan a la vez, se renueva UNA sola vez. */
let refrescoEnCurso = null;

/** Se avisa a la app (AuthContext) cuando la sesión se cae del todo. */
const suscriptoresSesion = new Set();

export function alPerderSesion(fn) {
  suscriptoresSesion.add(fn);
  return () => suscriptoresSesion.delete(fn);
}

function notificarSesionPerdida() {
  tokens.limpiar();
  for (const fn of suscriptoresSesion) {
    try {
      fn();
    } catch {
      /* que un suscriptor falle no debe romper a los demás */
    }
  }
}

async function renovarSesion() {
  const refreshToken = tokens.refresh;
  if (!refreshToken) return null;

  if (!refrescoEnCurso) {
    refrescoEnCurso = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return null;
        const datos = await res.json();
        tokens.guardar(datos);
        return datos.accessToken;
      } catch {
        return null;
      } finally {
        // Se libera en el próximo tick para que las llamadas en cola
        // alcancen a engancharse a esta misma promesa.
        setTimeout(() => {
          refrescoEnCurso = null;
        }, 0);
      }
    })();
  }

  return refrescoEnCurso;
}

/* ─────────────────────────── Petición ─────────────────────────── */

function armarQuery(params) {
  if (!params) return '';
  const qs = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === null || valor === '') continue;
    if (Array.isArray(valor)) {
      for (const v of valor) if (v !== undefined && v !== null && v !== '') qs.append(clave, v);
    } else if (valor instanceof Date) {
      qs.append(clave, valor.toISOString());
    } else {
      qs.append(clave, String(valor));
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/**
 * @param {string} ruta      Ruta relativa, ej: '/parkings'
 * @param {object} opciones
 * @param {string} [opciones.method='GET']
 * @param {object} [opciones.body]
 * @param {object} [opciones.params]   Querystring
 * @param {boolean}[opciones.auth]     Manda el access token
 * @param {AbortSignal} [opciones.signal]
 * @param {boolean}[opciones.crudo]    Devuelve la Response sin parsear (CSV, SVG)
 */
export async function pedir(ruta, opciones = {}) {
  const {
    method = 'GET',
    body,
    params,
    auth = false,
    signal,
    crudo = false,
    timeout = TIMEOUT_MS,
    /**
     * Reintentos ante una falla de RED (no de servidor).
     *
     * `TypeError: Failed to fetch` significa que el navegador nunca recibió
     * respuesta: el pedido no llegó a procesarse. Pasa cuando el servidor se
     * está reiniciando o el hosting despertando.
     *
     * El presupuesto total (ver ESPERAS_DE_RED) tiene que ser MAYOR que la
     * ventana real de caída, o el reintento se agota justo antes de que el
     * servidor vuelva y el usuario igual ve el error. Un reinicio de
     * `node --watch` medido contra esta base tarda ~1,7 s, así que 1,2 s de
     * reintentos no alcanzaban.
     *
     * No se reintenta un timeout: ahí el pedido pudo haberse procesado.
     * Para los POST que crean algo, el reintento va acompañado de una clave de
     * idempotencia, así el servidor no crea dos.
     */
    reintentosDeRed = ESPERAS_DE_RED.length,
    _reintento = false,
    _intentoRed = 0,
  } = opciones;

  // Subida de archivos: el body va tal cual y el navegador arma el
  // Content-Type con su boundary. Si lo escribiéramos nosotros, el servidor no
  // podría parsear el multipart.
  const esFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const url = `${BASE}${ruta}${armarQuery(params)}`;

  const headers = { Accept: 'application/json' };
  if (body !== undefined && !esFormData) headers['Content-Type'] = 'application/json';
  if (auth && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;

  // Timeout propio, combinado con el signal que venga de afuera.
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), timeout);
  const cancelarExterno = () => controlador.abort();
  signal?.addEventListener('abort', cancelarExterno);

  let respuesta;
  try {
    respuesta = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : esFormData ? body : JSON.stringify(body),
      signal: controlador.signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error; // cancelación pedida por la app: se propaga
    if (error.name === 'AbortError') {
      throw new ApiError('La consulta tardó demasiado. Probá de nuevo.', { codigo: 'TIMEOUT' });
    }

    // Si el navegador sabe que no hay red, reintentar no sirve: es el caso en
    // el que el mensaje de "revisá tu conexión" sí corresponde, y dicho ya.
    const sinRed = typeof navigator !== 'undefined' && navigator.onLine === false;

    // Falla de red con conexión presente: el pedido no llegó porque el servidor
    // no estaba. Se reintenta hasta agotar el presupuesto.
    if (!sinRed && _intentoRed < reintentosDeRed) {
      clearTimeout(temporizador);
      signal?.removeEventListener('abort', cancelarExterno);
      await new Promise((r) => setTimeout(r, ESPERAS_DE_RED[_intentoRed]));
      return pedir(ruta, { ...opciones, _intentoRed: _intentoRed + 1 });
    }

    throw new ApiError(
      sinRed
        ? 'Parece que te quedaste sin conexión. Revisá tu internet y probá de nuevo.'
        : 'No pudimos conectarnos con el servidor de SpotNear. Volvé a intentar en unos segundos.',
      { codigo: 'SIN_CONEXION' },
    );
  } finally {
    clearTimeout(temporizador);
    signal?.removeEventListener('abort', cancelarExterno);
  }

  // Token vencido: se renueva y se reintenta una sola vez.
  if (respuesta.status === 401 && auth && !_reintento) {
    const nuevo = await renovarSesion();
    if (nuevo) return pedir(ruta, { ...opciones, _reintento: true });
    notificarSesionPerdida();
  }

  if (crudo) {
    if (!respuesta.ok) throw await construirError(respuesta);
    return respuesta;
  }

  if (respuesta.status === 204) return null;

  const texto = await respuesta.text();
  let datos = null;
  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = texto;
    }
  }

  if (!respuesta.ok) {
    throw new ApiError(
      datos?.error?.mensaje ?? 'Algo salió mal. Intentá de nuevo en unos minutos.',
      {
        status: respuesta.status,
        codigo: datos?.error?.codigo ?? 'ERROR',
        detalle: datos?.error?.detalle ?? null,
      },
    );
  }

  return datos;
}

async function construirError(respuesta) {
  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    /* la respuesta puede no ser JSON */
  }
  return new ApiError(datos?.error?.mensaje ?? 'Algo salió mal.', {
    status: respuesta.status,
    codigo: datos?.error?.codigo ?? 'ERROR',
    detalle: datos?.error?.detalle ?? null,
  });
}

/* ─────────────────────────── Atajos ─────────────────────────── */

export const api = {
  get: (ruta, opciones) => pedir(ruta, { ...opciones, method: 'GET' }),
  post: (ruta, body, opciones) => pedir(ruta, { ...opciones, method: 'POST', body }),
  patch: (ruta, body, opciones) => pedir(ruta, { ...opciones, method: 'PATCH', body }),
  delete: (ruta, opciones) => pedir(ruta, { ...opciones, method: 'DELETE' }),
};

/** Descarga un archivo (CSV) respetando el nombre que manda el servidor. */
export async function descargar(ruta, { params, nombrePorDefecto = 'spotnear.csv' } = {}) {
  const respuesta = await pedir(ruta, { params, auth: true, crudo: true });

  const disposicion = respuesta.headers.get('Content-Disposition') ?? '';
  const match = disposicion.match(/filename="?([^";]+)"?/i);
  const nombre = match ? match[1] : nombrePorDefecto;

  const blob = await respuesta.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Se libera en el próximo tick: si se revoca al instante, Safari cancela la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default api;
