/**
 * Checkout: "Terminá tu reserva".
 *
 * Dos pasos —datos y confirmación— con el resumen siempre a la vista.
 * Se reserva como invitado: no hace falta crear cuenta ni cargar tarjeta.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Campo, CampoOpciones } from '../components/ui/Campo.jsx';
import { Icono, ICONO_VEHICULO } from '../components/ui/Iconos.jsx';
import { Cargando, ErrorCarga, Vacio } from '../components/ui/Estado.jsx';
import { Aviso } from '../components/ui/Varios.jsx';
import { publico } from '../services/spotnear.service.js';
import { usePedido, useTitulo } from '../hooks/index.js';
import { periodoPorDefecto } from '../hooks/useBusqueda.js';
import {
  validarReserva,
  sinErrores,
  normalizarPatente,
  normalizarTelefono,
} from '../utils/validaciones.js';
import {
  precio as fmtPrecio,
  fechaLarga,
  hora,
  duracion,
  patente as fmtPatente,
  telefono as fmtTelefono,
} from '../utils/formato.js';
import textos from '../i18n/textos.js';
import './Checkout.css';

/**
 * Orden en que se le ofrecen los tipos al cliente. Es el mismo en todas las
 * pantallas del producto (filtros, panel, tarifas) para que nadie tenga que
 * volver a buscar dónde quedó su vehículo. No tiene nada que ver con las
 * tarifas, que cada estacionamiento define por tipo.
 */
const TIPOS_VEHICULO = ['AUTO', 'SUV', 'CAMIONETA', 'MOTO', 'UTILITARIO'];

/** Imagen que se muestra cuando el estacionamiento todavía no cargó fotos. */
const FOTO_POR_DEFECTO = '/assets/parkings/sin-foto.svg';

const FORM_INICIAL = {
  nombre: '',
  apellido: '',
  telefono: '',
  email: '',
  patente: '',
  tipoVehiculo: 'AUTO',
  marca: '',
  modelo: '',
  color: '',
};

export function Checkout() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navegar = useNavigate();

  useTitulo(textos.checkout.titulo);

  const periodo = useMemo(() => {
    const porDefecto = periodoPorDefecto();
    return {
      inicio: params.get('inicio') ? new Date(params.get('inicio')) : porDefecto.inicio,
      fin: params.get('fin') ? new Date(params.get('fin')) : porDefecto.fin,
    };
  }, [params]);

  const [form, setForm] = useState(() => ({
    ...FORM_INICIAL,
    tipoVehiculo: params.get('tipoVehiculo') ?? 'AUTO',
  }));
  const [paso, setPaso] = useState(1);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);

  /**
   * Clave de este intento de reserva.
   *
   * Se genera una sola vez por visita al checkout, así todos los reintentos
   * —los automáticos del cliente HTTP y los que haga el usuario tocando el
   * botón de nuevo— cuentan como el MISMO pedido y el servidor no crea dos
   * reservas.
   */
  const claveIntento = useRef(
    globalThis.crypto?.randomUUID?.() ?? `r-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const [errorEnvio, setErrorEnvio] = useState(null);

  /* ── Datos del estacionamiento ── */
  const { datos, cargando, error, recargar } = usePedido(
    ({ signal }) =>
      publico.detalleParking(
        slug,
        {
          inicio: periodo.inicio.toISOString(),
          fin: periodo.fin.toISOString(),
          tipoVehiculo: form.tipoVehiculo,
        },
        { signal },
      ),
    [
      slug,
      periodo.inicio.toISOString(),
      periodo.fin.toISOString(),
      form.tipoVehiculo,
    ],
  );

  /* ── Configuración del servidor: si el cobro es online y si es simulado ── */
  const { datos: config } = usePedido(() => publico.config(), []);

  /**
   * Con Mercado Pago el email es obligatorio. Sin él, su checkout lo pide en la
   * pantalla de revisión y, si queda vacío, el botón "Pagar" no hace nada —ni
   * error ni aviso—. Pedirlo acá, con validación y un mensaje claro, evita que
   * el cliente llegue a un botón muerto.
   */
  const emailObligatorio = Boolean(config?.pago?.cobroPrevio);

  const parking = datos?.parking;

  // Si el estacionamiento no acepta el tipo elegido, se vuelve al primero válido.
  useEffect(() => {
    if (parking && !parking.tiposVehiculo.includes(form.tipoVehiculo)) {
      setForm((f) => ({ ...f, tipoVehiculo: parking.tiposVehiculo[0] ?? 'AUTO' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parking?.id]);

  const set = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    // El error del campo se limpia apenas el usuario lo corrige.
    setErrores((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  };

  const continuar = (e) => {
    e.preventDefault();
    const nuevos = validarReserva(form);
    if (emailObligatorio && !form.email.trim()) nuevos.email = textos.checkout.emailObligatorio;
    setErrores(nuevos);

    if (!sinErrores(nuevos)) {
      // Se lleva el foco al primer campo con problema.
      const primero = Object.keys(nuevos)[0];
      document.querySelector(`[name="${primero}"]`)?.focus();
      return;
    }
    setPaso(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmar = async () => {
    setEnviando(true);
    setErrorEnvio(null);

    try {
      const resultado = await publico.crearReserva({
        parkingId: parking.id,
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
        idempotencyKey: claveIntento.current,
      });

      // ── Hay que pagar la seña antes de que la reserva exista ──
      //
      // La reserva quedó creada en estado pendiente (sin seña no es reserva), y
      // todavía no hay comprobante. Se manda al checkout de la pasarela; vuelve
      // a /pago/:token, que es la pantalla que espera la acreditación.
      if (resultado.pago?.requerido) {
        // Dos pasos explícitos: acá la reserva queda pendiente y el cliente pasa
        // a la pantalla de pago, donde lee que le falta pagar la seña. Recién
        // cuando aprieta "Pagar la seña" se arma el checkout y sale a Mercado
        // Pago. Nada lo redirige solo ni con temporizador.
        //
        // Con `replace`, además, esa pantalla queda en el historial en lugar
        // de este formulario: el botón "atrás" desde Mercado Pago cae ahí, que
        // es la que sabe esperar la acreditación y mostrar el comprobante.
        navegar(`/pago/${resultado.reserva.publicToken}`, { replace: true });
        return;
      }

      // El comprobante ya viene en la respuesta: se pasa por state para que
      // la pantalla siguiente no tenga que volver a pedirlo.
      navegar(`/comprobante/${resultado.reserva.publicToken}`, {
        replace: true,
        state: { comprobante: resultado, recienCreada: true },
      });
    } catch (e) {
      setErrorEnvio(e);

      // Errores de validación del servidor: se marcan en los campos.
      const deCampo = e.erroresDeCampo ?? {};
      if (Object.keys(deCampo).length > 0) {
        setErrores(deCampo);
        setPaso(1);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) return <Cargando texto="Preparando tu reserva..." />;

  if (error) {
    return (
      <div className="sn-contenedor sn-seccion">
        <ErrorCarga error={error} onReintentar={recargar} />
      </div>
    );
  }

  if (!parking) return null;

  const sinLugar = parking.disponibilidad && !parking.disponibilidad.hayLugar;

  /**
   * La pasarela no está en condiciones de cobrar (típicamente: faltan las
   * credenciales de Mercado Pago). Mientras `config` no llegó se asume que sí,
   * para no parpadear un error que probablemente no exista.
   */
  const pagoNoDisponible = config ? config.pago?.disponible === false : false;

  if (sinLugar) {
    return (
      <div className="sn-contenedor sn-seccion">
        <Vacio
          icono="sinLugar"
          titulo={textos.parking.noDisponible}
          texto={textos.checkout.sinCupo}
          accion={
            <Link to="/" className="sn-boton sn-boton--primario">
              {textos.checkout.volverABuscar}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="sn-checkout">
      <div className="sn-contenedor">
        <h1 className="sn-checkout__titulo">{textos.checkout.titulo}</h1>

        <div className="sn-checkout__grilla">
          {/* ═══════════ Columna izquierda: formulario ═══════════ */}
          <div className="sn-checkout__columna">
            <div className="sn-checkout__invitado">
              <Icono nombre="usuario" tam={17} />
              {textos.checkout.invitado}
            </div>

            <ol className="sn-checkout__pasos">
              {[textos.checkout.paso1, textos.checkout.paso2].map((etiqueta, i) => (
                <li
                  key={etiqueta}
                  className={`sn-checkout__paso ${paso === i + 1 ? 'sn-checkout__paso--activo' : ''} ${paso > i + 1 ? 'sn-checkout__paso--hecho' : ''}`}
                >
                  <span className="sn-checkout__paso-num">
                    {paso > i + 1 ? <Icono nombre="check" tam={13} /> : i + 1}
                  </span>
                  {etiqueta}
                </li>
              ))}
            </ol>

            {errorEnvio && (
              <Aviso tipo="error">
                {errorEnvio.codigo === 'SIN_CUPO' ? textos.checkout.sinCupo : errorEnvio.message}
              </Aviso>
            )}

            {paso === 1 ? (
              <form className="sn-checkout__form" onSubmit={continuar} noValidate autoComplete="off">
                {/* autoComplete="off" en el form y en cada campo: el navegador no
                    ofrece sus sugerencias guardadas (nombres, teléfonos,
                    direcciones) acá. No afecta al buscador de direcciones de
                    Google Places, que es otro componente y en otra pantalla. */}

                {/* ── Cliente ── */}
                <section className="sn-checkout__bloque">
                  <h2 className="sn-checkout__bloque-titulo">{textos.checkout.datosCliente}</h2>

                  <div className="sn-grilla-campos sn-grilla-campos--2">
                    <Campo
                      name="nombre"
                      label={textos.checkout.nombre}
                      obligatorio
                      autoComplete="off"
                      value={form.nombre}
                      onChange={(e) => set('nombre', e.target.value)}
                      error={errores.nombre}
                    />
                    <Campo
                      name="apellido"
                      label={textos.checkout.apellido}
                      obligatorio
                      autoComplete="off"
                      value={form.apellido}
                      onChange={(e) => set('apellido', e.target.value)}
                      error={errores.apellido}
                    />
                  </div>

                  <Campo
                    name="telefono"
                    type="tel"
                    inputMode="tel"
                    label={textos.checkout.telefono}
                    ayuda={textos.checkout.telefonoAyuda}
                    placeholder="11 1234 5678"
                    obligatorio
                    autoComplete="off"
                    value={form.telefono}
                    onChange={(e) => set('telefono', e.target.value)}
                    error={errores.telefono}
                  />

                  <Campo
                    name="email"
                    type="email"
                    label={textos.checkout.email}
                    ayuda={emailObligatorio ? textos.checkout.emailAyudaPago : textos.checkout.emailAyuda}
                    placeholder="tucorreo@ejemplo.com"
                    opcional={!emailObligatorio}
                    obligatorio={emailObligatorio}
                    autoComplete="off"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    error={errores.email}
                  />
                </section>

                {/* ── Vehículo ── */}
                <section className="sn-checkout__bloque">
                  <h2 className="sn-checkout__bloque-titulo">{textos.checkout.datosVehiculo}</h2>

                  <Campo
                    name="patente"
                    autoComplete="off"
                    label={textos.checkout.patente}
                    ayuda={textos.checkout.patenteAyuda}
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
                    error={errores.tipoVehiculo}
                    opciones={TIPOS_VEHICULO.filter((t) => parking.tiposVehiculo.includes(t)).map(
                      (t) => ({
                        valor: t,
                        etiqueta: textos.parking.tiposVehiculo[t],
                        icono: ICONO_VEHICULO[t],
                      }),
                    )}
                  />

                  <div className="sn-grilla-campos sn-grilla-campos--3">
                    <Campo
                      name="marca"
                    autoComplete="off"
                      label={textos.checkout.marca}
                      placeholder="Toyota"
                      value={form.marca}
                      onChange={(e) => set('marca', e.target.value)}
                    />
                    <Campo
                      name="modelo"
                    autoComplete="off"
                      label={textos.checkout.modelo}
                      placeholder="Corolla"
                      value={form.modelo}
                      onChange={(e) => set('modelo', e.target.value)}
                    />
                    <Campo
                      name="color"
                    autoComplete="off"
                      label={textos.checkout.color}
                      placeholder="Gris"
                      value={form.color}
                      onChange={(e) => set('color', e.target.value)}
                    />
                  </div>
                </section>


                <button type="submit" className="sn-boton sn-boton--primario sn-boton--lg sn-boton--bloque">
                  {textos.checkout.continuar}
                  <Icono nombre="flechaDerecha" tam={17} />
                </button>
              </form>
            ) : (
              /* ═══════════ Paso 2: confirmación ═══════════ */
              <div className="sn-checkout__form">
                <section className="sn-checkout__bloque">
                  <h2 className="sn-checkout__bloque-titulo">{textos.checkout.revisa}</h2>

                  <dl className="sn-checkout__revision">
                    <div>
                      <dt>{textos.comprobante.aNombreDe}</dt>
                      <dd>
                        {form.nombre} {form.apellido}
                      </dd>
                    </div>
                    <div>
                      <dt>{textos.comprobante.telefono}</dt>
                      {/* Se muestra ya normalizado: es el número que se va a guardar
                          y al que va a llegar el WhatsApp. */}
                      <dd>{fmtTelefono(normalizarTelefono(form.telefono) ?? form.telefono)}</dd>
                    </div>
                    {form.email && (
                      <div>
                        <dt>{textos.checkout.email}</dt>
                        <dd>{form.email}</dd>
                      </div>
                    )}
                    <div>
                      <dt>{textos.comprobante.patente}</dt>
                      <dd className="sn-codigo">{fmtPatente(form.patente)}</dd>
                    </div>
                    <div>
                      <dt>{textos.comprobante.vehiculo}</dt>
                      <dd>
                        {[textos.parking.tiposVehiculo[form.tipoVehiculo], form.marca, form.modelo, form.color]
                          .filter(Boolean)
                          .join(' · ')}
                      </dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    className="sn-boton sn-boton--fantasma sn-boton--sm sn-checkout__editar"
                    onClick={() => setPaso(1)}
                  >
                    <Icono nombre="editar" tam={15} />
                    Corregir datos
                  </button>
                </section>

                <Aviso tipo="info">
                  Para reservar tu lugar pagás una seña de{' '}
                  <strong>{fmtPrecio(parking.precio?.aPagarAhora)}</strong>, y el
                  lugar queda reservado cuando se acredita. La seña no se devuelve. Los{' '}
                  <strong>{fmtPrecio(parking.precio?.aPagarEnElLugar)}</strong> restantes se los
                  pagás al estacionamiento cuando llegues.
                </Aviso>

                {/* Sin credenciales de la pasarela no se puede cobrar la seña, y
                    sin seña no hay reserva. Se dice acá y se bloquea el botón:
                    dejarlo apretable sería hacerle perder el tiempo al cliente
                    para mostrarle un error después. */}
                {pagoNoDisponible && <Aviso tipo="error">{textos.checkout.pagoNoDisponible}</Aviso>}

                <div className="sn-checkout__acciones">
                  <button
                    type="button"
                    className="sn-boton sn-boton--secundario sn-boton--lg"
                    onClick={() => setPaso(1)}
                    disabled={enviando}
                  >
                    <Icono nombre="flechaIzquierda" tam={17} />
                    {textos.checkout.volver}
                  </button>

                  <button
                    type="button"
                    className="sn-boton sn-boton--primario sn-boton--lg"
                    onClick={confirmar}
                    disabled={enviando || pagoNoDisponible}
                  >
                    {enviando ? (
                      <>
                        <span className="sn-spinner" style={{ width: 17, height: 17 }} aria-hidden="true" />
                        {textos.checkout.confirmando}
                      </>
                    ) : (
                      <>
                        <Icono nombre="checkCirculo" tam={18} />
                        {textos.checkout.confirmar}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ═══════════ Columna derecha: resumen ═══════════ */}
          <aside className="sn-checkout__resumen">
            <div className="sn-checkout__caja">
              {/* La foto arriba de todo: es lo que le confirma al cliente que
                  está reservando en el lugar que eligió y no en otro. Sale de
                  la portada del estacionamiento; si no cargó ninguna, va el
                  placeholder, nunca un hueco. */}
              <div className="sn-checkout__foto">
                <img
                  src={parking.foto || FOTO_POR_DEFECTO}
                  alt={parking.nombre}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = FOTO_POR_DEFECTO;
                  }}
                />
              </div>

              <div className="sn-checkout__parking">
                <h2 className="sn-checkout__parking-nombre">{parking.nombre}</h2>
                <p className="sn-checkout__parking-dir">
                  <Icono nombre="pin" tam={14} />
                  {parking.direccion}
                  {parking.barrio && `, ${parking.barrio}`}
                </p>
              </div>

              <div className="sn-checkout__periodo">
                {/* Solo informativo: el período lo eligió el cliente en la búsqueda. */}
                <div className="sn-checkout__periodo-cabecera">
                  <span>{textos.checkout.periodo}</span>
                </div>
                <p className="sn-checkout__periodo-fechas">
                  {fechaLarga(periodo.inicio)} · {hora(periodo.inicio)}
                  <Icono nombre="flechaDerecha" tam={14} />
                  {fechaLarga(periodo.fin)} · {hora(periodo.fin)}
                </p>
                <span className="sn-checkout__duracion">{duracion(periodo.inicio, periodo.fin)}</span>
              </div>

              {parking.precio && (
                <div className="sn-checkout__precio">
                  <span className="sn-checkout__precio-titulo">{textos.checkout.desglose}</span>

                  {/* Lo que cobra el estacionamiento: entero, sin descuentos.
                      Ese monto lo paga el cliente allá, no acá. */}
                  <div className="sn-checkout__linea">
                    <span>
                      {textos.checkout.enElEstacionamiento}
                      <em className="sn-checkout__detalle">{parking.precio.desglose.etiqueta}</em>
                    </span>
                    <span>{fmtPrecio(parking.precio.desglose.subtotal)}</span>
                  </div>

                  {parking.precio.desglose.cantidadVehiculos > 1 && (
                    <div className="sn-checkout__linea">
                      <span>× {parking.precio.desglose.cantidadVehiculos} vehículos</span>
                      <span />
                    </div>
                  )}

                  {/* La seña se SUMA al valor del estacionamiento, no se le
                      descuenta: el dueño cobra el 100% de su tarifa. */}
                  {parking.precio.sena > 0 && (
                    <div className="sn-checkout__linea">
                      <span>
                        {textos.checkout.sena}
                        <em className="sn-checkout__detalle">{textos.checkout.senaAclaracion}</em>
                      </span>
                      <span>{fmtPrecio(parking.precio.sena)}</span>
                    </div>
                  )}

                  <div className="sn-checkout__linea sn-checkout__linea--total">
                    <span>{textos.checkout.totalReserva}</span>
                    <span>{fmtPrecio(parking.precio.total)}</span>
                  </div>

                  <span className="sn-checkout__pago sn-checkout__pago--sena">
                    <Icono nombre="alerta" tam={15} />
                    {textos.checkout.senaAviso}
                  </span>

                  {/* Sin credenciales de la pasarela no se cobra nada: hay que
                      decirlo, no dejar creer que entró plata. */}
                  {config?.pagoSimulado && (
                    <span className="sn-checkout__pago sn-checkout__pago--prueba">
                      <Icono nombre="alerta" tam={15} />
                      {textos.checkout.pagoSimulado}
                    </span>
                  )}
                </div>
              )}

            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default Checkout;
