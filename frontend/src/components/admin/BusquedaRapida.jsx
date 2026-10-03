/**
 * Búsqueda rápida por código o patente.
 *
 * Es la herramienta principal del playero: el cliente llega, muestra el código
 * en el celular y el playero lo tipea acá para hacerle el check-in. Por eso vive
 * en la barra superior del panel, siempre a mano, y se puede abrir con "/".
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icono } from '../ui/Iconos.jsx';
import { EstadoReserva } from '../ui/Varios.jsx';
import { admin } from '../../services/spotnear.service.js';
import { useDebounce, useCerrarAlClickAfuera } from '../../hooks/index.js';
import { patente as fmtPatente, fechaRelativa } from '../../utils/formato.js';
import textos from '../../i18n/textos.js';
import './BusquedaRapida.css';

export function BusquedaRapida({ className = '' }) {
  const navegar = useNavigate();
  const inputRef = useRef(null);

  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);

  const consulta = useDebounce(texto, 300);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setActivo(-1);
  }, []);

  const contenedorRef = useCerrarAlClickAfuera(cerrar, abierto);

  /* Atajo de teclado: "/" enfoca el buscador desde cualquier pantalla. */
  useEffect(() => {
    const alTeclado = (e) => {
      const enCampo = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
      if (e.key === '/' && !enCampo) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', alTeclado);
    return () => document.removeEventListener('keydown', alTeclado);
  }, []);

  /* Búsqueda */
  useEffect(() => {
    const q = consulta.trim();
    if (q.length < 3) {
      setResultados([]);
      setBuscando(false);
      return undefined;
    }

    const controlador = new AbortController();
    let vigente = true;
    setBuscando(true);

    admin.reservas
      .buscarRapido(q, { signal: controlador.signal })
      .then((r) => {
        if (vigente) {
          setResultados(r.reservas ?? []);
          setAbierto(true);
        }
      })
      .catch(() => {
        if (vigente) setResultados([]);
      })
      .finally(() => {
        if (vigente) setBuscando(false);
      });

    return () => {
      vigente = false;
      controlador.abort();
    };
  }, [consulta]);

  const abrir = (reserva) => {
    setTexto('');
    setResultados([]);
    cerrar();
    navegar(`/panel/reservas/${reserva.id}`);
  };

  const alTeclado = (e) => {
    if (e.key === 'Escape') {
      cerrar();
      inputRef.current?.blur();
      return;
    }
    if (resultados.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAbierto(true);
      setActivo((i) => (i + 1) % resultados.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((i) => (i <= 0 ? resultados.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activo >= 0) {
      e.preventDefault();
      abrir(resultados[activo]);
    }
  };

  const hayTexto = texto.trim().length >= 3;

  return (
    <div className={`sn-busqueda-rapida ${className}`} ref={contenedorRef}>
      <div className="sn-busqueda-rapida__caja">
        <Icono nombre="lupa" tam={17} />
        <input
          ref={inputRef}
          type="search"
          className="sn-busqueda-rapida__input"
          placeholder={textos.admin.reservas.buscarCorto}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setActivo(-1);
          }}
          onFocus={() => resultados.length > 0 && setAbierto(true)}
          onKeyDown={alTeclado}
          aria-label={textos.admin.reservas.busquedaRapida}
          autoComplete="off"
        />
        {buscando && <span className="sn-spinner sn-busqueda-rapida__spinner" aria-hidden="true" />}
        {!buscando && !texto && <kbd className="sn-busqueda-rapida__atajo">/</kbd>}
      </div>

      {abierto && hayTexto && (
        <div className="sn-busqueda-rapida__panel">
          {resultados.length === 0 && !buscando && (
            <p className="sn-busqueda-rapida__nada">
              No encontramos ninguna reserva con &laquo;{texto}&raquo;.
            </p>
          )}

          {resultados.map((r, i) => (
            <button
              key={r.id}
              type="button"
              className={`sn-busqueda-rapida__item ${activo === i ? 'sn-busqueda-rapida__item--activo' : ''}`}
              onMouseEnter={() => setActivo(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                abrir(r);
              }}
            >
              <span className="sn-busqueda-rapida__codigo">{r.codigo}</span>
              <span className="sn-busqueda-rapida__datos">
                <strong>
                  {r.cliente.nombre} {r.cliente.apellido}
                </strong>
                <small>
                  {fmtPatente(r.vehiculo.patente)} · {fechaRelativa(r.inicio)}
                </small>
              </span>
              <EstadoReserva estado={r.estado} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default BusquedaRapida;
