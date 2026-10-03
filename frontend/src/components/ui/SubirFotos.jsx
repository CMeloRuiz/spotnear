/**
 * Carga de fotos: arrastrar y soltar, o elegir desde el dispositivo.
 *
 * Las fotos se suben apenas se eligen, no al mandar el formulario. Así el dueño
 * ve la miniatura al instante y se entera ahí mismo si una pesa de más, en vez
 * de descubrirlo después de completar todo.
 *
 * El componente maneja solo la subida: el estado de qué fotos hay vive en el
 * formulario que lo usa, como una lista de URLs.
 */
import { useId, useRef, useState } from 'react';
import { Icono } from './Iconos.jsx';
import { publico } from '../../services/spotnear.service.js';
import textos from '../../i18n/textos.js';
import './SubirFotos.css';

const t = textos.registro;

export const MAX_FOTOS = 8;
export const MAX_MB = 5;
const MAX_BYTES = MAX_MB * 1024 * 1024;

/** Los mismos que acepta el backend. */
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic'];

/**
 * @param {object} props
 * @param {string[]} props.fotos URLs ya cargadas
 * @param {(fotos: string[]) => void} props.onChange
 * @param {string} [props.error]
 */
export function SubirFotos({ fotos, onChange, error }) {
  const idInput = useId();
  const inputRef = useRef(null);

  const [arrastrando, setArrastrando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [errorLocal, setErrorLocal] = useState(null);

  const lugarRestante = MAX_FOTOS - fotos.length;

  /** Separa lo que se puede subir de lo que hay que rechazar, con su motivo. */
  const revisar = (archivos) => {
    const validos = [];
    const problemas = [];

    for (const a of archivos) {
      if (!TIPOS.includes(a.type)) {
        problemas.push(t.fotosTipoInvalido(a.name));
      } else if (a.size > MAX_BYTES) {
        problemas.push(t.fotosPesada(a.name, MAX_MB));
      } else {
        validos.push(a);
      }
    }

    if (validos.length > lugarRestante) {
      problemas.push(t.fotosDemasiadas(MAX_FOTOS));
      validos.length = Math.max(0, lugarRestante);
    }

    return { validos, problemas };
  };

  const agregar = async (lista) => {
    const archivos = Array.from(lista ?? []);
    if (archivos.length === 0) return;

    const { validos, problemas } = revisar(archivos);
    setErrorLocal(problemas[0] ?? null);
    if (validos.length === 0) return;

    setSubiendo(true);
    try {
      const { fotos: subidas } = await publico.subirFotosParking(validos);
      onChange([...fotos, ...subidas.map((f) => f.url)]);
      // Si algo se rechazó, ese aviso vale más que limpiar el error.
      if (problemas.length === 0) setErrorLocal(null);
    } catch (e) {
      setErrorLocal(e.message ?? t.fotosErrorSubida);
    } finally {
      setSubiendo(false);
      // Se limpia el input para poder volver a elegir el mismo archivo.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const quitar = (url) => {
    onChange(fotos.filter((f) => f !== url));
    setErrorLocal(null);
  };

  const alSoltar = (e) => {
    e.preventDefault();
    setArrastrando(false);
    agregar(e.dataTransfer?.files);
  };

  const mensaje = error ?? errorLocal;
  const lleno = fotos.length >= MAX_FOTOS;

  return (
    <div className="sn-fotos">
      {/* La zona es un label del input: así arrastrar, clickear y el teclado
          (Tab + Enter sobre el input) funcionan sin duplicar controles. */}
      <label
        htmlFor={idInput}
        className={[
          'sn-fotos__zona',
          arrastrando ? 'sn-fotos__zona--arrastrando' : '',
          mensaje ? 'sn-fotos__zona--error' : '',
          lleno ? 'sn-fotos__zona--llena' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onDragOver={(e) => {
          e.preventDefault();
          if (!lleno) setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={alSoltar}
      >
        <input
          ref={inputRef}
          id={idInput}
          type="file"
          accept="image/*"
          multiple
          className="sn-fotos__input"
          disabled={subiendo || lleno}
          onChange={(e) => agregar(e.target.files)}
          aria-describedby={`${idInput}-limites`}
          aria-invalid={mensaje ? 'true' : undefined}
        />

        <span className="sn-fotos__zona-icono" aria-hidden="true">
          <Icono nombre={subiendo ? 'reloj' : 'camara'} tam={26} />
        </span>

        <span className="sn-fotos__zona-titulo">
          {subiendo ? t.fotosSubiendo : lleno ? t.fotosCuenta(fotos.length, MAX_FOTOS) : t.fotosSoltar}
        </span>

        {!subiendo && !lleno && (
          <>
            <span className="sn-fotos__zona-texto">{t.fotosOSeleccionar}</span>
            <span className="sn-fotos__boton">{t.fotosBoton}</span>
          </>
        )}

        <span className="sn-fotos__limites" id={`${idInput}-limites`}>
          {t.fotosLimites(MAX_FOTOS, MAX_MB)}
        </span>
      </label>

      {mensaje && (
        <span className="sn-campo__error" role="alert">
          <Icono nombre="alerta" tam={13} />
          {mensaje}
        </span>
      )}

      {fotos.length > 0 && (
        <>
          <ul className="sn-fotos__grilla">
            {fotos.map((url, i) => (
              <li key={url} className="sn-fotos__item">
                <img src={url} alt={`Foto ${i + 1} del estacionamiento`} loading="lazy" />

                {/* La primera es la que se ve en los resultados: conviene que
                    el dueño lo sepa antes de mandar la solicitud. */}
                {i === 0 && <span className="sn-fotos__portada">{t.fotosPortada}</span>}

                <button
                  type="button"
                  className="sn-fotos__quitar"
                  onClick={() => quitar(url)}
                  aria-label={`${t.fotosQuitar} ${i + 1}`}
                >
                  <Icono nombre="equis" tam={14} />
                </button>
              </li>
            ))}
          </ul>

          <p className="sn-fotos__cuenta">{t.fotosCuenta(fotos.length, MAX_FOTOS)}</p>
        </>
      )}
    </div>
  );
}

export default SubirFotos;
