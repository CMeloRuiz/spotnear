/**
 * Avisos flotantes (toasts).
 * Se usan para confirmaciones cortas: "Cambios guardados", "Mensaje copiado".
 */
import { createContext, useContext, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import './ToastContext.css';

const ToastContext = createContext(null);

const DURACION = 3800;

export function ToastProvider({ children }) {
  const [avisos, setAvisos] = useState([]);
  const temporizadores = useRef(new Map());

  const cerrar = useCallback((id) => {
    setAvisos((prev) => prev.filter((a) => a.id !== id));
    const t = temporizadores.current.get(id);
    if (t) {
      clearTimeout(t);
      temporizadores.current.delete(id);
    }
  }, []);

  const mostrar = useCallback(
    (mensaje, tipo = 'ok', duracion = DURACION) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setAvisos((prev) => [...prev, { id, mensaje, tipo }]);
      temporizadores.current.set(
        id,
        setTimeout(() => cerrar(id), duracion),
      );
      return id;
    },
    [cerrar],
  );

  // Se limpian los temporizadores pendientes al desmontar.
  useEffect(() => {
    const mapa = temporizadores.current;
    return () => {
      for (const t of mapa.values()) clearTimeout(t);
      mapa.clear();
    };
  }, []);

  const valor = useMemo(
    () => ({
      mostrar,
      ok: (m) => mostrar(m, 'ok'),
      error: (m) => mostrar(m, 'error', 5200),
      info: (m) => mostrar(m, 'info'),
      cerrar,
    }),
    [mostrar, cerrar],
  );

  return (
    <ToastContext.Provider value={valor}>
      {children}
      {/* aria-live para que los lectores de pantalla anuncien los avisos */}
      <div className="sn-toasts" role="status" aria-live="polite" aria-atomic="false">
        {avisos.map((a) => (
          <div key={a.id} className={`sn-toast sn-toast--${a.tipo}`}>
            <span className="sn-toast__icono" aria-hidden="true">
              {a.tipo === 'ok' ? '✓' : a.tipo === 'error' ? '!' : 'i'}
            </span>
            <span className="sn-toast__texto">{a.mensaje}</span>
            <button
              type="button"
              className="sn-toast__cerrar"
              onClick={() => cerrar(a.id)}
              aria-label="Cerrar aviso"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast tiene que usarse dentro de <ToastProvider>.');
  return ctx;
}

export default ToastContext;
