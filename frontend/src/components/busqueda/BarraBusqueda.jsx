/**
 * Barra de búsqueda persistente de la pantalla de resultados.
 * Deja cambiar destino y horario sin volver a la home.
 */
import { useState, useEffect } from 'react';
import BuscadorDireccion from './BuscadorDireccion.jsx';
import SelectorPeriodo from './SelectorPeriodo.jsx';
import Logo from '../layout/Logo.jsx';
import { Icono } from '../ui/Iconos.jsx';
import { validarRango } from '../../utils/validaciones.js';
import textos from '../../i18n/textos.js';
import './BarraBusqueda.css';

export function BarraBusqueda({ busqueda, onBuscar }) {
  const [destino, setDestino] = useState(busqueda.destino);
  const [periodo, setPeriodo] = useState({ inicio: busqueda.inicio, fin: busqueda.fin });
  const [modalidad, setModalidad] = useState(busqueda.modalidad);
  const [error, setError] = useState(null);
  const [abiertoMovil, setAbiertoMovil] = useState(false);

  // La URL manda: si cambia desde afuera (atrás, link compartido), se refleja.
  useEffect(() => {
    setDestino(busqueda.destino);
    setPeriodo({ inicio: busqueda.inicio, fin: busqueda.fin });
    setModalidad(busqueda.modalidad);
  }, [busqueda.destino, busqueda.inicio, busqueda.fin, busqueda.modalidad]);

  const enviar = (e) => {
    e?.preventDefault();

    if (!destino) {
      setError(textos.busqueda.elegiDestino);
      return;
    }
    const errorRango = validarRango(periodo.inicio, periodo.fin);
    if (errorRango) {
      setError(errorRango);
      return;
    }

    setError(null);
    setAbiertoMovil(false);
    onBuscar({ destino, ...periodo, modalidad });
  };

  return (
    <div className="sn-barra">
      <div className="sn-contenedor sn-contenedor--ancho sn-barra__interior">
        <Logo tam="sm" className="sn-barra__logo" />

        {/* Móvil: resumen que abre el panel de edición */}
        <button
          type="button"
          className="sn-barra__resumen"
          onClick={() => setAbiertoMovil((v) => !v)}
          aria-expanded={abiertoMovil}
        >
          <Icono nombre="lupa" tam={17} />
          <span className="sn-barra__resumen-texto">
            <strong>{busqueda.destino?.nombre || textos.busqueda.aDondeVas}</strong>
            <small>
              {busqueda.inicio.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ·{' '}
              {busqueda.inicio.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}
              {' – '}
              {busqueda.fin.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </small>
          </span>
          <Icono nombre={abiertoMovil ? 'flechaArriba' : 'flechaAbajo'} tam={16} />
        </button>

        <form className="sn-barra__form" onSubmit={enviar}>
          <div className="sn-barra__modalidad">
            <select
              className="sn-select sn-barra__select"
              value={modalidad}
              onChange={(e) => setModalidad(e.target.value)}
              aria-label="Tipo de reserva"
            >
              <option value="HORARIO">{textos.busqueda.porHora}</option>
              <option value="MENSUAL">{textos.busqueda.mensual}</option>
            </select>
          </div>

          <BuscadorDireccion
            valor={destino}
            onChange={(d) => {
              setDestino(d);
              setError(null);
            }}
            compacto
            label={textos.busqueda.aDondeVas}
            className="sn-barra__destino"
          />

          <SelectorPeriodo
            inicio={periodo.inicio}
            fin={periodo.fin}
            onChange={(c) => {
              setPeriodo((p) => ({ ...p, ...c }));
              setError(null);
            }}
            compacto
            className="sn-barra__periodo"
          />

          {/* Lupa siempre, y la palabra "Buscar" cuando hay lugar. Solo con el
              ícono no se entendía que este botón relanza la búsqueda con los
              filtros de la barra. El title y el aria-label van igual, para el
              hover y para los lectores de pantalla. */}
          <button
            type="submit"
            className="sn-boton sn-boton--primario sn-barra__enviar"
            title={textos.busqueda.buscar}
            aria-label={textos.busqueda.buscar}
          >
            <Icono nombre="lupa" tam={17} />
            <span className="sn-barra__enviar-texto">{textos.busqueda.buscarBoton}</span>
          </button>
        </form>
      </div>

      {/* Panel de edición en móvil */}
      {abiertoMovil && (
        <form className="sn-barra__movil" onSubmit={enviar}>
          <div className="sn-barra__pestanas">
            {[
              { id: 'HORARIO', etiqueta: textos.busqueda.porHora },
              { id: 'MENSUAL', etiqueta: textos.busqueda.mensual },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                className={`sn-barra__pestana ${modalidad === p.id ? 'sn-barra__pestana--activa' : ''}`}
                onClick={() => setModalidad(p.id)}
              >
                {p.etiqueta}
              </button>
            ))}
          </div>

          <BuscadorDireccion
            valor={destino}
            onChange={(d) => {
              setDestino(d);
              setError(null);
            }}
            label={textos.busqueda.aDondeVas}
          />

          <SelectorPeriodo
            inicio={periodo.inicio}
            fin={periodo.fin}
            onChange={(c) => {
              setPeriodo((p) => ({ ...p, ...c }));
              setError(null);
            }}
          />

          {error && (
            <span className="sn-campo__error" role="alert">
              <Icono nombre="alerta" tam={13} />
              {error}
            </span>
          )}

          <button type="submit" className="sn-boton sn-boton--primario sn-boton--bloque">
            <Icono nombre="lupa" tam={17} />
            {textos.busqueda.buscar}
          </button>
        </form>
      )}

      {error && !abiertoMovil && (
        <div className="sn-contenedor sn-contenedor--ancho">
          <span className="sn-campo__error sn-barra__error" role="alert">
            <Icono nombre="alerta" tam={13} />
            {error}
          </span>
        </div>
      )}
    </div>
  );
}

export default BarraBusqueda;
