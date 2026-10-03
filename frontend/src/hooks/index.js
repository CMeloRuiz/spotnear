/**
 * Hooks compartidos.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Carga datos de la API con estados de carga, error y cancelación.
 *
 * Cancela el pedido anterior si las dependencias cambian antes de que termine:
 * sin esto, al tipear rápido en un buscador puede "ganar" una respuesta vieja
 * y pisar a la nueva.
 *
 * @param {(opciones: { signal: AbortSignal }) => Promise<any>} fn
 * @param {Array} deps
 * @param {{ inmediato?: boolean }} [opciones]
 */
export function usePedido(fn, deps = [], { inmediato = true } = {}) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(inmediato);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!inmediato) return undefined;

    const controlador = new AbortController();
    let vigente = true;

    setCargando(true);
    setError(null);

    fnRef
      .current({ signal: controlador.signal })
      .then((resultado) => {
        if (vigente) setDatos(resultado);
      })
      .catch((e) => {
        // Una cancelación no es un error que mostrarle al usuario.
        if (!vigente || controlador.signal.aborted || e?.name === 'AbortError') return;
        setError(e);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
      controlador.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version, inmediato]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  return { datos, cargando, error, recargar, setDatos };
}

/**
 * Retrasa un valor. Para buscadores: evita pegarle a la API en cada tecla.
 */
export function useDebounce(valor, ms = 350) {
  const [retrasado, setRetrasado] = useState(valor);

  useEffect(() => {
    const t = setTimeout(() => setRetrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);

  return retrasado;
}

/**
 * ¿Se cumple esta media query? Se usa para alternar lista/mapa en móvil.
 */
export function useMediaQuery(query) {
  const [coincide, setCoincide] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const alCambiar = (e) => setCoincide(e.matches);
    setCoincide(mql.matches);
    mql.addEventListener('change', alCambiar);
    return () => mql.removeEventListener('change', alCambiar);
  }, [query]);

  return coincide;
}

/** Atajo legible: ¿estamos en pantalla chica? */
export function useEsMovil(ancho = 900) {
  return useMediaQuery(`(max-width: ${ancho - 1}px)`);
}

/**
 * Cierra un panel al hacer clic afuera o apretar Escape.
 * @param {() => void} alCerrar
 * @param {boolean} activo
 */
export function useCerrarAlClickAfuera(alCerrar, activo = true) {
  const ref = useRef(null);

  useEffect(() => {
    if (!activo) return undefined;

    const alClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) alCerrar();
    };
    const alTeclado = (e) => {
      if (e.key === 'Escape') alCerrar();
    };

    // mousedown y no click: así cierra antes de que el clic llegue a otro control.
    document.addEventListener('mousedown', alClick);
    document.addEventListener('keydown', alTeclado);
    return () => {
      document.removeEventListener('mousedown', alClick);
      document.removeEventListener('keydown', alTeclado);
    };
  }, [alCerrar, activo]);

  return ref;
}

/**
 * Copia texto al portapapeles y avisa si salió bien.
 * Cae a un textarea temporal cuando el navegador no expone la Clipboard API
 * (pasa en http:// que no sea localhost, típico en una demo en red local).
 */
export function useCopiar() {
  const [copiado, setCopiado] = useState(false);

  const copiar = useCallback(async (texto) => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
        ok = true;
      } else {
        const area = document.createElement('textarea');
        area.value = texto;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        ok = document.execCommand('copy');
        area.remove();
      }
    } catch {
      ok = false;
    }

    if (ok) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    }
    return ok;
  }, []);

  return { copiar, copiado };
}

/** Pone el título de la pestaña. */
export function useTitulo(titulo) {
  useEffect(() => {
    const anterior = document.title;
    document.title = titulo ? `${titulo} · SpotNear` : 'SpotNear · Estacioná fácil, donde vayas';
    return () => {
      document.title = anterior;
    };
  }, [titulo]);
}

/** Bloquea el scroll del body (modales y paneles a pantalla completa). */
export function useBloquearScroll(activo) {
  useEffect(() => {
    if (!activo) return undefined;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [activo]);
}

/**
 * Dispara `recargar` cada tanto y cada vez que la pestaña vuelve al frente.
 *
 * Los contadores del panel (reservas vigentes de cada estacionamiento,
 * solicitudes sin revisar) se cargaban una sola vez al montar la pantalla: si
 * entraba una reserva o una solicitud mientras el panel estaba abierto, el
 * número se quedaba viejo hasta que alguien recargaba a mano.
 *
 * Con polling alcanza: son números chicos, no vale la pena un websocket para
 * esto. El refresco al volver al foco es el que más se nota, porque el caso
 * típico es tener el panel en una pestaña de fondo.
 *
 * @param {() => void} recargar
 * @param {{ cadaMs?: number, activo?: boolean }} [opciones]
 */
export function useRefrescoAutomatico(recargar, { cadaMs = 60_000, activo = true } = {}) {
  const recargarRef = useRef(recargar);
  recargarRef.current = recargar;

  useEffect(() => {
    if (!activo) return undefined;

    // No tiene sentido consultar mientras la pestaña está oculta: gasta
    // pedidos y la respuesta llega igual al volver.
    const refrescarSiVisible = () => {
      if (document.visibilityState === 'visible') recargarRef.current();
    };

    const intervalo = setInterval(refrescarSiVisible, cadaMs);
    document.addEventListener('visibilitychange', refrescarSiVisible);
    window.addEventListener('focus', refrescarSiVisible);

    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', refrescarSiVisible);
      window.removeEventListener('focus', refrescarSiVisible);
    };
  }, [cadaMs, activo]);
}
