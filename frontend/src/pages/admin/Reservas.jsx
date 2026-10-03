/**
 * Listado de reservas con búsqueda, filtros, paginación y exportación.
 */
import { useState, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icono } from '../../components/ui/Iconos.jsx';
import { Cargando, ErrorCarga, Vacio } from '../../components/ui/Estado.jsx';
import { Paginacion, Metrica } from '../../components/ui/Varios.jsx';
import TablaReservas from '../../components/admin/TablaReservas.jsx';
import ModalWhatsApp from '../../components/admin/ModalWhatsApp.jsx';
import ModalEliminarReserva from '../../components/admin/ModalEliminarReserva.jsx';
import { admin } from '../../services/spotnear.service.js';
import { usePedido, useTitulo, useDebounce } from '../../hooks/index.js';
import { useAccionesReserva } from '../../hooks/useAccionesReserva.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { precio as fmtPrecio, paraInputDate } from '../../utils/formato.js';
import textos from '../../i18n/textos.js';
import './Reservas.css';

/**
 * "Todos" (sin filtro) NO incluye las reservas que esperan la seña: el backend
 * las excluye salvo que se las pida. Se ven eligiendo "Esperando la seña", que
 * va al final a propósito, separada de los estados de reservas reales.
 */
const ESTADOS = ['CONFIRMADA', 'EN_CURSO', 'FINALIZADA', 'CANCELADA', 'NO_SHOW', 'PENDIENTE'];

export function Reservas() {
  const { esSuperadmin } = useAuth();
  const toast = useToast();
  useTitulo(textos.admin.reservas.titulo);

  // Los filtros viven en la URL: así se puede compartir o guardar una vista.
  const [params, setParams] = useSearchParams();
  const [exportando, setExportando] = useState(false);
  // Reserva terminada que se está por quitar del listado (abre la confirmación).
  const [aEliminar, setAEliminar] = useState(null);

  const filtros = useMemo(
    () => ({
      q: params.get('q') ?? '',
      estado: params.get('estado') ?? '',
      desde: params.get('desde') ?? '',
      hasta: params.get('hasta') ?? '',
      pagina: Number(params.get('pagina')) || 1,
      porPagina: 20,
      orden: params.get('orden') ?? 'INICIO_DESC',
    }),
    [params],
  );

  const [textoBusqueda, setTextoBusqueda] = useState(filtros.q);
  const busquedaRetrasada = useDebounce(textoBusqueda, 400);

  const actualizar = useCallback(
    (cambios) => {
      setParams((prev) => {
        const nuevos = new URLSearchParams(prev);
        for (const [clave, valor] of Object.entries(cambios)) {
          if (valor === null || valor === undefined || valor === '') nuevos.delete(clave);
          else nuevos.set(clave, String(valor));
        }
        // Cualquier cambio de filtro vuelve a la primera página: si no, se
        // puede quedar mirando una página 5 que ya no existe.
        if (!('pagina' in cambios)) nuevos.delete('pagina');
        return nuevos;
      });
    },
    [setParams],
  );

  const consulta = useMemo(
    () => ({
      q: busquedaRetrasada || undefined,
      estado: filtros.estado || undefined,
      desde: filtros.desde || undefined,
      hasta: filtros.hasta || undefined,
      pagina: filtros.pagina,
      porPagina: filtros.porPagina,
      orden: filtros.orden,
    }),
    [busquedaRetrasada, filtros],
  );

  const { datos, cargando, error, recargar } = usePedido(
    ({ signal }) => admin.reservas.listar(consulta, { signal }),
    [JSON.stringify(consulta)],
  );

  const { procesando, ejecutar, whatsapp, abrirWhatsApp, abrirResumenDia, cerrarWhatsApp } =
    useAccionesReserva({ alActualizar: recargar });

  const exportar = async () => {
    setExportando(true);
    try {
      await admin.reservas.exportarCSV({
        q: consulta.q,
        estado: consulta.estado,
        desde: consulta.desde,
        hasta: consulta.hasta,
        orden: consulta.orden,
      });
      toast.ok('Descarga iniciada');
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    } finally {
      setExportando(false);
    }
  };

  const limpiar = () => {
    setTextoBusqueda('');
    setParams(new URLSearchParams());
  };

  const hayFiltros = Boolean(filtros.q || filtros.estado || filtros.desde || filtros.hasta);
  const reservas = datos?.reservas ?? [];
  const totales = datos?.totales;

  return (
    <>
      <header className="sn-panel__cabecera">
        <div>
          <h1 className="sn-panel__titulo">{textos.admin.reservas.titulo}</h1>
          {datos && (
            <p className="sn-panel__subtitulo">
              {textos.admin.reservas.total(datos.paginacion.total)}
            </p>
          )}
        </div>

        <div className="sn-panel__acciones">
          <button
            type="button"
            className="sn-boton sn-boton--whatsapp"
            onClick={() => abrirResumenDia()}
          >
            <Icono nombre="whatsapp" tam={17} />
            {textos.admin.reservas.resumenDia}
          </button>
          <button
            type="button"
            className="sn-boton sn-boton--secundario"
            onClick={exportar}
            disabled={exportando}
          >
            {exportando ? (
              <span className="sn-spinner" style={{ width: 16, height: 16 }} aria-hidden="true" />
            ) : (
              <Icono nombre="descargar" tam={17} />
            )}
            {textos.admin.reservas.exportar}
          </button>
          <Link to="/panel/reservas/nueva" className="sn-boton sn-boton--primario">
            <Icono nombre="mas" tam={17} />
            {textos.admin.reservas.nueva}
          </Link>
        </div>
      </header>

      {/* ── Filtros ── */}
      <div className="sn-filtros-reservas">
        <div className="sn-filtros-reservas__buscar">
          <Icono nombre="lupa" tam={17} />
          <input
            type="search"
            className="sn-filtros-reservas__input"
            placeholder={textos.admin.reservas.buscar}
            value={textoBusqueda}
            onChange={(e) => {
              setTextoBusqueda(e.target.value);
              actualizar({ q: e.target.value });
            }}
            aria-label={textos.admin.reservas.buscar}
          />
        </div>

        <div className="sn-filtros-reservas__campos">
          <label className="sn-filtros-reservas__campo">
            <span>{textos.admin.reservas.filtrarEstado}</span>
            <select
              className="sn-select"
              value={filtros.estado}
              onChange={(e) => actualizar({ estado: e.target.value })}
            >
              <option value="">{textos.admin.reservas.todosConSena}</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e === 'PENDIENTE' ? textos.admin.reservas.sinSena : textos.estados[e]}
                </option>
              ))}
            </select>
          </label>

          <label className="sn-filtros-reservas__campo">
            <span>{textos.admin.reservas.desde}</span>
            <input
              type="date"
              className="sn-input"
              value={filtros.desde}
              max={filtros.hasta || undefined}
              onChange={(e) => actualizar({ desde: e.target.value })}
            />
          </label>

          <label className="sn-filtros-reservas__campo">
            <span>{textos.admin.reservas.hasta}</span>
            <input
              type="date"
              className="sn-input"
              value={filtros.hasta}
              min={filtros.desde || undefined}
              onChange={(e) => actualizar({ hasta: e.target.value })}
            />
          </label>

          <label className="sn-filtros-reservas__campo">
            <span>{textos.resultados.ordenarPor}</span>
            <select
              className="sn-select"
              value={filtros.orden}
              onChange={(e) => actualizar({ orden: e.target.value })}
            >
              <option value="INICIO_DESC">Ingreso (más nuevo)</option>
              <option value="INICIO_ASC">Ingreso (más viejo)</option>
              <option value="CREADA_DESC">Fecha de carga</option>
              <option value="PRECIO_DESC">Monto</option>
            </select>
          </label>

          <div className="sn-filtros-reservas__atajos">
            <button
              type="button"
              className="sn-chip sn-chip--sm"
              onClick={() => {
                const h = paraInputDate(new Date());
                actualizar({ desde: h, hasta: h });
              }}
            >
              {textos.comunes.hoy}
            </button>
            {hayFiltros && (
              <button type="button" className="sn-chip sn-chip--sm" onClick={limpiar}>
                <Icono nombre="equis" tam={13} />
                {textos.resultados.limpiarFiltros}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Totales del filtro ── */}
      {totales && reservas.length > 0 && (
        <div className="sn-reservas__totales">
          <Metrica
            etiqueta={textos.admin.comisiones.facturado}
            valor={fmtPrecio(totales.precioTotal)}
          />
          <Metrica
            etiqueta={textos.admin.comisiones.neto}
            valor={fmtPrecio(totales.montoNeto)}
            tono="ok"
          />
          {esSuperadmin && (
            <Metrica
              etiqueta={textos.admin.comisiones.comision}
              valor={fmtPrecio(totales.montoComision)}
              tono="marca"
            />
          )}
        </div>
      )}

      {/* ── Listado ── */}
      <section className="sn-panel__seccion">
        {cargando && <Cargando />}

        {!cargando && error && <ErrorCarga error={error} onReintentar={recargar} />}

        {!cargando && !error && reservas.length === 0 && (
          <Vacio
            icono="ticket"
            titulo={textos.admin.reservas.sinResultados}
            texto={textos.admin.reservas.sinResultadosTexto}
            accion={
              hayFiltros && (
                <button type="button" className="sn-boton sn-boton--secundario" onClick={limpiar}>
                  {textos.resultados.limpiarFiltros}
                </button>
              )
            }
          />
        )}

        {!cargando && !error && reservas.length > 0 && (
          <>
            <TablaReservas
              reservas={reservas}
              onAccion={ejecutar}
              onWhatsApp={(r) => abrirWhatsApp(r, 'grupo')}
              onEliminar={setAEliminar}
              procesando={procesando}
              mostrarParking={esSuperadmin}
            />
            <Paginacion
              pagina={datos.paginacion.pagina}
              paginas={datos.paginacion.paginas}
              total={datos.paginacion.total}
              onCambiar={(p) => actualizar({ pagina: p })}
            />
          </>
        )}
      </section>

      <ModalEliminarReserva
        reserva={aEliminar}
        alCerrar={() => setAEliminar(null)}
        alEliminar={() => {
          setAEliminar(null);
          recargar();
        }}
      />

      <ModalWhatsApp
        abierto={whatsapp.abierto}
        alCerrar={cerrarWhatsApp}
        titulo={whatsapp.titulo}
        mensaje={whatsapp.mensaje}
        link={whatsapp.link}
        cargando={whatsapp.cargando}
      />
    </>
  );
}

export default Reservas;
