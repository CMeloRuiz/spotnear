/**
 * Cuidado de la sesión del panel administrativo.
 *
 * Dos cosas que en el sitio público no hacen falta pero acá sí, porque el panel
 * se deja abierto en la compu del estacionamiento, a la vista de cualquiera:
 *
 *  1. CIERRE POR INACTIVIDAD. Sin clics, teclas ni scroll durante 15 minutos,
 *     la sesión se cierra sola. Ojo con el detalle: el cliente HTTP renueva el
 *     access token solo cuando vence, y eso NO cuenta como actividad. Tener la
 *     pestaña abierta no mantiene viva la sesión; mantenerla viva es usarla.
 *
 *  2. SINCRONIZACIÓN ENTRE PESTAÑAS. Si el playero cierra sesión en una pestaña,
 *     las demás tienen que cerrarse también. Se avisa por BroadcastChannel y,
 *     de yapa, por una clave de localStorage: el evento `storage` llega a
 *     navegadores viejos y además cubre el caso de otra ventana del mismo perfil.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** Minutos sin interactuar antes de cerrar la sesión. */
export const MINUTOS_INACTIVIDAD = 15;

/** Cuánto antes del cierre se avisa al usuario. */
export const MINUTOS_AVISO = 1;

const MS_INACTIVIDAD = MINUTOS_INACTIVIDAD * 60_000;
const MS_AVISO = MINUTOS_AVISO * 60_000;

const CANAL = 'spotnear-sesion';
const CLAVE_LOGOUT = 'spotnear_logout';

/**
 * Eventos que cuentan como "el usuario está acá".
 * `visibilitychange` no está a propósito: volver a la pestaña no es interactuar.
 */
const EVENTOS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];

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

  // El callback en un ref: así los temporizadores no se reinician en cada
  // render del panel, que es justo lo que arruinaría la cuenta de inactividad.
  const alCerrarRef = useRef(alCerrar);
  useEffect(() => {
    alCerrarRef.current = alCerrar;
  });

  const temporizadores = useRef({ aviso: null, cierre: null, cuenta: null });

  const limpiarTemporizadores = useCallback(() => {
    const t = temporizadores.current;
    clearTimeout(t.aviso);
    clearTimeout(t.cierre);
    clearInterval(t.cuenta);
    t.aviso = null;
    t.cierre = null;
    t.cuenta = null;
  }, []);

  const reiniciar = useCallback(() => {
    limpiarTemporizadores();
    setAvisando(false);

    temporizadores.current.aviso = setTimeout(() => {
      setAvisando(true);
      setSegundosRestantes(Math.round(MS_AVISO / 1000));

      temporizadores.current.cuenta = setInterval(() => {
        setSegundosRestantes((s) => (s > 0 ? s - 1 : 0));
      }, 1000);
    }, MS_INACTIVIDAD - MS_AVISO);

    temporizadores.current.cierre = setTimeout(() => {
      limpiarTemporizadores();
      setAvisando(false);
      alCerrarRef.current('inactividad');
    }, MS_INACTIVIDAD);
  }, [limpiarTemporizadores]);

  /** El botón "Sigo acá" del aviso. */
  const seguirConectado = useCallback(() => reiniciar(), [reiniciar]);

  /* ── Inactividad ── */
  useEffect(() => {
    if (!activo) {
      limpiarTemporizadores();
      setAvisando(false);
      return undefined;
    }

    reiniciar();

    // Mientras el aviso está en pantalla, moverse no lo cancela: hay que
    // apretar el botón. Si no, cualquier roce del mouse lo haría desaparecer
    // sin que el usuario se entere de que estuvo por perder la sesión.
    const alInteractuar = () => {
      if (!temporizadores.current.cuenta) reiniciar();
    };

    for (const ev of EVENTOS) {
      window.addEventListener(ev, alInteractuar, { passive: true });
    }

    return () => {
      for (const ev of EVENTOS) window.removeEventListener(ev, alInteractuar);
      limpiarTemporizadores();
    };
  }, [activo, reiniciar, limpiarTemporizadores]);

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
