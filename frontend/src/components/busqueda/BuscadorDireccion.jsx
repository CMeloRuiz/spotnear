/**
 * Buscador de direcciones con autocompletado.
 *
 * Es un combobox hecho a mano (no un <select>) porque hace falta mezclar
 * resultados de Google Places con la lista local y darle el estilo de la app.
 * Sigue el patrón ARIA de combobox: flechas para moverse, Enter para elegir,
 * Escape para cerrar, y el lector de pantalla anuncia la opción activa.
 */
import { useState, useRef, useCallback, useEffect, useId } from 'react';
import { Icono } from '../ui/Iconos.jsx';
import { useAutocompletado } from './useAutocompletado.js';
import { useCerrarAlClickAfuera } from '../../hooks/index.js';
import textos from '../../i18n/textos.js';
import './BuscadorDireccion.css';

const ICONO_TIPO = { evento: 'evento', barrio: 'mapa', lugar: 'pin' };

/**
 * @param {object} props
 * @param {{ nombre: string, lat: number, lng: number }|null} props.valor
 * @param {(destino: { nombre: string, lat: number, lng: number }|null) => void} props.onChange
 * @param {string} [props.placeholder]
 * @param {boolean} [props.autoFocus]
 * @param {string} [props.error]
 */
export function BuscadorDireccion({
  valor,
  onChange,
  placeholder = textos.busqueda.placeholderDireccion,
  label = textos.busqueda.aDondeVas,
  autoFocus = false,
  error,
  compacto = false,
  className = '',
}) {
  const [texto, setTexto] = useState(valor?.nombre ?? '');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [ubicando, setUbicando] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState(null);

  const inputRef = useRef(null);
  const idLista = useId();
  const idInput = useId();

  const { sugerencias, cargando, fuente, resolver } = useAutocompletado(texto);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setActivo(-1);
  }, []);

  const contenedorRef = useCerrarAlClickAfuera(cerrar, abierto);

  // Si el valor cambia desde afuera (volver atrás, leer la URL), se refleja.
  useEffect(() => {
    if (valor?.nombre && valor.nombre !== texto) setTexto(valor.nombre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor?.nombre]);

  const elegir = useCallback(
    async (sugerencia) => {
      const resuelto = await resolver(sugerencia);
      if (!resuelto) return;

      setTexto(resuelto.nombre);
      onChange({ nombre: resuelto.nombre, lat: resuelto.lat, lng: resuelto.lng });
      cerrar();
      inputRef.current?.blur();
    },
    [resolver, onChange, cerrar],
  );

  const alTeclado = (e) => {
    if (!abierto && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
      setAbierto(true);
      return;
    }
    if (!abierto) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivo((i) => (i + 1) % sugerencias.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((i) => (i <= 0 ? sugerencias.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (activo >= 0 && sugerencias[activo]) {
        e.preventDefault();
        elegir(sugerencias[activo]);
      }
    } else if (e.key === 'Escape') {
      cerrar();
    }
  };

  /** Geolocalización del navegador. */
  const usarMiUbicacion = () => {
    if (!navigator.geolocation) {
      setErrorUbicacion(textos.busqueda.sinUbicacion);
      return;
    }

    setUbicando(true);
    setErrorUbicacion(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const destino = {
          nombre: 'Mi ubicación',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setTexto(destino.nombre);
        onChange(destino);
        setUbicando(false);
        cerrar();
      },
      () => {
        // El usuario puede haber denegado el permiso: no es un error de la app.
        setErrorUbicacion(textos.busqueda.sinUbicacion);
        setUbicando(false);
      },
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 300_000 },
    );
  };

  const limpiar = () => {
    setTexto('');
    onChange(null);
    setErrorUbicacion(null);
    inputRef.current?.focus();
  };

  const mensajeError = error ?? errorUbicacion;

  return (
    <div
      className={`sn-buscador-dir ${compacto ? 'sn-buscador-dir--compacto' : ''} ${className}`}
      ref={contenedorRef}
    >
      {label && !compacto && (
        <label className="sn-buscador-dir__label" htmlFor={idInput}>
          {label}
        </label>
      )}

      <div className={`sn-buscador-dir__caja ${mensajeError ? 'sn-buscador-dir__caja--error' : ''}`}>
        <span className="sn-buscador-dir__lupa" aria-hidden="true">
          <Icono nombre="lupa" tam={compacto ? 17 : 19} />
        </span>

        <input
          ref={inputRef}
          id={idInput}
          type="text"
          className="sn-buscador-dir__input"
          placeholder={placeholder}
          value={texto}
          autoComplete="off"
          autoFocus={autoFocus}
          aria-label={compacto ? label : undefined}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
            setActivo(-1);
            setErrorUbicacion(null);
            // Si borra lo escrito, se descarta el destino elegido.
            if (!e.target.value.trim()) onChange(null);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={alTeclado}
          role="combobox"
          aria-expanded={abierto}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={activo >= 0 ? `${idLista}-${activo}` : undefined}
          aria-invalid={mensajeError ? 'true' : undefined}
        />

        {cargando && <span className="sn-spinner sn-buscador-dir__spinner" aria-hidden="true" />}

        {texto && !cargando && (
          <button
            type="button"
            className="sn-buscador-dir__limpiar"
            onClick={limpiar}
            aria-label="Borrar la dirección"
          >
            <Icono nombre="equis" tam={15} />
          </button>
        )}
      </div>

      {mensajeError && (
        <span className="sn-campo__error" role="alert">
          <Icono nombre="alerta" tam={13} />
          {mensajeError}
        </span>
      )}

      {abierto && (
        <div className="sn-buscador-dir__panel">
          <ul className="sn-buscador-dir__lista" id={idLista} role="listbox" aria-label={textos.busqueda.sugerencias}>
            {sugerencias.length === 0 && (
              <li className="sn-buscador-dir__nada">
                No encontramos ese lugar. Probá con otra dirección o barrio.
              </li>
            )}

            {sugerencias.map((s, i) => (
              <li key={s.id ?? `${s.nombre}-${i}`} role="none">
                <button
                  type="button"
                  id={`${idLista}-${i}`}
                  role="option"
                  aria-selected={activo === i}
                  className={`sn-buscador-dir__item ${activo === i ? 'sn-buscador-dir__item--activo' : ''}`}
                  onMouseEnter={() => setActivo(i)}
                  /* onMouseDown y no onClick: el blur del input cerraría el
                     panel antes de que llegue el clic. */
                  onMouseDown={(e) => {
                    e.preventDefault();
                    elegir(s);
                  }}
                >
                  <span className="sn-buscador-dir__item-icono">
                    <Icono nombre={ICONO_TIPO[s.tipo] ?? 'pin'} tam={17} />
                  </span>
                  <span className="sn-buscador-dir__item-texto">
                    <span className="sn-buscador-dir__item-nombre">{s.nombre}</span>
                    {s.detalle && (
                      <span className="sn-buscador-dir__item-detalle">{s.detalle}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="sn-buscador-dir__pie">
            <button
              type="button"
              className="sn-buscador-dir__ubicacion"
              onMouseDown={(e) => {
                e.preventDefault();
                usarMiUbicacion();
              }}
              disabled={ubicando}
            >
              {ubicando ? (
                <span className="sn-spinner" style={{ width: 15, height: 15 }} aria-hidden="true" />
              ) : (
                <Icono nombre="ubicacion" tam={16} />
              )}
              {ubicando ? textos.busqueda.obteniendoUbicacion : textos.busqueda.ubicacionActual}
            </button>

            {/* Aclaramos de dónde salen las sugerencias cuando no es Google:
                así se entiende por qué la lista es acotada. */}
            {fuente === 'local' && (
              <span className="sn-buscador-dir__fuente">{textos.busqueda.lugaresConocidos}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BuscadorDireccion;
