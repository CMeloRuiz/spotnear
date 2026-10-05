/**
 * Datos del estacionamiento: ficha, ubicación, horarios, fotos, campos
 * opcionales del formulario y bloqueo de cupos.
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Icono, ICONO_SERVICIO, ICONO_VEHICULO } from '../../components/ui/Iconos.jsx';
import { Cargando, ErrorCarga, Vacio } from '../../components/ui/Estado.jsx';
import { Modal, Aviso } from '../../components/ui/Varios.jsx';
import { Campo, CampoTexto, CampoSelect, CampoCheck } from '../../components/ui/Campo.jsx';
import BuscadorDireccion from '../../components/busqueda/BuscadorDireccion.jsx';
import { MAP_ID, useEstadoMapas } from '../../components/mapas/ProveedorMapas.jsx';
import { admin, publico } from '../../services/spotnear.service.js';
import { usePedido, useTitulo } from '../../hooks/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext.jsx';
import { fechaHora, paraInputDateTime } from '../../utils/formato.js';
import { tipoDeHorario } from '../../utils/horarios.js';
import textos from '../../i18n/textos.js';
import './MiEstacionamiento.css';

const SERVICIOS = ['camaras', '24hs', 'vigilancia', 'techado', 'lavado', 'valet', 'cargador_electrico'];
const VEHICULOS = ['AUTO', 'SUV', 'CAMIONETA', 'MOTO', 'UTILITARIO'];
const DIAS = [
  ['lun', 'Lunes'],
  ['mar', 'Martes'],
  ['mie', 'Miércoles'],
  ['jue', 'Jueves'],
  ['vie', 'Viernes'],
  ['sab', 'Sábado'],
  ['dom', 'Domingo'],
];

export function MiEstacionamiento() {
  const { usuario, esSuperadmin } = useAuth();
  const toast = useToast();
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const { disponible: hayMapa } = useEstadoMapas();

  useTitulo(textos.admin.miEstacionamiento.titulo);

  // El SUPERADMIN puede abrir el de cualquiera con ?parkingId=
  const parkingId = params.get('parkingId') ?? usuario.parkingId;

  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});

  const [modalFoto, setModalFoto] = useState(false);
  const [urlFoto, setUrlFoto] = useState('');
  const [subiendoFotos, setSubiendoFotos] = useState(false);
  // ¿Hay dónde guardar archivos (Cloudinary)? Si no, solo queda pegar una URL.
  const { datos: configServidor } = usePedido(() => publico.config(), []);
  const subidaConfigurada = configServidor?.fotos?.configurado !== false;
  const [modalCampo, setModalCampo] = useState(false);
  const [campoNuevo, setCampoNuevo] = useState({ key: '', label: '', tipo: 'TEXTO', requerido: false, opciones: '' });
  const [modalBloqueo, setModalBloqueo] = useState(false);
  const [bloqueoNuevo, setBloqueoNuevo] = useState(null);

  // Eliminación definitiva (solo SUPERADMIN, al final de la pantalla).
  const [modalEliminar, setModalEliminar] = useState(false);
  const [confirmacionBorrado, setConfirmacionBorrado] = useState('');
  const [eliminando, setEliminando] = useState(false);

  const { datos, cargando, error, recargar } = usePedido(
    ({ signal }) =>
      parkingId ? admin.parkings.detalle(parkingId, { signal }) : Promise.resolve(null),
    [parkingId],
  );

  const { datos: datosBloqueos, recargar: recargarBloqueos } = usePedido(
    ({ signal }) => (parkingId ? admin.parkings.bloqueos(parkingId, { signal }) : Promise.resolve(null)),
    [parkingId],
  );

  const parking = datos?.parking;

  // El formulario se inicializa con lo que vino del servidor.
  useEffect(() => {
    if (!parking) return;
    setForm({
      nombre: parking.nombre ?? '',
      descripcion: parking.descripcion ?? '',
      direccion: parking.direccion ?? '',
      barrio: parking.barrio ?? '',
      lat: parking.lat,
      lng: parking.lng,
      telefono: parking.telefono ?? '',
      email: parking.email ?? '',
      whatsappGrupo: parking.whatsappGrupo ?? '',
      capacidadTotal: parking.capacidadTotal ?? 1,
      cubierto: parking.cubierto ?? false,
      tiposVehiculo: parking.tiposVehiculo ?? ['AUTO'],
      servicios: parking.servicios ?? [],
      tipoHorario: tipoDeHorario(parking),
      horarios: parking.horarios ?? {},
      alturaMaximaCm: parking.alturaMaximaCm ?? '',
    });
  }, [parking]);

  const bloqueos = datosBloqueos?.bloqueos ?? [];

  const horarios = form?.horarios ?? {};
  const tipoHorario = tipoDeHorario(form ?? {});
  const abierto24h = tipoHorario === 'ABIERTO_24HS';
  // En este modo el cierre lo marca el evento: no hay hora que editar.
  const cierreConEvento = tipoHorario === 'FIN_EVENTO';

  const set = (cambios) => setForm((f) => ({ ...f, ...cambios }));

  const alternarLista = (lista, valor) =>
    lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];

  const setHorario = (dia, cambios) =>
    setForm((f) => ({
      ...f,
      horarios: { ...f.horarios, [dia]: { ...(f.horarios[dia] ?? {}), ...cambios } },
    }));

  /**
   * Borra el estacionamiento de la plataforma.
   *
   * El backend decide si la fila se borra de verdad o queda anclada por su
   * historial de reservas; desde acá el resultado es el mismo y lo único que
   * se informa es cuántas reservas se conservaron, que es lo que el SUPERADMIN
   * necesita saber para la contabilidad.
   */
  const eliminarDefinitivamente = async () => {
    setEliminando(true);
    try {
      const r = await admin.parkings.eliminarDefinitivo(parkingId, {
        confirmacion: confirmacionBorrado,
      });
      setModalEliminar(false);
      toast.ok(
        r?.reservasConservadas > 0
          ? `Eliminado. Se conservaron ${r.reservasConservadas} reservas para la contabilidad.`
          : 'Eliminado de la plataforma.',
      );
      navegar('/panel/estacionamientos', { replace: true });
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    } finally {
      setEliminando(false);
    }
  };

  const guardar = async (e) => {
    e.preventDefault();

    const nuevos = {};
    if (!form.nombre.trim()) nuevos.nombre = textos.errores.campoObligatorio;
    if (!form.direccion.trim()) nuevos.direccion = textos.errores.campoObligatorio;
    if (!form.capacidadTotal || Number(form.capacidadTotal) < 1) {
      nuevos.capacidadTotal = 'La capacidad tiene que ser al menos 1';
    }
    if (form.tiposVehiculo.length === 0) {
      nuevos.tiposVehiculo = 'Elegí al menos un tipo de vehículo';
    }

    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setGuardando(true);
    try {
      await admin.parkings.editar(parkingId, {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || undefined,
        direccion: form.direccion.trim(),
        barrio: form.barrio.trim() || undefined,
        lat: Number(form.lat),
        lng: Number(form.lng),
        telefono: form.telefono.trim() || undefined,
        email: form.email.trim() || undefined,
        whatsappGrupo: form.whatsappGrupo.trim() || undefined,
        capacidadTotal: Number(form.capacidadTotal),
        cubierto: form.cubierto,
        tiposVehiculo: form.tiposVehiculo,
        servicios: form.servicios,
        tipoHorario: form.tipoHorario,
        horarios: form.horarios,
        alturaMaximaCm: form.alturaMaximaCm === '' ? null : Number(form.alturaMaximaCm),
      });
      toast.ok(textos.admin.miEstacionamiento.guardado);
      recargar();
    } catch (err) {
      toast.error(err.message ?? textos.errores.generico);
      const deCampo = err.erroresDeCampo ?? {};
      if (Object.keys(deCampo).length > 0) setErrores(deCampo);
    } finally {
      setGuardando(false);
    }
  };

  /* ── Fotos ── */
  const agregarFoto = async () => {
    if (!urlFoto.trim()) return;
    try {
      await admin.parkings.agregarFoto(parkingId, {
        url: urlFoto.trim(),
        portada: (parking.fotos?.length ?? 0) === 0,
      });
      setUrlFoto('');
      setModalFoto(false);
      recargar();
      toast.ok('Foto agregada');
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    }
  };

  const subirArchivos = async (lista) => {
    const archivos = Array.from(lista ?? []);
    if (archivos.length === 0) return;
    setSubiendoFotos(true);
    try {
      await admin.parkings.subirFotos(parkingId, archivos);
      setModalFoto(false);
      recargar();
      toast.ok(archivos.length === 1 ? 'Foto agregada' : 'Fotos agregadas');
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    } finally {
      setSubiendoFotos(false);
    }
  };

  const borrarFoto = async (foto) => {
    if (!window.confirm('¿Borrar esta foto?')) return;
    try {
      await admin.parkings.borrarFoto(parkingId, foto.id);
      recargar();
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    }
  };

  /* ── Campos extra ── */
  const agregarCampo = async () => {
    try {
      await admin.parkings.crearCampo(parkingId, {
        key: campoNuevo.key.trim(),
        label: campoNuevo.label.trim(),
        tipo: campoNuevo.tipo,
        requerido: campoNuevo.requerido,
        opciones:
          campoNuevo.tipo === 'SELECT'
            ? campoNuevo.opciones.split(',').map((o) => o.trim()).filter(Boolean)
            : [],
      });
      setModalCampo(false);
      setCampoNuevo({ key: '', label: '', tipo: 'TEXTO', requerido: false, opciones: '' });
      recargar();
      toast.ok('Campo agregado');
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    }
  };

  const borrarCampo = async (campo) => {
    if (!window.confirm(`¿Quitar "${campo.label}" del formulario?`)) return;
    try {
      await admin.parkings.borrarCampo(parkingId, campo.id);
      recargar();
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    }
  };

  /* ── Bloqueos ── */
  const abrirBloqueo = () => {
    const desde = new Date();
    desde.setHours(desde.getHours() + 1, 0, 0, 0);
    setBloqueoNuevo({
      desde,
      hasta: new Date(desde.getTime() + 8 * 3_600_000),
      lugares: 1,
      motivo: '',
    });
    setModalBloqueo(true);
  };

  const crearBloqueo = async () => {
    try {
      await admin.parkings.crearBloqueo(parkingId, {
        desde: bloqueoNuevo.desde.toISOString(),
        hasta: bloqueoNuevo.hasta.toISOString(),
        lugares: Number(bloqueoNuevo.lugares),
        motivo: bloqueoNuevo.motivo.trim() || undefined,
      });
      setModalBloqueo(false);
      recargarBloqueos();
      toast.ok('Cupos bloqueados');
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    }
  };

  const borrarBloqueo = async (b) => {
    try {
      await admin.parkings.borrarBloqueo(parkingId, b.id);
      recargarBloqueos();
      toast.ok('Bloqueo eliminado');
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    }
  };

  /* ── Render ── */

  if (!parkingId) {
    return (
      <Vacio
        icono="edificio"
        titulo="No tenés un estacionamiento asignado"
        texto="Elegí uno desde la sección Estacionamientos."
      />
    );
  }

  if (cargando || !form) return <Cargando />;
  if (error) return <ErrorCarga error={error} onReintentar={recargar} />;

  return (
    <>
      <header className="sn-panel__cabecera">
        <div>
          <h1 className="sn-panel__titulo">{parking.nombre}</h1>
          <p className="sn-panel__subtitulo">
            {parking.direccion}
            {parking.barrio && `, ${parking.barrio}`} ·{' '}
            <span className={`sn-badge sn-badge--${parking.publicado ? 'ok' : 'neutro'}`}>
              {parking.publicado
                ? textos.admin.estacionamientos.publicado
                : textos.admin.estacionamientos.noPublicado}
            </span>
          </p>
        </div>
      </header>

      <form onSubmit={guardar}>
        {/* ── Datos generales ── */}
        <section className="sn-panel__seccion">
          <div className="sn-panel__seccion-cabecera">
            <h2 className="sn-panel__seccion-titulo">{textos.admin.miEstacionamiento.datos}</h2>
          </div>
          <div className="sn-panel__seccion-cuerpo sn-est__bloque">
            <Campo
              label="Nombre"
              obligatorio
              value={form.nombre}
              onChange={(e) => set({ nombre: e.target.value })}
              error={errores.nombre}
            />

            <CampoTexto
              label="Descripción"
              rows={3}
              opcional
              ayuda="Lo que ve el cliente en la página del estacionamiento."
              value={form.descripcion}
              onChange={(e) => set({ descripcion: e.target.value })}
            />

            <div className="sn-grilla-campos sn-grilla-campos--3">
              <Campo
                type="tel"
                label="Teléfono"
                value={form.telefono}
                onChange={(e) => set({ telefono: e.target.value })}
              />
              <Campo
                type="email"
                label="Email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
              />
              <Campo
                type="tel"
                label={textos.admin.miEstacionamiento.whatsappGrupo}
                ayuda={textos.admin.miEstacionamiento.whatsappGrupoAyuda}
                placeholder="11 1234 5678"
                value={form.whatsappGrupo}
                onChange={(e) => set({ whatsappGrupo: e.target.value })}
              />
            </div>
          </div>
        </section>

        {/* ── Ubicación ── */}
        <section className="sn-panel__seccion">
          <div className="sn-panel__seccion-cabecera">
            <h2 className="sn-panel__seccion-titulo">{textos.admin.miEstacionamiento.ubicacion}</h2>
          </div>
          <div className="sn-panel__seccion-cuerpo sn-est__bloque">
            <BuscadorDireccion
              label="Buscar la dirección"
              valor={{ nombre: form.direccion, lat: form.lat, lng: form.lng }}
              onChange={(d) => {
                if (!d) return;
                set({ direccion: d.nombre, lat: d.lat, lng: d.lng });
              }}
              placeholder="Humboldt 650, Villa Crespo"
            />

            <p className="sn-est__ayuda">{textos.admin.miEstacionamiento.ubicacionAyuda}</p>

            <div className="sn-grilla-campos sn-grilla-campos--2">
              <Campo
                label="Dirección"
                obligatorio
                value={form.direccion}
                onChange={(e) => set({ direccion: e.target.value })}
                error={errores.direccion}
              />
              <Campo
                label="Barrio"
                value={form.barrio}
                onChange={(e) => set({ barrio: e.target.value })}
              />
            </div>

            <div className="sn-est__mapa">
              {hayMapa ? (
                <Map
                  center={{ lat: Number(form.lat), lng: Number(form.lng) }}
                  defaultZoom={17}
                  mapId={MAP_ID}
                  gestureHandling="cooperative"
                  disableDefaultUI
                  zoomControl
                  className="sn-est__mapa-google"
                  /* Clic en el mapa = mover el marcador: más simple y preciso
                     que arrastrar en un celular. */
                  onClick={(e) => {
                    const pos = e.detail?.latLng;
                    if (pos) set({ lat: pos.lat, lng: pos.lng });
                  }}
                >
                  <AdvancedMarker
                    position={{ lat: Number(form.lat), lng: Number(form.lng) }}
                    draggable
                    onDragEnd={(e) => {
                      const pos = e.latLng;
                      if (pos) set({ lat: pos.lat(), lng: pos.lng() });
                    }}
                  >
                    <span className="sn-est__pin">
                      <Icono nombre="pin" tam={28} />
                    </span>
                  </AdvancedMarker>
                </Map>
              ) : (
                <div className="sn-est__mapa-alt">
                  <Icono nombre="mapa" tam={30} />
                  <span>
                    Configurá <code>VITE_GOOGLE_MAPS_API_KEY</code> para ajustar la ubicación en el
                    mapa. Mientras tanto, cargá las coordenadas a mano.
                  </span>
                </div>
              )}
            </div>

            <div className="sn-grilla-campos sn-grilla-campos--2">
              <Campo
                type="number"
                step="0.000001"
                label="Latitud"
                value={form.lat}
                onChange={(e) => set({ lat: e.target.value })}
              />
              <Campo
                type="number"
                step="0.000001"
                label="Longitud"
                value={form.lng}
                onChange={(e) => set({ lng: e.target.value })}
              />
            </div>
          </div>
        </section>

        {/* ── Operación ── */}
        <section className="sn-panel__seccion">
          <div className="sn-panel__seccion-cabecera">
            <h2 className="sn-panel__seccion-titulo">{textos.admin.miEstacionamiento.operacion}</h2>
          </div>
          <div className="sn-panel__seccion-cuerpo sn-est__bloque">
            <div className="sn-grilla-campos sn-grilla-campos--3">
              <Campo
                type="number"
                min={1}
                label={textos.parking.capacidad}
                ayuda="Cuántos vehículos entran en total."
                obligatorio
                value={form.capacidadTotal}
                onChange={(e) => set({ capacidadTotal: e.target.value })}
                error={errores.capacidadTotal}
              />
              <Campo
                type="number"
                min={100}
                max={500}
                label="Altura máxima (cm)"
                opcional
                value={form.alturaMaximaCm}
                onChange={(e) => set({ alturaMaximaCm: e.target.value })}
              />
              <div className="sn-est__check-alto">
                <CampoCheck
                  label={textos.resultados.cubierto}
                  checked={form.cubierto}
                  onChange={(e) => set({ cubierto: e.target.checked })}
                />
              </div>
            </div>

            <fieldset className="sn-campo">
              <legend className="sn-campo__label">
                {textos.parking.vehiculosAceptados}
                <span className="sn-campo__obligatorio" aria-hidden="true">
                  *
                </span>
              </legend>
              <div className="sn-est__chips">
                {VEHICULOS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`sn-chip ${form.tiposVehiculo.includes(v) ? 'sn-chip--activo' : ''}`}
                    onClick={() => set({ tiposVehiculo: alternarLista(form.tiposVehiculo, v) })}
                    aria-pressed={form.tiposVehiculo.includes(v)}
                  >
                    <Icono nombre={ICONO_VEHICULO[v]} tam={16} />
                    {textos.parking.tiposVehiculo[v]}
                  </button>
                ))}
              </div>
              {errores.tiposVehiculo && (
                <span className="sn-campo__error" role="alert">
                  <Icono nombre="alerta" tam={13} />
                  {errores.tiposVehiculo}
                </span>
              )}
            </fieldset>

            <fieldset className="sn-campo">
              <legend className="sn-campo__label">{textos.parking.serviciosTitulo}</legend>
              <div className="sn-est__chips">
                {SERVICIOS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`sn-chip ${form.servicios.includes(s) ? 'sn-chip--activo' : ''}`}
                    onClick={() => set({ servicios: alternarLista(form.servicios, s) })}
                    aria-pressed={form.servicios.includes(s)}
                  >
                    <Icono nombre={ICONO_SERVICIO[s] ?? 'check'} tam={16} />
                    {textos.parking.servicios[s] ?? s}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </section>

        {/* ── Horarios ── */}
        <section className="sn-panel__seccion">
          <div className="sn-panel__seccion-cabecera">
            <h2 className="sn-panel__seccion-titulo">{textos.parking.horarios}</h2>
          </div>
          <div className="sn-panel__seccion-cuerpo sn-est__bloque">
            {/* Tres modos excluyentes. El JSON `horarios` mantiene
                `abierto24h` sincronizado porque lo leen datos y clientes viejos. */}
            <div className="sn-modos sn-est__modos">
              {textos.registro.horariosModos.map((m) => (
                <label
                  key={m.id}
                  className={`sn-modos__opcion ${form.tipoHorario === m.id ? 'sn-modos__opcion--activa' : ''}`}
                >
                  <input
                    type="radio"
                    name="tipoHorarioPanel"
                    value={m.id}
                    checked={form.tipoHorario === m.id}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        tipoHorario: m.id,
                        horarios: { ...f.horarios, abierto24h: m.id === 'ABIERTO_24HS' },
                      }))
                    }
                    className="sn-modos__radio"
                  />
                  <span className="sn-modos__icono" aria-hidden="true">
                    <Icono nombre={m.icono} tam={19} />
                  </span>
                  <span className="sn-modos__texto">
                    <span className="sn-modos__titulo">{m.titulo}</span>
                    <span className="sn-modos__detalle">{m.texto}</span>
                  </span>
                  <span className="sn-modos__marca" aria-hidden="true">
                    <Icono nombre="check" tam={14} />
                  </span>
                </label>
              ))}
            </div>

            {!abierto24h && (
              <ul className="sn-est__horarios">
                {DIAS.map(([clave, nombre]) => {
                  const dia = horarios[clave] ?? {};
                  const cerrado = dia.cerrado === true;
                  return (
                    <li key={clave} className="sn-est__horario">
                      <span className="sn-est__horario-dia">{nombre}</span>

                      <label className="sn-est__horario-cerrado">
                        <input
                          type="checkbox"
                          checked={cerrado}
                          onChange={(e) => setHorario(clave, { cerrado: e.target.checked })}
                        />
                        {textos.parking.cerrado}
                      </label>

                      <input
                        type="time"
                        className="sn-input sn-est__hora"
                        value={dia.abre ?? '08:00'}
                        disabled={cerrado}
                        onChange={(e) => setHorario(clave, { abre: e.target.value })}
                        aria-label={`Hora de apertura, ${nombre}`}
                      />
                      <span className="sn-est__horario-guion">–</span>
                      {cierreConEvento ? (
                        <span className="sn-est__horario-evento">
                          {textos.registro.cierraConEvento}
                        </span>
                      ) : (
                        <input
                          type="time"
                          className="sn-input sn-est__hora"
                          value={dia.cierra ?? '23:00'}
                          disabled={cerrado}
                          onChange={(e) => setHorario(clave, { cierra: e.target.value })}
                          aria-label={`Hora de cierre, ${nombre}`}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <div className="sn-est__guardar">
          <button
            type="submit"
            className="sn-boton sn-boton--primario sn-boton--lg"
            disabled={guardando}
          >
            {guardando ? (
              <>
                <span className="sn-spinner" style={{ width: 17, height: 17 }} aria-hidden="true" />
                {textos.admin.miEstacionamiento.guardando}
              </>
            ) : (
              <>
                <Icono nombre="check" tam={17} />
                {textos.admin.miEstacionamiento.guardar}
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── Fotos ── */}
      <section className="sn-panel__seccion">
        <div className="sn-panel__seccion-cabecera">
          <h2 className="sn-panel__seccion-titulo">{textos.admin.miEstacionamiento.fotos}</h2>
          <button
            type="button"
            className="sn-boton sn-boton--secundario sn-boton--sm"
            onClick={() => setModalFoto(true)}
          >
            <Icono nombre="mas" tam={15} />
            {textos.admin.miEstacionamiento.agregarFoto}
          </button>
        </div>
        <div className="sn-panel__seccion-cuerpo">
          {parking.fotos?.length > 0 ? (
            <ul className="sn-est__fotos">
              {parking.fotos.map((f) => (
                <li key={f.id} className="sn-est__foto">
                  <img src={f.url} alt={f.alt ?? ''} loading="lazy" />
                  {f.portada && <span className="sn-est__foto-portada">Portada</span>}
                  <button
                    type="button"
                    className="sn-est__foto-borrar"
                    onClick={() => borrarFoto(f)}
                    aria-label="Borrar foto"
                  >
                    <Icono nombre="basura" tam={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sn-silencio">Todavía no cargaste fotos.</p>
          )}
        </div>
      </section>

      {/* ── Campos extra ── */}
      <section className="sn-panel__seccion">
        <div className="sn-panel__seccion-cabecera">
          <h2 className="sn-panel__seccion-titulo">{textos.admin.miEstacionamiento.camposExtra}</h2>
          <button
            type="button"
            className="sn-boton sn-boton--secundario sn-boton--sm"
            onClick={() => setModalCampo(true)}
          >
            <Icono nombre="mas" tam={15} />
            {textos.admin.miEstacionamiento.agregarCampo}
          </button>
        </div>
        <div className="sn-panel__seccion-cuerpo">
          <p className="sn-est__ayuda">{textos.admin.miEstacionamiento.camposExtraAyuda}</p>

          {parking.camposExtra?.length > 0 ? (
            <ul className="sn-est__campos">
              {parking.camposExtra.map((c) => (
                <li key={c.id} className="sn-est__campo">
                  <div>
                    <strong>{c.label}</strong>
                    <small>
                      {c.tipo.toLowerCase()}
                      {c.requerido ? ' · obligatorio' : ' · opcional'}
                      {c.opciones?.length > 0 && ` · ${c.opciones.join(', ')}`}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="sn-tabla-reservas__icono"
                    onClick={() => borrarCampo(c)}
                    aria-label={`Quitar ${c.label}`}
                  >
                    <Icono nombre="basura" tam={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sn-silencio">No hay campos adicionales configurados.</p>
          )}
        </div>
      </section>

      {/* ── Bloqueos ── */}
      <section className="sn-panel__seccion">
        <div className="sn-panel__seccion-cabecera">
          <h2 className="sn-panel__seccion-titulo">{textos.admin.miEstacionamiento.bloqueos}</h2>
          <button
            type="button"
            className="sn-boton sn-boton--secundario sn-boton--sm"
            onClick={abrirBloqueo}
          >
            <Icono nombre="mas" tam={15} />
            {textos.admin.miEstacionamiento.agregarBloqueo}
          </button>
        </div>
        <div className="sn-panel__seccion-cuerpo">
          <p className="sn-est__ayuda">{textos.admin.miEstacionamiento.bloqueosAyuda}</p>

          {bloqueos.length > 0 ? (
            <ul className="sn-est__campos">
              {bloqueos.map((b) => (
                <li key={b.id} className="sn-est__campo">
                  <div>
                    <strong>
                      {b.lugares} {b.lugares === 1 ? 'lugar' : 'lugares'}
                    </strong>
                    <small>
                      {fechaHora(b.desde)} – {fechaHora(b.hasta)}
                      {b.motivo && ` · ${b.motivo}`}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="sn-tabla-reservas__icono"
                    onClick={() => borrarBloqueo(b)}
                    aria-label="Eliminar bloqueo"
                  >
                    <Icono nombre="basura" tam={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sn-silencio">No hay cupos bloqueados.</p>
          )}
        </div>
      </section>

      {esSuperadmin && (
        <Aviso tipo="info">
          Comisión de SpotNear para este estacionamiento:{' '}
          <strong>{parking.comisionPorcentaje}%</strong>. Se cambia desde la sección
          Estacionamientos.
        </Aviso>
      )}

      {/* ── Zona de peligro ──
          Última sección a propósito: hay que pasar por todo el formulario para
          llegar. Solo la ve el SUPERADMIN; el dueño no puede borrar su propio
          estacionamiento de la plataforma. */}
      {esSuperadmin && (
        <section className="sn-panel__seccion sn-peligro">
          <div className="sn-panel__seccion-cabecera">
            <h2 className="sn-panel__seccion-titulo sn-peligro__titulo">
              <Icono nombre="alerta" tam={18} />
              {textos.admin.miEstacionamiento.zonaPeligro}
            </h2>
          </div>
          <div className="sn-panel__seccion-cuerpo sn-peligro__cuerpo">
            <div>
              <p className="sn-peligro__texto">
                {textos.admin.miEstacionamiento.eliminarTexto}
              </p>
              <p className="sn-peligro__nota">
                {textos.admin.miEstacionamiento.eliminarNota}
              </p>
            </div>
            <button
              type="button"
              className="sn-boton sn-boton--peligro"
              onClick={() => {
                setConfirmacionBorrado('');
                setModalEliminar(true);
              }}
            >
              <Icono nombre="basura" tam={16} />
              {textos.admin.miEstacionamiento.eliminar}
            </button>
          </div>
        </section>
      )}

      {/* ═══════════ Modales ═══════════ */}

      <Modal
        abierto={modalEliminar}
        alCerrar={() => setModalEliminar(false)}
        titulo={textos.admin.miEstacionamiento.eliminar}
        ancho={480}
        pie={
          <>
            <button
              type="button"
              className="sn-boton sn-boton--fantasma"
              onClick={() => setModalEliminar(false)}
            >
              {textos.comunes.cancelar}
            </button>
            <button
              type="button"
              className="sn-boton sn-boton--peligro"
              onClick={eliminarDefinitivamente}
              // El nombre exacto es la única llave: sin eso el botón no abre.
              disabled={
                eliminando ||
                confirmacionBorrado.trim().toLocaleLowerCase('es-AR') !==
                  parking.nombre.trim().toLocaleLowerCase('es-AR')
              }
            >
              {eliminando ? textos.comunes.guardando : textos.admin.miEstacionamiento.eliminar}
            </button>
          </>
        }
      >
        <div className="sn-form">
          <Aviso tipo="error">{textos.admin.miEstacionamiento.eliminarAviso}</Aviso>

          <ul className="sn-peligro__lista">
            <li>{textos.admin.miEstacionamiento.eliminarQueSeVa}</li>
            <li>{textos.admin.miEstacionamiento.eliminarQueQueda}</li>
            <li>{textos.admin.miEstacionamiento.eliminarUsuarios}</li>
          </ul>

          <Campo
            label={textos.admin.miEstacionamiento.eliminarConfirmar}
            ayuda={parking.nombre}
            placeholder={parking.nombre}
            value={confirmacionBorrado}
            onChange={(e) => setConfirmacionBorrado(e.target.value)}
            autoComplete="off"
          />
        </div>
      </Modal>

      <Modal
        abierto={modalFoto}
        alCerrar={() => setModalFoto(false)}
        titulo={textos.admin.miEstacionamiento.agregarFoto}
        ancho={460}
        pie={
          <>
            <button type="button" className="sn-boton sn-boton--fantasma" onClick={() => setModalFoto(false)}>
              {textos.comunes.cancelar}
            </button>
            <button type="button" className="sn-boton sn-boton--primario" onClick={agregarFoto}>
              {textos.comunes.agregar}
            </button>
          </>
        }
      >
        {subidaConfigurada ? (
          <label className="sn-est__subir-fotos">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/heic"
              multiple
              disabled={subiendoFotos}
              onChange={(e) => {
                subirArchivos(e.target.files);
                e.target.value = '';
              }}
            />
            <span className="sn-boton sn-boton--primario">
              {subiendoFotos ? (
                <span className="sn-spinner" style={{ width: 16, height: 16 }} aria-hidden="true" />
              ) : (
                <Icono nombre="camara" tam={17} />
              )}
              {subiendoFotos ? textos.registro.fotosSubiendo : textos.registro.fotosBoton}
            </span>
            <span className="sn-silencio">{textos.registro.fotosLimites(8, 5)}</span>
          </label>
        ) : (
          <Aviso tipo="aviso">
            <strong>{textos.registro.fotosNoConfiguradasTitulo}.</strong> Mientras tanto podés pegar el link
            de una foto publicada en otro lado.
          </Aviso>
        )}
        <Campo
          label={textos.admin.miEstacionamiento.urlFoto}
          placeholder="https://..."
          ayuda="O pegá el link de una foto que ya esté publicada en internet."
          value={urlFoto}
          onChange={(e) => setUrlFoto(e.target.value)}
        />
      </Modal>

      <Modal
        abierto={modalCampo}
        alCerrar={() => setModalCampo(false)}
        titulo={textos.admin.miEstacionamiento.agregarCampo}
        pie={
          <>
            <button type="button" className="sn-boton sn-boton--fantasma" onClick={() => setModalCampo(false)}>
              {textos.comunes.cancelar}
            </button>
            <button type="button" className="sn-boton sn-boton--primario" onClick={agregarCampo}>
              {textos.comunes.agregar}
            </button>
          </>
        }
      >
        <div className="sn-est__bloque">
          <Campo
            label="Etiqueta"
            placeholder="Número de socio"
            obligatorio
            value={campoNuevo.label}
            onChange={(e) => {
              const label = e.target.value;
              setCampoNuevo((c) => ({
                ...c,
                label,
                // La clave se deriva de la etiqueta para no tener que pensarla.
                key: label
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[̀-ͯ]/g, '')
                  .replace(/[^a-z0-9]+/g, '_')
                  .replace(/^_|_$/g, '')
                  .slice(0, 40),
              }));
            }}
          />

          <Campo
            label="Clave interna"
            ayuda="Se genera sola. Solo minúsculas, números y guiones bajos."
            value={campoNuevo.key}
            onChange={(e) => setCampoNuevo((c) => ({ ...c, key: e.target.value }))}
          />

          <CampoSelect
            label="Tipo"
            value={campoNuevo.tipo}
            onChange={(e) => setCampoNuevo((c) => ({ ...c, tipo: e.target.value }))}
            opciones={[
              { valor: 'TEXTO', etiqueta: 'Texto' },
              { valor: 'NUMERO', etiqueta: 'Número' },
              { valor: 'SELECT', etiqueta: 'Lista de opciones' },
              { valor: 'BOOLEAN', etiqueta: 'Sí / No' },
            ]}
          />

          {campoNuevo.tipo === 'SELECT' && (
            <Campo
              label="Opciones"
              ayuda="Separadas por coma. Ej: Sí, No, No sé"
              value={campoNuevo.opciones}
              onChange={(e) => setCampoNuevo((c) => ({ ...c, opciones: e.target.value }))}
            />
          )}

          <CampoCheck
            label="Es obligatorio"
            checked={campoNuevo.requerido}
            onChange={(e) => setCampoNuevo((c) => ({ ...c, requerido: e.target.checked }))}
          />
        </div>
      </Modal>

      <Modal
        abierto={modalBloqueo}
        alCerrar={() => setModalBloqueo(false)}
        titulo={textos.admin.miEstacionamiento.agregarBloqueo}
        pie={
          <>
            <button type="button" className="sn-boton sn-boton--fantasma" onClick={() => setModalBloqueo(false)}>
              {textos.comunes.cancelar}
            </button>
            <button type="button" className="sn-boton sn-boton--primario" onClick={crearBloqueo}>
              {textos.comunes.confirmar}
            </button>
          </>
        }
      >
        {bloqueoNuevo && (
          <div className="sn-est__bloque">
            <div className="sn-grilla-campos sn-grilla-campos--2">
              <Campo
                type="datetime-local"
                label="Desde"
                value={paraInputDateTime(bloqueoNuevo.desde)}
                onChange={(e) =>
                  setBloqueoNuevo((b) => ({ ...b, desde: new Date(e.target.value) }))
                }
              />
              <Campo
                type="datetime-local"
                label="Hasta"
                min={paraInputDateTime(bloqueoNuevo.desde)}
                value={paraInputDateTime(bloqueoNuevo.hasta)}
                onChange={(e) => setBloqueoNuevo((b) => ({ ...b, hasta: new Date(e.target.value) }))}
              />
            </div>

            <Campo
              type="number"
              min={1}
              max={form.capacidadTotal}
              label="Lugares a bloquear"
              ayuda={`El estacionamiento tiene ${form.capacidadTotal} lugares.`}
              value={bloqueoNuevo.lugares}
              onChange={(e) => setBloqueoNuevo((b) => ({ ...b, lugares: e.target.value }))}
            />

            <Campo
              label="Motivo"
              opcional
              placeholder="Mantenimiento del nivel 2"
              value={bloqueoNuevo.motivo}
              onChange={(e) => setBloqueoNuevo((b) => ({ ...b, motivo: e.target.value }))}
            />
          </div>
        )}
      </Modal>
    </>
  );
}

export default MiEstacionamiento;
