/**
 * Checkout: "Terminá tu reserva".
 *
 * Dos pasos —datos y confirmación— con el resumen siempre a la vista.
 * Se reserva como invitado: no hace falta crear cuenta ni cargar tarjeta.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Campo, CampoOpciones } from '../components/ui/Campo.jsx';
import { Icono, ICONO_VEHICULO } from '../components/ui/Iconos.jsx';
import { Cargando, ErrorCarga } from '../components/ui/Estado.jsx';
import { Aviso } from '../components/ui/Varios.jsx';
import { publico } from '../services/spotnear.service.js';
import { usePedido, useTitulo, useDebounce } from '../hooks/index.js';
import { periodoPorDefecto } from '../hooks/useBusqueda.js';
import SelectorPeriodo from '../components/busqueda/SelectorPeriodo.jsx';
import {
  validarReserva,
  validarRango,
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

/** "Citroën" → "citroen": para filtrar las sugerencias de modelo por marca. */
const sinTildes = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

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
  const [params, setParams] = useSearchParams();
  const navegar = useNavigate();

  useTitulo(textos.checkout.titulo);

  const periodo = useMemo(() => {
    const porDefecto = periodoPorDefecto();
    return {
      inicio: params.get('inicio') ? new Date(params.get('inicio')) : porDefecto.inicio,
      fin: params.get('fin') ? new Date(params.get('fin')) : porDefecto.fin,
    };
  }, [params]);

  /**
   * Edición del período desde la tarjeta del resumen.
   *
   * El período vive en la URL (?inicio=&fin=). Editarlo reemplaza esos dos
   * parámetros: la pantalla NO se desmonta, así que lo que el cliente ya
   * escribió (datos, vehículo) queda intacto, y el pedido del estacionamiento
   * se repite solo con el horario nuevo: duración, escalón, precio, seña,
   * total y disponibilidad salen de la misma API y el mismo motor de precios.
   *
   * Se aplica en vivo mientras el cliente mueve las fechas (con una pausa
   * corta para no pedir en cada tecla) y solo si el rango es válido.
   */
  const [editandoPeriodo, setEditandoPeriodo] = useState(false);
  const [borrador, setBorrador] = useState(periodo);
  const [errorBorrador, setErrorBorrador] = useState(null);
  const borradorDemorado = useDebounce(borrador, 500);

  useEffect(() => {
    if (!editandoPeriodo) return;
    const { inicio, fin } = borradorDemorado;
    const problema =
      validarRango(inicio, fin) ??
      (inicio.getTime() < Date.now() - 5 * 60_000 ? textos.checkout.periodoEnElPasado : null);
    setErrorBorrador(problema);
    if (problema) return;
    if (inicio.getTime() === periodo.inicio.getTime() && fin.getTime() === periodo.fin.getTime()) return;
    setParams(
      (actuales) => {
        const nuevos = new URLSearchParams(actuales);
        nuevos.set('inicio', inicio.toISOString());
        nuevos.set('fin', fin.toISOString());
        return nuevos;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borradorDemorado, editandoPeriodo]);

  const abrirEdicionPeriodo = () => {
    setBorrador(periodo);
    setErrorBorrador(null);
    setEditandoPeriodo(true);
  };

  // El tipo de vehículo arranca SIN elegir (salvo que venga en la URL): lo
  // detecta el catálogo a partir de la marca y el modelo, o lo elige el
  // cliente. Nunca se asume uno: asumir "Auto" le cobraba de menos al
  // estacionamiento cuando era una camioneta.
  const [form, setForm] = useState(() => ({
    ...FORM_INICIAL,
    tipoVehiculo: params.get('tipoVehiculo') ?? '',
  }));
  // Lo que detectó el catálogo para la marca y el modelo escritos (o null).
  const [deteccion, setDeteccion] = useState(null);
  // De dónde salió el tipo elegido: 'auto' (lo puso el catálogo) o 'manual'
  // (lo tocó el cliente). Si el modelo deja de reconocerse, solo se borra un
  // tipo que había puesto el catálogo, nunca uno que eligió el cliente.
  const origenTipo = useRef(null);
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
          // Sin tipo elegido se cotiza con la tarifa de referencia (la
          // general, o la de auto): el resumen lo aclara.
          tipoVehiculo: form.tipoVehiculo || undefined,
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

  // Si el estacionamiento no acepta el tipo que vino en la URL, queda sin
  // elegir: que lo elija el cliente entre los que sí acepta.
  useEffect(() => {
    if (parking && form.tipoVehiculo && !parking.tiposVehiculo.includes(form.tipoVehiculo)) {
      setForm((f) => ({ ...f, tipoVehiculo: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parking?.id]);

  /* ── Catálogo de marca/modelo: autocompletado y detección del tipo ── */
  const { datos: catalogo } = usePedido(() => publico.catalogoVehiculos(), []);
  const modelosDelCatalogo = useMemo(() => catalogo?.modelos ?? [], [catalogo]);
  const marcasDelCatalogo = useMemo(
    () => [...new Set(modelosDelCatalogo.map((m) => m.marca))],
    [modelosDelCatalogo],
  );
  const modelosDeLaMarca = useMemo(() => {
    const marca = sinTildes(form.marca);
    return modelosDelCatalogo.filter((m) => !marca || sinTildes(m.marca).startsWith(marca));
  }, [modelosDelCatalogo, form.marca]);

  /**
   * Cuando el cliente escribe la marca y el modelo, se busca en el catálogo y,
   * si hay coincidencia, se preselecciona el tipo. El precio de la derecha se
   * recalcula solo, porque la cotización depende de `form.tipoVehiculo`.
   *
   * Solo se dispara con un cambio de marca o modelo: si después el cliente
   * corrige el tipo a mano, eso se respeta. Si el modelo no está en el
   * catálogo, el tipo queda sin elegir (o con lo que eligió el cliente): no
   * se asume ninguno.
   */
  const marcaYModelo = useDebounce(`${form.marca}|${form.modelo}`, 450);
  useEffect(() => {
    const [marca, modelo] = marcaYModelo.split('|');
    if (!marca.trim() || !modelo.trim()) {
      setDeteccion(null);
      return undefined;
    }
    let vigente = true;
    publico
      .clasificarVehiculo(marca, modelo)
      .then(({ coincidencia }) => {
        if (!vigente) return;
        if (!coincidencia) {
          setDeteccion(null);
          // Si el tipo lo había puesto una detección anterior, deja de valer.
          setForm((f) => (origenTipo.current === 'auto' ? { ...f, tipoVehiculo: '' } : f));
          return;
        }
        const aceptado = !parking || parking.tiposVehiculo.includes(coincidencia.tipo);
        setDeteccion({ ...coincidencia, aceptado });
        if (aceptado) {
          origenTipo.current = 'auto';
          setForm((f) => ({ ...f, tipoVehiculo: coincidencia.tipo }));
          setErrores((e) => (e.tipoVehiculo ? { ...e, tipoVehiculo: undefined } : e));
        }
      })
      .catch(() => {
        // Sin catálogo el formulario sigue funcionando: el tipo se elige a mano.
      });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marcaYModelo, parking?.id]);

  const set = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (campo === 'tipoVehiculo') origenTipo.current = 'manual';
    // El error del campo se limpia apenas el usuario lo corrige.
    setErrores((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  };

  const continuar = (e) => {
    e.preventDefault();
    // Con un horario sin lugar, fuera de horario o sin precio no se avanza: el
    // aviso está en la tarjeta del resumen, que es donde se corrige.
    if (problemaPeriodo || recotizando) {
      document.querySelector('.sn-checkout__periodo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const { tipoVehiculo: faltaTipo, ...nuevos } = validarReserva(form);
    if (emailObligatorio && !form.email.trim()) nuevos.email = textos.checkout.emailObligatorio;
    // Marca, modelo y color son obligatorios: con marca y modelo se detecta
    // el tipo de vehículo. Se agregan en el orden del formulario (y el tipo al
    // final), así el foco cae en el primer campo que falta.
    if (!form.marca.trim()) nuevos.marca = textos.errores.campoObligatorio;
    if (!form.modelo.trim()) nuevos.modelo = textos.errores.campoObligatorio;
    if (!form.color.trim()) nuevos.color = textos.errores.campoObligatorio;
    if (faltaTipo) nuevos.tipoVehiculo = textos.checkout.elegiTipoVehiculo;
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
          marca: form.marca.trim(),
          modelo: form.modelo.trim(),
          color: form.color.trim(),
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

  // La pantalla de carga completa solo la primera vez. Cuando se recotiza
  // (cambió el tipo de vehículo) el formulario se queda donde está y solo el
  // resumen de precio muestra que se está actualizando: si no, el formulario
  // desaparecía un instante y el cliente perdía el campo en el que escribía.
  if (cargando && !datos) return <Cargando texto="Preparando tu reserva..." />;
  const recotizando = cargando && Boolean(datos);

  // Error en la PRIMERA carga: no hay nada que mostrar. Si falla al recotizar
  // un horario nuevo, el formulario se queda y el error va en la tarjeta.
  if (error && !datos) {
    return (
      <div className="sn-contenedor sn-seccion">
        <ErrorCarga error={error} onReintentar={recargar} />
      </div>
    );
  }

  if (!parking) return null;

  const sinLugar = parking.disponibilidad && !parking.disponibilidad.hayLugar;

  /**
   * Lo que impide reservar con este horario, en orden de importancia. Se
   * muestra en la tarjeta del resumen y bloquea "Continuar" y "Confirmar".
   */
  const problemaPeriodo = error
    ? error.message ?? textos.checkout.periodoSinPrecio
    : sinLugar
      ? textos.checkout.periodoSinLugar
      : parking.fueraDeHorario
        ? parking.fueraDeHorario
        : !parking.precio
          ? parking.precioError ?? textos.checkout.periodoSinPrecio
          : null;

  /** Texto bajo el tipo de vehículo: qué detectó el catálogo, o qué hacer. */
  const ayudaTipoVehiculo = (() => {
    if (deteccion && !deteccion.aceptado) {
      return textos.checkout.tipoDetectadoNoAceptado(
        textos.parking.tiposVehiculo[deteccion.tipo],
        `${deteccion.marca} ${deteccion.modelo}`,
      );
    }
    if (deteccion && form.tipoVehiculo === deteccion.tipo) {
      return textos.checkout.tipoDetectado(`${deteccion.marca} ${deteccion.modelo}`);
    }
    if (!form.tipoVehiculo) return textos.checkout.tipoSinDetectar;
    return undefined;
  })();

  /**
   * La pasarela no está en condiciones de cobrar (típicamente: faltan las
   * credenciales de Mercado Pago). Mientras `config` no llegó se asume que sí,
   * para no parpadear un error que probablemente no exista.
   */
  const pagoNoDisponible = config ? config.pago?.disponible === false : false;

  // Sin lugar ya no reemplaza la pantalla entera: el aviso va en la tarjeta,
  // al lado del período, y el cliente cambia el horario ahí mismo sin perder
  // lo que cargó.

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

                  {/* Marca y modelo van antes del tipo: con ellos se detecta el
                      tipo de vehículo en el catálogo de SpotNear. Las listas
                      sugieren lo que ya está cargado, pero se puede escribir
                      cualquier cosa. */}
                  <div className="sn-grilla-campos sn-grilla-campos--3">
                    <Campo
                      name="marca"
                      autoComplete="off"
                      list="sn-catalogo-marcas"
                      label={textos.checkout.marca}
                      obligatorio
                      placeholder="Toyota"
                      value={form.marca}
                      onChange={(e) => set('marca', e.target.value)}
                      error={errores.marca}
                    />
                    <Campo
                      name="modelo"
                      autoComplete="off"
                      list="sn-catalogo-modelos"
                      label={textos.checkout.modelo}
                      obligatorio
                      placeholder="Corolla"
                      value={form.modelo}
                      onChange={(e) => set('modelo', e.target.value)}
                      error={errores.modelo}
                    />
                    <Campo
                      name="color"
                      autoComplete="off"
                      label={textos.checkout.color}
                      obligatorio
                      placeholder="Gris"
                      value={form.color}
                      onChange={(e) => set('color', e.target.value)}
                      error={errores.color}
                    />
                  </div>
                  <datalist id="sn-catalogo-marcas">
                    {marcasDelCatalogo.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                  <datalist id="sn-catalogo-modelos">
                    {modelosDeLaMarca.map((m) => (
                      <option key={`${m.marca}-${m.modelo}`} value={m.modelo}>
                        {m.marca}
                      </option>
                    ))}
                  </datalist>

                  <CampoOpciones
                    name="tipoVehiculo"
                    label={textos.checkout.tipoVehiculo}
                    obligatorio
                    valor={form.tipoVehiculo}
                    onChange={(v) => set('tipoVehiculo', v)}
                    error={errores.tipoVehiculo}
                    ayuda={ayudaTipoVehiculo}
                    opciones={TIPOS_VEHICULO.filter((t) => parking.tiposVehiculo.includes(t)).map(
                      (t) => ({
                        valor: t,
                        etiqueta: textos.parking.tiposVehiculo[t],
                        icono: ICONO_VEHICULO[t],
                      }),
                    )}
                  />
                </section>


                <button
                  type="submit"
                  className="sn-boton sn-boton--primario sn-boton--lg sn-boton--bloque"
                  disabled={Boolean(problemaPeriodo) || recotizando}
                >
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
                    disabled={enviando || pagoNoDisponible || Boolean(problemaPeriodo) || recotizando}
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
                <div className="sn-checkout__periodo-cabecera">
                  <span>{textos.checkout.periodo}</span>
                  {paso === 1 && !editandoPeriodo && (
                    <button type="button" className="sn-checkout__editar-periodo" onClick={abrirEdicionPeriodo}>
                      <Icono nombre="editar" tam={14} />
                      {textos.checkout.editarPeriodo}
                    </button>
                  )}
                </div>

                {editandoPeriodo ? (
                  <div className="sn-checkout__periodo-editor">
                    <SelectorPeriodo
                      inicio={borrador.inicio}
                      fin={borrador.fin}
                      compacto
                      separado
                      onChange={(cambios) => setBorrador((b) => ({ ...b, ...cambios }))}
                      error={errorBorrador}
                    />
                    <button
                      type="button"
                      className="sn-boton sn-boton--secundario sn-boton--sm"
                      onClick={() => setEditandoPeriodo(false)}
                    >
                      <Icono nombre="check" tam={15} />
                      {textos.checkout.listoPeriodo}
                    </button>
                  </div>
                ) : (
                  <p className="sn-checkout__periodo-fechas">
                    {fechaLarga(periodo.inicio)} · {hora(periodo.inicio)}
                    <Icono nombre="flechaDerecha" tam={14} />
                    {fechaLarga(periodo.fin)} · {hora(periodo.fin)}
                  </p>
                )}
                <span className="sn-checkout__duracion">{duracion(periodo.inicio, periodo.fin)}</span>

                {problemaPeriodo && !recotizando && (
                  <Aviso tipo="error" className="sn-checkout__periodo-aviso">
                    {problemaPeriodo}
                  </Aviso>
                )}
              </div>

              {parking.precio && (
                <div
                  className={`sn-checkout__precio ${recotizando ? 'sn-checkout__precio--actualizando' : ''}`}
                  aria-busy={recotizando || undefined}
                >
                  <span className="sn-checkout__precio-titulo">{textos.checkout.desglose}</span>

                  {/* Lo que cobra el estacionamiento: entero, sin descuentos.
                      Ese monto lo paga el cliente allá, no acá. */}
                  <div className="sn-checkout__linea">
                    <span>
                      {textos.checkout.enElEstacionamiento}
                      <em className="sn-checkout__detalle">{parking.precio.desglose.etiqueta}</em>
                      {/* Para qué vehículo es este precio: cada tipo tiene su
                          tarifa, y sin elegirlo se muestra la de referencia. */}
                      <em className="sn-checkout__detalle sn-checkout__tarifa-para">
                        {form.tipoVehiculo
                          ? textos.checkout.tarifaPara(textos.parking.tiposVehiculo[form.tipoVehiculo])
                          : textos.checkout.tarifaReferencia}
                      </em>
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
