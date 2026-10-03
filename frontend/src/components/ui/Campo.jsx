/**
 * Campos de formulario accesibles.
 *
 * Cada campo arma solo su label, su texto de ayuda y su mensaje de error, y
 * los conecta con aria-describedby / aria-invalid: un lector de pantalla
 * anuncia el error apenas el campo toma el foco.
 */
import { useId } from 'react';
import { Icono } from './Iconos.jsx';
import textos from '../../i18n/textos.js';
import './Campo.css';

function Envoltorio({ id, label, ayuda, error, obligatorio, opcional, children, className = '' }) {
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;

  return (
    <div className={`sn-campo ${className}`}>
      {label && (
        <label className="sn-campo__label" htmlFor={id}>
          {label}
          {/* El asterisco es decorativo: lo que anuncia el lector de pantalla
              es aria-required en el input. */}
          {obligatorio && (
            <span className="sn-campo__obligatorio" aria-hidden="true">
              *
            </span>
          )}
          {/* "(opcional)" se marca a mano solo donde aclara algo; ponerlo en
              todos los campos no obligatorios ensucia el formulario. */}
          {opcional && <span className="sn-campo__opcional"> ({textos.comunes.opcional})</span>}
        </label>
      )}

      {children({ idAyuda: ayuda ? idAyuda : undefined, idError: error ? idError : undefined })}

      {ayuda && !error && (
        <span className="sn-campo__ayuda" id={idAyuda}>
          {ayuda}
        </span>
      )}

      {error && (
        <span className="sn-campo__error" id={idError} role="alert">
          <Icono nombre="alerta" tam={13} />
          {error}
        </span>
      )}
    </div>
  );
}

/** Input de texto genérico. */
export function Campo({
  label,
  ayuda,
  error,
  obligatorio = false,
  opcional = false,
  className = '',
  claseInput = '',
  id: idExterno,
  ...resto
}) {
  const idAuto = useId();
  const id = idExterno ?? idAuto;

  return (
    <Envoltorio {...{ id, label, ayuda, error, obligatorio, opcional, className }}>
      {({ idAyuda, idError }) => (
        <input
          id={id}
          className={`sn-input ${error ? 'sn-input--error' : ''} ${claseInput}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={[idAyuda, idError].filter(Boolean).join(' ') || undefined}
          aria-required={obligatorio || undefined}
          {...resto}
        />
      )}
    </Envoltorio>
  );
}

/** Área de texto. */
export function CampoTexto({
  label,
  ayuda,
  error,
  obligatorio = false,
  opcional = false,
  className = '',
  id: idExterno,
  ...resto
}) {
  const idAuto = useId();
  const id = idExterno ?? idAuto;

  return (
    <Envoltorio {...{ id, label, ayuda, error, obligatorio, opcional, className }}>
      {({ idAyuda, idError }) => (
        <textarea
          id={id}
          className={`sn-textarea ${error ? 'sn-textarea--error' : ''}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={[idAyuda, idError].filter(Boolean).join(' ') || undefined}
          {...resto}
        />
      )}
    </Envoltorio>
  );
}

/**
 * Selector.
 * @param {Array<{ valor: string, etiqueta: string }>} opciones
 */
export function CampoSelect({
  label,
  ayuda,
  error,
  obligatorio = false,
  opcional = false,
  opciones = [],
  placeholder,
  className = '',
  id: idExterno,
  ...resto
}) {
  const idAuto = useId();
  const id = idExterno ?? idAuto;

  return (
    <Envoltorio {...{ id, label, ayuda, error, obligatorio, opcional, className }}>
      {({ idAyuda, idError }) => (
        <select
          id={id}
          className={`sn-select ${error ? 'sn-select--error' : ''}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={[idAyuda, idError].filter(Boolean).join(' ') || undefined}
          {...resto}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      )}
    </Envoltorio>
  );
}

/** Casilla de verificación. */
export function CampoCheck({ label, ayuda, className = '', id: idExterno, ...resto }) {
  const idAuto = useId();
  const id = idExterno ?? idAuto;

  return (
    <div className={`sn-campo ${className}`}>
      <label className="sn-checkbox" htmlFor={id}>
        <input type="checkbox" id={id} {...resto} />
        <span>
          {label}
          {ayuda && <span className="sn-campo__ayuda sn-campo__ayuda--inline">{ayuda}</span>}
        </span>
      </label>
    </div>
  );
}

/**
 * Grupo de opciones tipo "chips" (más cómodo que un select en el celular).
 * @param {Array<{ valor: string, etiqueta: string, icono?: string }>} opciones
 */
export function CampoOpciones({
  label,
  ayuda,
  error,
  obligatorio = false,
  opciones = [],
  valor,
  onChange,
  name,
  className = '',
}) {
  return (
    <fieldset className={`sn-campo sn-opciones ${className}`}>
      <legend className="sn-campo__label">
        {label}
        {obligatorio && (
          <span className="sn-campo__obligatorio" aria-hidden="true">
            *
          </span>
        )}
      </legend>

      <div className="sn-opciones__lista">
        {opciones.map((o) => {
          const activo = valor === o.valor;
          return (
            <label
              key={o.valor}
              className={`sn-opcion ${activo ? 'sn-opcion--activa' : ''}`}
            >
              <input
                type="radio"
                name={name}
                value={o.valor}
                checked={activo}
                onChange={() => onChange(o.valor)}
                className="sn-solo-lectores"
              />
              {o.icono && <Icono nombre={o.icono} tam={18} />}
              <span>{o.etiqueta}</span>
            </label>
          );
        })}
      </div>

      {ayuda && !error && <span className="sn-campo__ayuda">{ayuda}</span>}
      {error && (
        <span className="sn-campo__error" role="alert">
          <Icono nombre="alerta" tam={13} />
          {error}
        </span>
      )}
    </fieldset>
  );
}

export default Campo;
