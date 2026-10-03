/**
 * Tarifas del estacionamiento.
 */
import { useState } from 'react';
import { Icono } from '../../components/ui/Iconos.jsx';
import { Cargando, ErrorCarga, Vacio } from '../../components/ui/Estado.jsx';
import { Modal, Aviso } from '../../components/ui/Varios.jsx';
import { Campo, CampoSelect } from '../../components/ui/Campo.jsx';
import { admin } from '../../services/spotnear.service.js';
import { usePedido, useTitulo } from '../../hooks/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { precio as fmtPrecio, fecha as fmtFecha } from '../../utils/formato.js';
import textos from '../../i18n/textos.js';
import './Tarifas.css';

const TIPOS = ['HORA', 'DIA', 'MENSUAL'];
const VEHICULOS = ['AUTO', 'SUV', 'CAMIONETA', 'MOTO', 'UTILITARIO'];

const FORM_VACIO = {
  tipo: 'HORA',
  precio: '',
  descripcion: '',
  vehicleType: '',
  parkingId: '',
};

export function Tarifas() {
  const toast = useToast();
  const { usuario, esSuperadmin } = useAuth();
  useTitulo(textos.admin.tarifas.titulo);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const { datos, cargando, error, recargar } = usePedido(
    ({ signal }) => admin.tarifas.listar({}, { signal }),
    [],
  );

  const { datos: datosParkings } = usePedido(
    ({ signal }) => admin.parkings.listar({}, { signal }),
    [],
  );

  const tarifas = datos?.tarifas ?? [];
  const parkings = datosParkings?.parkings ?? [];

  const abrirNueva = () => {
    setForm({ ...FORM_VACIO, parkingId: usuario.parkingId ?? parkings[0]?.id ?? '' });
    setErrores({});
    setModal(true);
  };

  const guardar = async () => {
    const nuevos = {};
    const precioNum = Number(form.precio);
    if (!form.precio || Number.isNaN(precioNum) || precioNum <= 0) {
      nuevos.precio = 'Ingresá un precio mayor a cero';
    }
    if (esSuperadmin && !form.parkingId) {
      nuevos.parkingId = textos.errores.campoObligatorio;
    }

    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setGuardando(true);
    try {
      await admin.tarifas.crear({
        parkingId: form.parkingId || undefined,
        tipo: form.tipo,
        precio: precioNum,
        descripcion: form.descripcion.trim() || undefined,
        vehicleType: form.vehicleType || null,
      });
      toast.ok('Tarifa creada');
      setModal(false);
      recargar();
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    } finally {
      setGuardando(false);
    }
  };

  const desactivar = async (tarifa) => {
    if (!window.confirm(textos.admin.tarifas.confirmarEliminar)) return;
    try {
      await admin.tarifas.desactivar(tarifa.id);
      toast.ok('Tarifa desactivada');
      recargar();
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    }
  };

  const hayTarifaHora = tarifas.some((t) => t.tipo === 'HORA');

  return (
    <>
      <header className="sn-panel__cabecera">
        <div>
          <h1 className="sn-panel__titulo">{textos.admin.tarifas.titulo}</h1>
          <p className="sn-panel__subtitulo">{textos.admin.tarifas.subtitulo}</p>
        </div>
        <div className="sn-panel__acciones">
          <button type="button" className="sn-boton sn-boton--primario" onClick={abrirNueva}>
            <Icono nombre="mas" tam={17} />
            {textos.admin.tarifas.nueva}
          </button>
        </div>
      </header>

      <Aviso tipo="info" className="sn-tarifas__explicacion">
        <strong>{textos.admin.tarifas.comoSeCobra}.</strong> {textos.admin.tarifas.explicacion}
      </Aviso>

      {!cargando && !error && tarifas.length > 0 && !hayTarifaHora && (
        <Aviso tipo="aviso">
          No hay ninguna tarifa por hora activa. Sin ella, el estacionamiento no aparece en las
          búsquedas por horario.
        </Aviso>
      )}

      <section className="sn-panel__seccion">
        {cargando && <Cargando />}
        {!cargando && error && <ErrorCarga error={error} onReintentar={recargar} />}

        {!cargando && !error && tarifas.length === 0 && (
          <Vacio
            icono="dinero"
            titulo={textos.admin.tarifas.sinTarifas}
            texto={textos.admin.tarifas.sinTarifasTexto}
            accion={
              <button type="button" className="sn-boton sn-boton--primario" onClick={abrirNueva}>
                <Icono nombre="mas" tam={16} />
                {textos.admin.tarifas.nueva}
              </button>
            }
          />
        )}

        {!cargando && !error && tarifas.length > 0 && (
          <div className="sn-tabla-scroll">
            <table className="sn-tabla">
              <thead>
                <tr>
                  <th>{textos.admin.tarifas.tipo}</th>
                  {esSuperadmin && <th>Estacionamiento</th>}
                  <th>{textos.admin.tarifas.descripcion}</th>
                  <th>{textos.admin.tarifas.vehiculo}</th>
                  <th>{textos.admin.tarifas.vigencia}</th>
                  <th className="sn-tabla__num">{textos.admin.tarifas.precio}</th>
                  <th aria-label={textos.admin.reservas.columnas.acciones} />
                </tr>
              </thead>
              <tbody>
                {tarifas.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className="sn-badge sn-badge--neutro">
                        {textos.admin.tarifas.tipos[t.tipo]}
                      </span>
                    </td>
                    {esSuperadmin && (
                      <td className="sn-silencio">{t.parking?.nombre ?? '—'}</td>
                    )}
                    <td>{t.descripcion ?? '—'}</td>
                    <td>
                      {t.vehicleType
                        ? textos.parking.tiposVehiculo[t.vehicleType]
                        : textos.admin.tarifas.todosLosVehiculos}
                    </td>
                    <td className="sn-silencio">
                      {t.vigenciaDesde || t.vigenciaHasta
                        ? `${t.vigenciaDesde ? fmtFecha(t.vigenciaDesde) : '…'} – ${t.vigenciaHasta ? fmtFecha(t.vigenciaHasta) : '…'}`
                        : textos.admin.tarifas.sinVigencia}
                    </td>
                    <td className="sn-tabla__num sn-precio">{fmtPrecio(t.precio)}</td>
                    <td>
                      <button
                        type="button"
                        className="sn-tabla-reservas__icono"
                        onClick={() => desactivar(t)}
                        title={textos.admin.tarifas.eliminar}
                      >
                        <Icono nombre="basura" tam={16} />
                        <span className="sn-solo-lectores">{textos.admin.tarifas.eliminar}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Alta ── */}
      <Modal
        abierto={modal}
        alCerrar={() => setModal(false)}
        titulo={textos.admin.tarifas.nueva}
        pie={
          <>
            <button
              type="button"
              className="sn-boton sn-boton--fantasma"
              onClick={() => setModal(false)}
              disabled={guardando}
            >
              {textos.comunes.cancelar}
            </button>
            <button
              type="button"
              className="sn-boton sn-boton--primario"
              onClick={guardar}
              disabled={guardando}
            >
              {guardando ? textos.comunes.guardando : textos.comunes.guardar}
            </button>
          </>
        }
      >
        <div className="sn-tarifas__form">
          {esSuperadmin && (
            <CampoSelect
              label="Estacionamiento"
              obligatorio
              value={form.parkingId}
              onChange={(e) => setForm((f) => ({ ...f, parkingId: e.target.value }))}
              placeholder="Elegí uno"
              error={errores.parkingId}
              opciones={parkings.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
            />
          )}

          <CampoSelect
            label={textos.admin.tarifas.tipo}
            obligatorio
            value={form.tipo}
            onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
            opciones={TIPOS.map((t) => ({ valor: t, etiqueta: textos.admin.tarifas.tipos[t] }))}
          />

          <Campo
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            label={`${textos.admin.tarifas.precio} (ARS)`}
            placeholder="2400"
            obligatorio
            value={form.precio}
            onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
            error={errores.precio}
          />

          <CampoSelect
            label={textos.admin.tarifas.vehiculo}
            value={form.vehicleType}
            onChange={(e) => setForm((f) => ({ ...f, vehicleType: e.target.value }))}
            placeholder={textos.admin.tarifas.todosLosVehiculos}
            ayuda="Dejalo vacío para que aplique a todos los vehículos."
            opciones={VEHICULOS.map((v) => ({ valor: v, etiqueta: textos.parking.tiposVehiculo[v] }))}
          />

          <Campo
            label={textos.admin.tarifas.descripcion}
            placeholder="Tarifa de fin de semana"
            opcional
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
          />
        </div>
      </Modal>
    </>
  );
}

export default Tarifas;
