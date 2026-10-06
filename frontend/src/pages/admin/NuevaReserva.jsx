/**
 * Alta manual de una reserva desde el panel.
 *
 * Es el reemplazo directo del cuaderno: la reserva llegó por teléfono o por
 * WhatsApp y hay que dejarla registrada. A diferencia del checkout público,
 * acá se puede cargar un horario que ya pasó.
 */
import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Campo, CampoTexto, CampoSelect, CampoOpciones } from '../../components/ui/Campo.jsx';
import { Icono, ICONO_VEHICULO } from '../../components/ui/Iconos.jsx';
import { Aviso } from '../../components/ui/Varios.jsx';
import { Cargando } from '../../components/ui/Estado.jsx';
import ModalWhatsApp from '../../components/admin/ModalWhatsApp.jsx';
import { admin, publico } from '../../services/spotnear.service.js';
import { usePedido, useTitulo } from '../../hooks/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { validarReserva, sinErrores, normalizarPatente, validarRango } from '../../utils/validaciones.js';
import { paraInputDateTime, precio as fmtPrecio } from '../../utils/formato.js';
import textos from '../../i18n/textos.js';
import './NuevaReserva.css';

const TIPOS_VEHICULO = ['AUTO', 'SUV', 'CAMIONETA', 'MOTO', 'UTILITARIO'];

/** Por defecto: desde la próxima hora en punto, por 4 horas. */
function periodoInicial() {
  const inicio = new Date();
  inicio.setMinutes(0, 0, 0);
  inicio.setHours(inicio.getHours() + 1);
  return { inicio, fin: new Date(inicio.getTime() + 4 * 3_600_000) };
}

export function NuevaReserva() {
  const navegar = useNavigate();
  const toast = useToast();
  const { usuario, esSuperadmin } = useAuth();

  useTitulo(textos.admin.nuevaReserva.titulo);

  const [periodo, setPeriodo] = useState(periodoInicial);
  const [parkingId, setParkingId] = useState(usuario.parkingId ?? '');
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    email: '',
    patente: '',
    tipoVehiculo: 'AUTO',
    marca: '',
    modelo: '',
    color: '',
    cantidadVehiculos: 1,
    notas: '',
    source: 'WHATSAPP',
    camposExtra: {},
  });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [creada, setCreada] = useState(null);
  const [whatsapp, setWhatsapp] = useState({ abierto: false, mensaje: '', link: '' });

  /* ── Estacionamientos (el SUPERADMIN elige) ── */
  const { datos: datosParkings, cargando: cargandoParkings } = usePedido(
    ({ signal }) => admin.parkings.listar({}, { signal }),
    [],
  );
  // Memorizado: si no, el `?? []` devuelve un array nuevo en cada render y
  // vuelve a disparar el useMemo que busca el estacionamiento elegido.
  const parkings = useMemo(() => datosParkings?.parkings ?? [], [datosParkings]);

  const parkingElegido = useMemo(
    () => parkings.find((p) => p.id === parkingId) ?? null,
    [parkings, parkingId],
  );

  /* ── Cotización en vivo ── */
  const { datos: cotizacion } = usePedido(
    ({ signal }) =>
      publico.cotizar(
        parkingId,
        {
          inicio: periodo.inicio.toISOString(),
          fin: periodo.fin.toISOString(),
          tipoVehiculo: form.tipoVehiculo,
          cantidadVehiculos: Number(form.cantidadVehiculos) || 1,
        },
        { signal },
      ),
    [
      parkingId,
      periodo.inicio.toISOString(),
      periodo.fin.toISOString(),
      form.tipoVehiculo,
      form.cantidadVehiculos,
    ],
    { inmediato: Boolean(parkingId) && periodo.fin > periodo.inicio },
  );

  const set = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErrores((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
    setErrorGeneral(null);
  };

  const cambiarFecha = (cual, valor) => {
    if (!valor) return;
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return;

    setPeriodo((p) => {
      if (cual === 'inicio') {
        // Se conserva la duración elegida al mover el ingreso.
        const nuevoFin = p.fin <= fecha ? new Date(fecha.getTime() + (p.fin - p.inicio)) : p.fin;
        return { inicio: fecha, fin: nuevoFin };
      }
      return { ...p, fin: fecha };
    });
    setErrores((e) => ({ ...e, periodo: undefined }));
  };

  const enviar = async (e) => {
    e.preventDefault();

    const nuevos = validarReserva(form, parkingElegido?.camposExtra ?? []);
    if (!parkingId) nuevos.parkingId = textos.errores.campoObligatorio;
    const errorRango = validarRango(periodo.inicio, periodo.fin);
    if (errorRango) nuevos.periodo = errorRango;

    setErrores(nuevos);
    if (!sinErrores(nuevos)) return;

    setEnviando(true);
    setErrorGeneral(null);

    try {
      const r = await admin.reservas.crear({
        parkingId,
        inicio: periodo.inicio.toISOString(),
        fin: periodo.fin.toISOString(),
        cliente: {
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          telefono: form.telefono.trim(),
          email: form.email.trim() || undefined,
        },
        vehiculo: {
          patente: normalizarPatente(form.patente),
          tipo: form.tipoVehiculo,
          marca: form.marca.trim() || undefined,
          modelo: form.modelo.trim() || undefined,
          color: form.color.trim() || undefined,
        },
        cantidadVehiculos: Number(form.cantidadVehiculos) || 1,
        notas: form.notas.trim() || undefined,
        camposExtra: form.camposExtra,
        source: form.source,
      });

      toast.ok(`${textos.admin.nuevaReserva.creada}: ${r.reserva.codigo}`);
      setCreada(r);
      // Se abre directo el mensaje para el grupo: es lo que el encargado
      // hace inmediatamente después de cargarla.
      setWhatsapp({ abierto: true, mensaje: '', link: r.links.whatsappGrupo });

      const mensaje = await admin.reservas.whatsapp(r.reserva.id, 'grupo').catch(() => null);
      if (mensaje) setWhatsapp({ abierto: true, mensaje: mensaje.mensaje, link: mensaje.link });
    } catch (error) {
      setErrorGeneral(error);
      const deCampo = error.erroresDeCampo ?? {};
      if (Object.keys(deCampo).length > 0) setErrores(deCampo);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setEnviando(false);
    }
  };

  if (cargandoParkings) return <Cargando />;

  return (
    <>
      <header className="sn-panel__cabecera">
        <div>
          <button type="button" className="sn-detalle-reserva__volver" onClick={() => navegar(-1)}>
            <Icono nombre="flechaIzquierda" tam={15} />
            {textos.admin.detalleReserva.volver}
          </button>
          <h1 className="sn-panel__titulo">{textos.admin.nuevaReserva.titulo}</h1>
          <p className="sn-panel__subtitulo">{textos.admin.nuevaReserva.subtitulo}</p>
        </div>
      </header>

      {creada && (
        <Aviso tipo="ok">
          Reserva <strong className="sn-mono">{creada.reserva.codigo}</strong> creada.{' '}
          <Link to={`/panel/reservas/${creada.reserva.id}`} className="sn-link">
            Ver el detalle
          </Link>{' '}
          o{' '}
          <button
            type="button"
            className="sn-link sn-nueva__link"
            onClick={() => {
              setCreada(null);
              setForm((f) => ({
                ...f,
                nombre: '',
                apellido: '',
                telefono: '',
                email: '',
                patente: '',
                marca: '',
                modelo: '',
                color: '',
                notas: '',
              }));
            }}
          >
            cargar otra
          </button>
          .
        </Aviso>
      )}

      {errorGeneral && (
        <Aviso tipo="error">
          {errorGeneral.codigo === 'SIN_CUPO'
            ? 'No quedan lugares en ese horario. Revisá la capacidad o elegí otro rango.'
            : errorGeneral.message}
        </Aviso>
      )}

      <form className="sn-nueva" onSubmit={enviar} noValidate>
        <div className="sn-nueva__columna">
          {/* ── Reserva ── */}
          <section className="sn-panel__seccion">
            <div className="sn-panel__seccion-cabecera">
              <h2 className="sn-panel__seccion-titulo">Reserva</h2>
            </div>
            <div className="sn-panel__seccion-cuerpo sn-nueva__bloque">
              {esSuperadmin && (
                <CampoSelect
                  label="Estacionamiento"
                  obligatorio
                  value={parkingId}
                  onChange={(e) => setParkingId(e.target.value)}
                  placeholder="Elegí un estacionamiento"
                  error={errores.parkingId}
                  opciones={parkings.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
                />
              )}

              <div className="sn-grilla-campos sn-grilla-campos--2">
                <Campo
                  type="datetime-local"
                  label={textos.comprobante.ingreso}
                  obligatorio
                  value={paraInputDateTime(periodo.inicio)}
                  onChange={(e) => cambiarFecha('inicio', e.target.value)}
                />
                <Campo
                  type="datetime-local"
                  label={textos.comprobante.salida}
                  obligatorio
                  min={paraInputDateTime(periodo.inicio)}
                  value={paraInputDateTime(periodo.fin)}
                  onChange={(e) => cambiarFecha('fin', e.target.value)}
                  error={errores.periodo}
                />
              </div>

              <CampoSelect
                label={textos.admin.nuevaReserva.origen}
                value={form.source}
                onChange={(e) => set('source', e.target.value)}
                opciones={Object.entries(textos.admin.nuevaReserva.origenes).map(([valor, etiqueta]) => ({
                  valor,
                  etiqueta,
                }))}
              />
            </div>
          </section>

          {/* ── Cliente ── */}
          <section className="sn-panel__seccion">
            <div className="sn-panel__seccion-cabecera">
              <h2 className="sn-panel__seccion-titulo">{textos.checkout.datosCliente}</h2>
            </div>
            <div className="sn-panel__seccion-cuerpo sn-nueva__bloque">
              <div className="sn-grilla-campos sn-grilla-campos--2">
                <Campo
                  name="nombre"
                  label={textos.checkout.nombre}
                  obligatorio
                  value={form.nombre}
                  onChange={(e) => set('nombre', e.target.value)}
                  error={errores.nombre}
                />
                <Campo
                  name="apellido"
                  label={textos.checkout.apellido}
                  obligatorio
                  value={form.apellido}
                  onChange={(e) => set('apellido', e.target.value)}
                  error={errores.apellido}
                />
              </div>

              <div className="sn-grilla-campos sn-grilla-campos--2">
                <Campo
                  name="telefono"
                  type="tel"
                  inputMode="tel"
                  label={textos.checkout.telefono}
                  placeholder="11 1234 5678"
                  obligatorio
                  value={form.telefono}
                  onChange={(e) => set('telefono', e.target.value)}
                  error={errores.telefono}
                />
                <Campo
                  name="email"
                  type="email"
                  label={textos.checkout.email}
                  opcional
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  error={errores.email}
                />
              </div>
            </div>
          </section>

          {/* ── Vehículo ── */}
          <section className="sn-panel__seccion">
            <div className="sn-panel__seccion-cabecera">
              <h2 className="sn-panel__seccion-titulo">{textos.checkout.datosVehiculo}</h2>
            </div>
            <div className="sn-panel__seccion-cuerpo sn-nueva__bloque">
              <Campo
                name="patente"
                label={textos.checkout.patente}
                placeholder="AB123CD"
                obligatorio
                maxLength={10}
                claseInput="sn-input--patente"
                value={form.patente}
                onChange={(e) => set('patente', e.target.value.toUpperCase())}
                error={errores.patente}
              />

              <CampoOpciones
                name="tipoVehiculo"
                label={textos.checkout.tipoVehiculo}
                obligatorio
                valor={form.tipoVehiculo}
                onChange={(v) => set('tipoVehiculo', v)}
                opciones={TIPOS_VEHICULO.filter(
                  (t) => !parkingElegido || parkingElegido.tiposVehiculo.includes(t),
                ).map((t) => ({
                  valor: t,
                  etiqueta: textos.parking.tiposVehiculo[t],
                  icono: ICONO_VEHICULO[t],
                }))}
              />

              <div className="sn-grilla-campos sn-grilla-campos--3">
                <Campo
                  label={textos.checkout.marca}
                  value={form.marca}
                  onChange={(e) => set('marca', e.target.value)}
                />
                <Campo
                  label={textos.checkout.modelo}
                  value={form.modelo}
                  onChange={(e) => set('modelo', e.target.value)}
                />
                <Campo
                  label={textos.checkout.color}
                  value={form.color}
                  onChange={(e) => set('color', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* ── Extras ── */}
          <section className="sn-panel__seccion">
            <div className="sn-panel__seccion-cabecera">
              <h2 className="sn-panel__seccion-titulo">{textos.checkout.opcionales}</h2>
            </div>
            <div className="sn-panel__seccion-cuerpo sn-nueva__bloque">
              <Campo
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                label={textos.checkout.cantidadVehiculos}
                value={form.cantidadVehiculos}
                onChange={(e) => set('cantidadVehiculos', e.target.value)}
                error={errores.cantidadVehiculos}
              />

              <CampoTexto
                label={textos.checkout.notas}
                rows={3}
                maxLength={500}
                value={form.notas}
                onChange={(e) => set('notas', e.target.value)}
              />
            </div>
          </section>
        </div>

        {/* ── Resumen ── */}
        <aside className="sn-nueva__resumen">
          <div className="sn-nueva__caja">
            <h2 className="sn-nueva__caja-titulo">{textos.checkout.resumen}</h2>

            {cotizacion ? (
              <>
                {/* El dueño ve lo que cobra en el lugar; el total con la seña
                    de SpotNear es información interna (solo SUPERADMIN). */}
                <div className="sn-nueva__precio">
                  <span>{fmtPrecio(esSuperadmin ? cotizacion.precioTotal : cotizacion.aPagarEnElLugar)}</span>
                  <small>
                    {esSuperadmin ? cotizacion.desglose.etiqueta : `${textos.admin.comisiones.aCobrar} · ${cotizacion.desglose.etiqueta}`}
                  </small>
                </div>

                <div
                  className={`sn-nueva__cupo ${cotizacion.disponibilidad.hayLugar ? '' : 'sn-nueva__cupo--sin'}`}
                >
                  <Icono
                    nombre={cotizacion.disponibilidad.hayLugar ? 'checkCirculo' : 'alerta'}
                    tam={16}
                  />
                  {cotizacion.disponibilidad.hayLugar
                    ? `${cotizacion.disponibilidad.libres} lugares libres en ese horario`
                    : 'No hay lugares en ese horario'}
                </div>
              </>
            ) : (
              <p className="sn-silencio">Elegí estacionamiento y horario para ver el precio.</p>
            )}

            <button
              type="submit"
              className="sn-boton sn-boton--primario sn-boton--lg sn-boton--bloque"
              disabled={enviando}
            >
              {enviando ? (
                <>
                  <span className="sn-spinner" style={{ width: 17, height: 17 }} aria-hidden="true" />
                  {textos.admin.nuevaReserva.guardando}
                </>
              ) : (
                <>
                  <Icono nombre="mas" tam={17} />
                  {textos.admin.nuevaReserva.guardar}
                </>
              )}
            </button>
          </div>
        </aside>
      </form>

      <ModalWhatsApp
        abierto={whatsapp.abierto}
        alCerrar={() => setWhatsapp({ abierto: false, mensaje: '', link: '' })}
        titulo={textos.admin.detalleReserva.compartirGrupo}
        mensaje={whatsapp.mensaje}
        link={whatsapp.link}
        cargando={!whatsapp.mensaje}
      />
    </>
  );
}

export default NuevaReserva;
