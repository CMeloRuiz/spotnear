/**
 * Panel de filtros de la búsqueda.
 *
 * Los cambios se guardan en un borrador y recién se aplican al confirmar: en
 * el celular, cada cambio dispararía una búsqueda nueva y el listado saltaría
 * bajo el dedo del usuario.
 */
import { useState, useEffect } from 'react';
import { Modal } from '../ui/Varios.jsx';
import { Icono, ICONO_VEHICULO, ICONO_SERVICIO } from '../ui/Iconos.jsx';
import { precio as fmtPrecio, distancia as fmtDistancia } from '../../utils/formato.js';
import textos from '../../i18n/textos.js';
import './Filtros.css';

const TIPOS_VEHICULO = ['AUTO', 'SUV', 'CAMIONETA', 'MOTO', 'UTILITARIO'];
const SERVICIOS = ['camaras', '24hs', 'vigilancia', 'techado', 'lavado', 'valet', 'cargador_electrico'];
const RADIOS = [500, 1000, 2500, 5000];
const CALIFICACIONES = [4.5, 4, 3.5];

export function Filtros({ abierto, alCerrar, filtros, onAplicar, onLimpiar, precioMaximoVisto }) {
  const [borrador, setBorrador] = useState(filtros);

  // Al abrir, el borrador parte de lo que está aplicado hoy.
  useEffect(() => {
    if (abierto) setBorrador(filtros);
  }, [abierto, filtros]);

  const set = (cambios) => setBorrador((b) => ({ ...b, ...cambios }));

  const alternarServicio = (servicio) => {
    const actuales = borrador.servicios ?? [];
    set({
      servicios: actuales.includes(servicio)
        ? actuales.filter((s) => s !== servicio)
        : [...actuales, servicio],
    });
  };

  const tope = Math.max(Math.ceil((precioMaximoVisto || 30000) / 1000) * 1000, 5000);

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={textos.resultados.filtros}
      ancho={520}
      pie={
        <>
          <button
            type="button"
            className="sn-boton sn-boton--fantasma"
            onClick={() => {
              onLimpiar();
              alCerrar();
            }}
          >
            {textos.resultados.limpiarFiltros}
          </button>
          <button
            type="button"
            className="sn-boton sn-boton--primario"
            onClick={() => {
              onAplicar(borrador);
              alCerrar();
            }}
          >
            {textos.resultados.aplicarFiltros}
          </button>
        </>
      }
    >
      <div className="sn-filtros">
        {/* ── Tipo de vehículo ── */}
        <fieldset className="sn-filtros__grupo">
          <legend className="sn-filtros__titulo">{textos.resultados.tipoVehiculo}</legend>
          <div className="sn-filtros__chips">
            <button
              type="button"
              className={`sn-chip ${!borrador.tipoVehiculo ? 'sn-chip--activo' : ''}`}
              onClick={() => set({ tipoVehiculo: null })}
            >
              {textos.admin.reservas.todos}
            </button>
            {TIPOS_VEHICULO.map((t) => (
              <button
                key={t}
                type="button"
                className={`sn-chip ${borrador.tipoVehiculo === t ? 'sn-chip--activo' : ''}`}
                onClick={() => set({ tipoVehiculo: borrador.tipoVehiculo === t ? null : t })}
              >
                <Icono nombre={ICONO_VEHICULO[t]} tam={16} />
                {textos.parking.tiposVehiculo[t]}
              </button>
            ))}
          </div>
        </fieldset>

        {/* ── Cubierto ── */}
        <fieldset className="sn-filtros__grupo">
          <legend className="sn-filtros__titulo">{textos.resultados.techado}</legend>
          <div className="sn-filtros__chips">
            {[
              { valor: null, etiqueta: textos.admin.reservas.todos },
              { valor: true, etiqueta: textos.resultados.cubierto, icono: 'techo' },
              { valor: false, etiqueta: textos.resultados.descubierto },
            ].map((o) => (
              <button
                key={String(o.valor)}
                type="button"
                className={`sn-chip ${borrador.cubierto === o.valor ? 'sn-chip--activo' : ''}`}
                onClick={() => set({ cubierto: o.valor })}
              >
                {o.icono && <Icono nombre={o.icono} tam={16} />}
                {o.etiqueta}
              </button>
            ))}
          </div>
        </fieldset>

        {/* ── Distancia ── */}
        <fieldset className="sn-filtros__grupo">
          <legend className="sn-filtros__titulo">{textos.resultados.distanciaMaxima}</legend>
          <div className="sn-filtros__chips">
            {RADIOS.map((r) => (
              <button
                key={r}
                type="button"
                className={`sn-chip ${borrador.radio === r ? 'sn-chip--activo' : ''}`}
                onClick={() => set({ radio: r })}
              >
                {fmtDistancia(r)}
              </button>
            ))}
          </div>
        </fieldset>

        {/* ── Precio ── */}
        <fieldset className="sn-filtros__grupo">
          <legend className="sn-filtros__titulo">
            {textos.resultados.precioMaximo}
            <span className="sn-filtros__valor">
              {borrador.precioMax ? fmtPrecio(borrador.precioMax) : 'Sin límite'}
            </span>
          </legend>
          <input
            type="range"
            className="sn-rango"
            min={1000}
            max={tope}
            step={500}
            value={borrador.precioMax ?? tope}
            onChange={(e) => {
              const v = Number(e.target.value);
              // En el tope, el filtro se apaga: "sin límite" es más claro que
              // "hasta el número más alto que hay".
              set({ precioMax: v >= tope ? null : v });
            }}
            aria-label={textos.resultados.precioMaximo}
          />
          <div className="sn-filtros__rango-extremos">
            <span>{fmtPrecio(1000)}</span>
            <span>Sin límite</span>
          </div>
        </fieldset>

        {/* ── Calificación ── */}
        <fieldset className="sn-filtros__grupo">
          <legend className="sn-filtros__titulo">{textos.resultados.calificacionMinima}</legend>
          <div className="sn-filtros__chips">
            <button
              type="button"
              className={`sn-chip ${!borrador.calificacionMin ? 'sn-chip--activo' : ''}`}
              onClick={() => set({ calificacionMin: null })}
            >
              {textos.admin.reservas.todos}
            </button>
            {CALIFICACIONES.map((c) => (
              <button
                key={c}
                type="button"
                className={`sn-chip ${borrador.calificacionMin === c ? 'sn-chip--activo' : ''}`}
                onClick={() => set({ calificacionMin: borrador.calificacionMin === c ? null : c })}
              >
                <Icono nombre="estrella" tam={14} className="sn-chip__estrella" />
                {String(c).replace('.', ',')}+
              </button>
            ))}
          </div>
        </fieldset>

        {/* ── Servicios ── */}
        <fieldset className="sn-filtros__grupo">
          <legend className="sn-filtros__titulo">{textos.resultados.servicios}</legend>
          <div className="sn-filtros__chips">
            {SERVICIOS.map((s) => (
              <button
                key={s}
                type="button"
                className={`sn-chip ${borrador.servicios?.includes(s) ? 'sn-chip--activo' : ''}`}
                onClick={() => alternarServicio(s)}
                aria-pressed={borrador.servicios?.includes(s)}
              >
                <Icono nombre={ICONO_SERVICIO[s] ?? 'check'} tam={16} />
                {textos.parking.servicios[s] ?? s}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}

export default Filtros;
