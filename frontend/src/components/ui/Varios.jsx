/**
 * Piezas chicas que se repiten por toda la app.
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icono } from './Iconos.jsx';
import textos from '../../i18n/textos.js';
import { calificacion as fmtCalificacion, cantidadCompacta } from '../../utils/formato.js';
import { useBloquearScroll } from '../../hooks/index.js';
import './Varios.css';

/* ─────────────────────────── Badge de estado ─────────────────────────── */

/** @param {{ estado: 'PENDIENTE'|'CONFIRMADA'|'EN_CURSO'|'FINALIZADA'|'CANCELADA'|'NO_SHOW' }} props */
export function EstadoReserva({ estado, className = '' }) {
  return (
    <span className={`sn-badge sn-badge--${estado} ${className}`}>
      {textos.estados[estado] ?? estado}
    </span>
  );
}

/* ─────────────────────────── Calificación ─────────────────────────── */

export function Estrellas({ valor, cantidad, compacto = false, className = '' }) {
  if (valor === null || valor === undefined) {
    return compacto ? null : (
      <span className={`sn-estrellas sn-estrellas--sin ${className}`}>
        {textos.resultados.sinCalificacion}
      </span>
    );
  }

  return (
    <span
      className={`sn-estrellas ${className}`}
      title={`${fmtCalificacion(valor)} de 5${cantidad ? ` · ${cantidad} reseñas` : ''}`}
    >
      <Icono nombre="estrella" tam={14} className="sn-estrellas__icono" />
      <span className="sn-estrellas__valor">{fmtCalificacion(valor)}</span>
      {cantidad > 0 && (
        <span className="sn-estrellas__cantidad">({cantidadCompacta(cantidad)})</span>
      )}
    </span>
  );
}

/* ─────────────────────────── Modal ─────────────────────────── */

/**
 * Diálogo modal accesible: atrapa el foco, cierra con Escape y con clic afuera,
 * y devuelve el foco a donde estaba al cerrarse.
 */
export function Modal({ abierto, alCerrar, titulo, children, pie, ancho = 520 }) {
  const contenedor = useRef(null);
  const focoPrevio = useRef(null);

  /**
   * `alCerrar` casi siempre llega como una arrow inline (`() => setModal(false)`),
   * o sea una función nueva en cada render. Si el efecto de abajo dependiera de
   * ella, se desmontaría y volvería a montar en CADA tecla que el usuario
   * escribe dentro del modal: la limpieza devolvería el foco a lo que estaba
   * antes y el efecto lo volvería a poner en el primer control del diálogo.
   * El resultado era el cursor saltando al botón de cerrar dígito por dígito.
   *
   * Guardándola en un ref, el efecto solo depende de `abierto` y el callback
   * siempre es el último, sin reenganchar nada.
   */
  const alCerrarRef = useRef(alCerrar);
  useEffect(() => {
    alCerrarRef.current = alCerrar;
  });

  useBloquearScroll(abierto);

  useEffect(() => {
    if (!abierto) return undefined;

    focoPrevio.current = document.activeElement;

    const alTeclado = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        alCerrarRef.current();
        return;
      }
      if (e.key !== 'Tab' || !contenedor.current) return;

      // Trampa de foco: el tabulador no se escapa del diálogo.
      const focuseables = contenedor.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focuseables.length === 0) return;

      const primero = focuseables[0];
      const ultimo = focuseables[focuseables.length - 1];

      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', alTeclado, true);

    // Se enfoca el primer control al abrirse, buscando dentro del CUERPO y no
    // del diálogo entero: la X de cerrar vive en la cabecera y, por orden del
    // DOM, era la que devolvía querySelector.
    const t = setTimeout(() => {
      const cuerpo = contenedor.current?.querySelector('.sn-modal__cuerpo');
      const primero = cuerpo?.querySelector(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])',
      );
      primero?.focus();
    }, 40);

    return () => {
      document.removeEventListener('keydown', alTeclado, true);
      clearTimeout(t);
      focoPrevio.current?.focus?.();
    };
  }, [abierto]);

  if (!abierto) return null;

  return createPortal(
    <div
      className="sn-modal-fondo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div
        className="sn-modal"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        ref={contenedor}
        style={{ maxWidth: ancho }}
      >
        <header className="sn-modal__cabecera">
          <h2 className="sn-modal__titulo">{titulo}</h2>
          <button
            type="button"
            className="sn-modal__cerrar"
            onClick={alCerrar}
            aria-label={textos.comunes.cerrar}
          >
            <Icono nombre="equis" tam={18} />
          </button>
        </header>

        <div className="sn-modal__cuerpo">{children}</div>

        {pie && <footer className="sn-modal__pie">{pie}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/* ─────────────────────────── Paginación ─────────────────────────── */

export function Paginacion({ pagina, paginas, onCambiar, total }) {
  if (paginas <= 1) return null;

  return (
    <nav className="sn-paginacion" aria-label="Paginación">
      <button
        type="button"
        className="sn-boton sn-boton--secundario sn-boton--sm"
        onClick={() => onCambiar(pagina - 1)}
        disabled={pagina <= 1}
      >
        <Icono nombre="flechaIzquierda" tam={15} />
        <span className="sn-solo-escritorio">{textos.admin.reservas.anterior}</span>
      </button>

      <span className="sn-paginacion__info">
        {textos.admin.reservas.pagina(pagina, paginas)}
        {total !== undefined && (
          <span className="sn-paginacion__total"> · {textos.admin.reservas.total(total)}</span>
        )}
      </span>

      <button
        type="button"
        className="sn-boton sn-boton--secundario sn-boton--sm"
        onClick={() => onCambiar(pagina + 1)}
        disabled={pagina >= paginas}
      >
        <span className="sn-solo-escritorio">{textos.admin.reservas.siguiente}</span>
        <Icono nombre="flechaDerecha" tam={15} />
      </button>
    </nav>
  );
}

/* ─────────────────────────── Tarjeta de métrica ─────────────────────────── */

export function Metrica({ icono, etiqueta, valor, detalle, tono = 'neutro', className = '' }) {
  return (
    <div className={`sn-metrica sn-metrica--${tono} ${className}`}>
      {icono && (
        <span className="sn-metrica__icono" aria-hidden="true">
          <Icono nombre={icono} tam={20} />
        </span>
      )}
      <div className="sn-metrica__datos">
        <span className="sn-metrica__etiqueta">{etiqueta}</span>
        <span className="sn-metrica__valor">{valor}</span>
        {detalle && <span className="sn-metrica__detalle">{detalle}</span>}
      </div>
    </div>
  );
}

/* ─────────────────────────── Aviso en línea ─────────────────────────── */

export function Aviso({ tipo = 'info', children, className = '' }) {
  const iconos = { info: 'info', ok: 'checkCirculo', aviso: 'alerta', error: 'alerta' };

  return (
    <div className={`sn-aviso sn-aviso--${tipo} ${className}`} role={tipo === 'error' ? 'alert' : undefined}>
      <span className="sn-aviso__icono">
        <Icono nombre={iconos[tipo]} tam={18} />
      </span>
      <div>{children}</div>
    </div>
  );
}

/* ─────────────────────────── Interruptor ─────────────────────────── */

export function Interruptor({ activo, onChange, etiqueta, ayuda, id }) {
  return (
    <label className="sn-interruptor" htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        role="switch"
        checked={activo}
        onChange={(e) => onChange(e.target.checked)}
        className="sn-solo-lectores"
      />
      <span className="sn-interruptor__pista" aria-hidden="true">
        <span className="sn-interruptor__perilla" />
      </span>
      <span className="sn-interruptor__texto">
        {etiqueta}
        {ayuda && <span className="sn-interruptor__ayuda">{ayuda}</span>}
      </span>
    </label>
  );
}

export default Modal;
