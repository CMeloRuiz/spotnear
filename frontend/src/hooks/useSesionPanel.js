/**
 * Cuidado de la sesión del panel administrativo.
 *
 * Dos cosas que en el sitio público no hacen falta pero acá sí, porque el panel
 * se deja abierto en la compu del estacionamiento, a la vista de cualquiera:
 *
 *  1. CIERRE POR INACTIVIDAD. Sin clics, teclas, scroll ni movimiento del mouse
 *     durante 15 minutos, la sesión se cierra sola. Solo cuenta la interacción
 *     humana: los pedidos automáticos (el contador de Reservas, el de
 *     Solicitudes, la renovación del access token) NO mantienen viva la sesión.
 *
 *  2. SINCRONIZACIÓN ENTRE PESTAÑAS. Si el playero cierra sesión en una pestaña,
 *     las demás tienen que cerrarse también. Se avisa por BroadcastChannel y,
 *     de yapa, por una clave de localStorage: el evento `storage` llega a
 *     navegadores viejos y además cubre el caso de otra ventana del mismo perfil.
 *
 * POR QUÉ LA ÚLTIMA ACTIVIDAD SE GUARDA Y SE MIDE CON EL RELOJ
 *
 * La primera versión contaba los 15 minutos con un `setTimeout` en memoria. En
 * localhost, mirando la pestaña, andaba; en el sitio publicado, la sesión
 * quedaba abierta para siempre, porque en el uso real el temporizador se
 * pierde:
 *
 *  · el navegador congela o descarta las pestañas en segundo plano (ahorro de
 *    energía/memoria): un temporizador congelado no dispara;
 *  · la compu se suspende con el panel abierto;
 *  · al volver, la pestaña se recarga y arranca una cuenta NUEVA de 15 minutos
 *    con los tokens que siguen en localStorage.
 *
 * Ahora la hora de la última interacción se guarda en localStorage y se
 * compara contra `Date.now()`: cada pocos segundos, al volver a la pestaña y al
 * cargar la app. Si pasaron 15 minutos —con la pestaña congelada, la compu
 * dormida o lo que sea—, la sesión se cierra apenas el código vuelve a correr,
 * antes de mostrar nada. Y como la marca es compartida, usar el panel en una
 * pestaña cuenta como actividad para todas.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** Minutos sin interactuar antes de cerrar la sesión. */
export const MINUTOS_INACTIVIDAD = 15;

/** Cuánto antes del cierre se avisa al usuario. */
export const MINUTOS_AVISO = 1;

/**
 * Modo de prueba: con `localStorage.setItem('spotnear.inactividadMinutos', '2')`
 * la sesión se cierra a los 2 minutos, para verificarlo en producción sin esperar
 * 15. Solo puede ACORTAR el tiempo (1 a 15): nadie lo usa para quedarse
 * conectado más de lo debido. Ver README.
 */
const CLAVE_MINUTOS_PRUEBA = 'spotnear.inactividadMinutos';

function msInactividad() {
  try {
    const prueba = Number(localStorage.getItem(CLAVE_MINUTOS_PRUEBA));
    if (Number.isFinite(prueba) && prueba >= 1 && prueba < MINUTOS_INACTIVIDAD) return prueba * 60_000;
  } catch {
    /* sin storage: el tiempo normal */
  }
  return MINUTOS_INACTIVIDAD * 60_000;
}

/** El aviso sale un minuto antes, o a la mitad si el tiempo de prueba es corto. */
function msAviso() {
  return Math.min(MINUTOS_AVISO * 60_000, msInactividad() / 2);
}

/** Cada cuánto se revisa el reloj. Corto: el cierre llega a lo sumo así de tarde. */
const MS_CHEQUEO = 5_000;

/**
 * Cada cuánto, como mucho, se escribe la marca de actividad. El mouse dispara
 * decenas de eventos por segundo; escribir en localStorage en cada uno no suma
 * nada y despierta a las otras pestañas con eventos `storage` de más.
 */
const MS_ENTRE_ESCRITURAS = 2_000;

const CANAL = 'spotnear-sesion';
const CLAVE_LOGOUT = 'spotnear_logout';
export const CLAVE_ULTIMA_ACTIVIDAD = 'spotnear.ultimaActividad';

/**
 * Eventos que cuentan como "el usuario está acá". Solo interacción humana.
 * `visibilitychange` y `focus` no están a propósito: volver a la pestaña no es
 * interactuar (al revés: es el momento de revisar si ya venció).
 * Se escuchan en fase de captura sobre `document`: el scroll del panel ocurre
 * dentro del contenedor de contenido y `scroll` no burbujea hasta `window`.
 */
const EVENTOS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];

/* ─────────────── Marca de última actividad (compartida) ─────────────── */

let ultimaEnMemoria = 0;

/**
 * La marca guardada manda: es la que comparten todas las pestañas. La copia en
 * memoria es solo el respaldo para cuando localStorage no está disponible.
 */
function leerUltimaActividad() {
  try {
    const guardada = Number(localStorage.getItem(CLAVE_ULTIMA_ACTIVIDAD));
    return Number.isFinite(guardada) && guardada > 0 ? guardada : 0;
  } catch {
    return ultimaEnMemoria;
  }
}

/** Registra que hubo interacción ahora. Lo llama también el login. */
export function registrarActividad(ahora = Date.now()) {
  ultimaEnMemoria = ahora;
  try {
    localStorage.setItem(CLAVE_ULTIMA_ACTIVIDAD, String(ahora));
  } catch {
    /* modo privado: la marca vive solo en esta pestaña */
  }
}

/** Se borra al cerrar sesión: la próxima sesión arranca con su propia marca. */
export function olvidarActividad() {
  ultimaEnMemoria = 0;
  try {
    localStorage.removeItem(CLAVE_ULTIMA_ACTIVIDAD);
  } catch {
    /* nada que borrar */
  }
}

/**
 * ¿La sesión guardada ya venció por inactividad? Lo consulta AuthContext al
 * cargar la app, ANTES de mostrar el panel: una pestaña que se recarga después
 * de una hora no puede volver a entrar sola. Sin marca (sesiones de antes de
 * este cambio) no se considera vencida: se le arranca la cuenta desde ahora.
 */
export function sesionVencidaPorInactividad(ahora = Date.now()) {
  const ultima = leerUltimaActividad();
  return ultima > 0 && ahora - ultima >= msInactividad();
}

const CLAVE_MOTIVO_AL_CARGAR = 'spotnear.motivoCierre';

/**
 * Cuando la sesión vence ANTES de que cargue el panel (recarga, navegador
 * reabierto), no hay redirección con estado que lleve el motivo hasta el
 * login: se deja anotado acá, por pestaña, y el login lo lee una vez.
 */
export function anotarCierreAlCargar(motivo) {
  try {
    sessionStorage.setItem(CLAVE_MOTIVO_AL_CARGAR, motivo);
  } catch {
    /* sin sessionStorage el login no muestra el motivo, nada más */
  }
}

/** Lo lee el login. Sin efectos: se puede llamar más de una vez por render. */
export function leerCierreAlCargar() {
  try {
    return sessionStorage.getItem(CLAVE_MOTIVO_AL_CARGAR);
  } catch {
    return null;
  }
}

/** Se borra una vez mostrado, para que no reaparezca en el próximo ingreso. */
export function olvidarCierreAlCargar() {
  try {
    sessionStorage.removeItem(CLAVE_MOTIVO_AL_CARGAR);
  } catch {
    /* nada que borrar */
  }
}

/** Avisa a las otras pestañas que esta cerró sesión. */
export function avisarCierreDeSesion() {
  try {
    const canal = new BroadcastChannel(CANAL);
    canal.postMessage({ tipo: 'logout', en: Date.now() });
    canal.close();
  } catch {
    /* sin BroadcastChannel queda el respaldo de localStorage */
  }
  try {
    localStorage.setItem(CLAVE_LOGOUT, String(Date.now()));
  } catch {
    /* modo privado o storage bloqueado: se pierde la sincronización, nada más */
  }
}

/**
 * @param {object} opciones
 * @param {boolean} opciones.activo        Solo corre con sesión abierta.
 * @param {(motivo: 'inactividad'|'otraPestana') => void} opciones.alCerrar
 * @returns {{ avisando: boolean, segundosRestantes: number, seguirConectado: () => void }}
 */
export function useSesionPanel({ activo, alCerrar }) {
  const [avisando, setAvisando] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(0);

  // El callback en un ref: así el intervalo no se reinicia en cada render del
  // panel (y un re-render nunca "renueva" la sesión por accidente).
  const alCerrarRef = useRef(alCerrar);
  useEffect(() => {
    alCerrarRef.current = alCerrar;
  });

  // Mientras el aviso está en pantalla, moverse no lo cancela: hay que apretar
  // el botón. Si no, cualquier roce del mouse lo haría desaparecer sin que el
  // usuario se entere de que estuvo por perder la sesión.
  const avisandoRef = useRef(false);
  const cerradaRef = useRef(false);

  /** Compara la última actividad con el reloj y decide. */
  const revisar = useCallback(() => {
    if (cerradaRef.current) return;
    const restante = msInactividad() - (Date.now() - leerUltimaActividad());

    if (restante <= 0) {
      cerradaRef.current = true;
      avisandoRef.current = false;
      setAvisando(false);
      alCerrarRef.current('inactividad');
      return;
    }
    if (restante <= msAviso()) {
      avisandoRef.current = true;
      setAvisando(true);
      setSegundosRestantes(Math.ceil(restante / 1000));
      return;
    }
    if (avisandoRef.current) {
      // Otra pestaña registró actividad mientras esta avisaba.
      avisandoRef.current = false;
      setAvisando(false);
    }
  }, []);

  /** El botón "Sigo acá" del aviso. */
  const seguirConectado = useCallback(() => {
    registrarActividad();
    avisandoRef.current = false;
    setAvisando(false);
  }, []);

  /* ── Inactividad ── */
  useEffect(() => {
    if (!activo) {
      avisandoRef.current = false;
      setAvisando(false);
      return undefined;
    }
    cerradaRef.current = false;

    // Primera vez con esta sesión abierta (o sesión de antes de este cambio):
    // la cuenta arranca ahora. Si ya hay marca, se respeta —una recarga no
    // regala 15 minutos nuevos—.
    if (leerUltimaActividad() === 0) registrarActividad();
    revisar();

    let ultimaEscritura = 0;
    const alInteractuar = () => {
      if (avisandoRef.current || cerradaRef.current) return;
      const ahora = Date.now();
      if (ahora - ultimaEscritura < MS_ENTRE_ESCRITURAS) return;
      ultimaEscritura = ahora;
      registrarActividad(ahora);
    };

    // Al volver a la pestaña (o de la suspensión) se revisa en el acto, sin
    // esperar al próximo tic del intervalo.
    const alVolver = () => {
      if (document.visibilityState === 'visible') revisar();
    };

    for (const ev of EVENTOS) {
      document.addEventListener(ev, alInteractuar, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', revisar);
    window.addEventListener('pageshow', revisar);
    const intervalo = setInterval(revisar, MS_CHEQUEO);

    return () => {
      for (const ev of EVENTOS) {
        document.removeEventListener(ev, alInteractuar, { capture: true });
      }
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', revisar);
      window.removeEventListener('pageshow', revisar);
      clearInterval(intervalo);
    };
  }, [activo, revisar]);

  /* ── Otras pestañas ── */
  useEffect(() => {
    if (!activo) return undefined;

    let canal = null;
    try {
      canal = new BroadcastChannel(CANAL);
      canal.onmessage = (e) => {
        if (e.data?.tipo === 'logout') alCerrarRef.current('otraPestana');
      };
    } catch {
      /* se cae al respaldo de storage */
    }

    const alStorage = (e) => {
      if (e.key === CLAVE_LOGOUT && e.newValue) alCerrarRef.current('otraPestana');
    };
    window.addEventListener('storage', alStorage);

    return () => {
      canal?.close();
      window.removeEventListener('storage', alStorage);
    };
  }, [activo]);

  return { avisando, segundosRestantes, seguirConectado };
}

export default useSesionPanel;
