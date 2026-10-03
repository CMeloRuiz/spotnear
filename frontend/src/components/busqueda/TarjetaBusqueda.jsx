/**
 * Tarjeta de búsqueda de la home: pestañas, destino, horario y botón.
 *
 * Dos pestañas:
 *
 *   · Por hora / Diario → ingreso y salida libres, con buscador de direcciones.
 *                         Es la principal y la que arranca activa.
 *   · Mensual           → sede de una lista y fecha. Está DESHABILITADA
 *                         temporalmente (ver PESTANAS): se ve, pero no se
 *                         puede entrar.
 *
 * La pausa de "Mensual" es solo de acceso: el formulario que se armó para ella
 * —el desplegable de sedes, el campo de fecha, la ventana horaria del evento—
 * sigue entero acá abajo. Para reactivarla alcanza con sacarle `deshabilitada`
 * a su entrada en PESTANAS. Cuál arranca activa sale de esa misma lista, así
 * que prender y apagar pestañas no pide tocar nada más.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BuscadorDireccion from './BuscadorDireccion.jsx';
import SelectorPeriodo from './SelectorPeriodo.jsx';
import { SEDES_DE_EVENTOS, LUGARES } from './lugares.js';
import { Icono } from '../ui/Iconos.jsx';
import { periodoPorDefecto, urlBusqueda } from '../../hooks/useBusqueda.js';
import { validarRango } from '../../utils/validaciones.js';
import { paraInputDate } from '../../utils/formato.js';
import textos from '../../i18n/textos.js';
import './TarjetaBusqueda.css';

const PESTANAS = [
  { id: 'HORARIO', etiqueta: textos.busqueda.porHora },
  // Pausada, no eliminada: sacando `deshabilitada` vuelve a funcionar tal cual.
  // El id sigue siendo EVENTOS porque el formulario de abajo es el de sede y
  // fecha del show; "Mensual" es solo la etiqueta que ve el cliente.
  { id: 'EVENTOS', etiqueta: textos.busqueda.mensual, deshabilitada: true },
];

/**
 * Destino con el que arranca el buscador: el Movistar Arena, que es el lugar
 * por el que nació el producto. Es solo un valor inicial —el usuario lo borra o
 * lo cambia como cualquier texto— pero viene ya resuelto con sus coordenadas,
 * así que buscar sin tocarlo es exactamente lo mismo que haberlo elegido de la
 * lista de sugerencias.
 */
const DESTINO_POR_DEFECTO = (() => {
  const l = LUGARES.find((x) => x.id === 'movistar-arena');
  return l ? { nombre: l.nombre, lat: l.lat, lng: l.lng } : null;
})();

/** La pestaña que arranca activa: la primera que no esté pausada. */
const MODALIDAD_INICIAL = PESTANAS.find((p) => !p.deshabilitada).id;

/**
 * Ventana horaria de un evento.
 *
 * El formulario pide solo la fecha, así que la hora la pone el sistema. Se usa
 * la franja típica de un recital —de 19 a 1 de la mañana— que cubre llegar
 * antes de que empiece y salir después de que termine. Son 6 h, que caen en
 * media estadía.
 */
const HORA_INICIO_EVENTO = 19;
const HORAS_DE_EVENTO = 6;

function periodoDelEvento(fecha) {
  const inicio = new Date(fecha);
  inicio.setHours(HORA_INICIO_EVENTO, 0, 0, 0);
  return { inicio, fin: new Date(inicio.getTime() + HORAS_DE_EVENTO * 3_600_000) };
}

export function TarjetaBusqueda({ className = '', destinoInicial = null }) {
  const navegar = useNavigate();

  const [modalidad, setModalidad] = useState(MODALIDAD_INICIAL);
  const [destino, setDestino] = useState(destinoInicial ?? DESTINO_POR_DEFECTO);
  const [periodo, setPeriodo] = useState(periodoPorDefecto);
  const [sedeId, setSedeId] = useState(SEDES_DE_EVENTOS[0]?.id ?? '');
  const [fechaEvento, setFechaEvento] = useState(() => new Date());
  const [errores, setErrores] = useState({});

  const esEventos = modalidad === 'EVENTOS';
  const sede = SEDES_DE_EVENTOS.find((s) => s.id === sedeId) ?? null;

  const cambiarPestana = (p) => {
    if (p.deshabilitada) return;
    setModalidad(p.id);
    setErrores({});
  };

  const buscar = (e) => {
    e.preventDefault();

    const nuevos = {};

    if (esEventos) {
      if (!sede) nuevos.destino = textos.busqueda.elegiSede;
    } else {
      if (!destino) nuevos.destino = textos.busqueda.elegiDestino;
      const errorRango = validarRango(periodo.inicio, periodo.fin);
      if (errorRango) nuevos.periodo = errorRango;
    }

    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    // Un evento se cotiza como cualquier estadía por hora: se para unas horas,
    // no un mes. Por eso la modalidad que viaja es HORARIO en los dos casos.
    const rango = esEventos ? periodoDelEvento(fechaEvento) : periodo;
    const aDonde = esEventos ? sede : destino;

    navegar(urlBusqueda({ destino: aDonde, ...rango, modalidad: 'HORARIO' }));
  };

  return (
    <form className={`sn-tarjeta-busqueda ${className}`} onSubmit={buscar} noValidate>
      <div className="sn-tarjeta-busqueda__pestanas" role="tablist" aria-label="Tipo de reserva">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={modalidad === p.id}
            aria-disabled={p.deshabilitada || undefined}
            title={p.deshabilitada ? textos.busqueda.pestanaPausada : undefined}
            className={[
              'sn-tarjeta-busqueda__pestana',
              modalidad === p.id ? 'sn-tarjeta-busqueda__pestana--activa' : '',
              p.deshabilitada ? 'sn-tarjeta-busqueda__pestana--pausada' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => cambiarPestana(p)}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <div className="sn-tarjeta-busqueda__campos">
        {esEventos ? (
          <>
            {/* Desplegable de sedes. Hoy tiene una sola opción; se suman desde
                SEDES_DE_EVENTOS en lugares.js, sin tocar este componente. */}
            <div className="sn-periodo">
              <div className="sn-periodo__caja">
                <span className="sn-periodo__icono" aria-hidden="true">
                  <Icono nombre="pin" tam={19} />
                </span>
                <div className="sn-periodo__campo">
                  <label className="sn-periodo__label" htmlFor="sn-evento-sede">
                    {textos.busqueda.aDondeVas}
                  </label>
                  <select
                    id="sn-evento-sede"
                    className="sn-periodo__input sn-periodo__select"
                    value={sedeId}
                    onChange={(e) => {
                      setSedeId(e.target.value);
                      setErrores((prev) => ({ ...prev, destino: undefined }));
                    }}
                  >
                    {SEDES_DE_EVENTOS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {errores.destino && (
                <span className="sn-campo__error" role="alert">
                  <Icono nombre="alerta" tam={13} />
                  {errores.destino}
                </span>
              )}
            </div>

            <div className="sn-periodo">
              <div className="sn-periodo__caja">
                <span className="sn-periodo__icono" aria-hidden="true">
                  <Icono nombre="calendario" tam={19} />
                </span>
                <div className="sn-periodo__campo">
                  <label className="sn-periodo__label" htmlFor="sn-evento-fecha">
                    {textos.busqueda.fechaDelEvento}
                  </label>
                  <input
                    id="sn-evento-fecha"
                    type="date"
                    className="sn-periodo__input"
                    value={paraInputDate(fechaEvento)}
                    min={paraInputDate(new Date())}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const d = new Date(`${e.target.value}T${String(HORA_INICIO_EVENTO).padStart(2, '0')}:00:00`);
                      if (!Number.isNaN(d.getTime())) setFechaEvento(d);
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <BuscadorDireccion
              valor={destino}
              onChange={(d) => {
                setDestino(d);
                setErrores((prev) => ({ ...prev, destino: undefined }));
              }}
              error={errores.destino}
              label={textos.busqueda.aDondeVas}
            />

            <SelectorPeriodo
              inicio={periodo.inicio}
              fin={periodo.fin}
              onChange={(cambios) => {
                setPeriodo((p) => ({ ...p, ...cambios }));
                setErrores((prev) => ({ ...prev, periodo: undefined }));
              }}
              error={errores.periodo}
              separado
            />
          </>
        )}

        <button type="submit" className="sn-boton sn-boton--primario sn-boton--lg sn-boton--bloque">
          <Icono nombre="lupa" tam={18} />
          {textos.busqueda.buscar}
        </button>
      </div>
    </form>
  );
}

export default TarjetaBusqueda;
