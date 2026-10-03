/**
 * Pantalla de pago de la seña (/pago/:token).
 *
 * Es el puente entre el checkout y el comprobante, y existe porque el pago no
 * es instantáneo: una tarjeta puede quedar en revisión y un pago en efectivo se
 * acredita horas después. El cliente llega acá desde el checkout de SpotNear
 * (a pagar) o de vuelta desde Mercado Pago (`?vuelta=...`), y ve uno de estos
 * estados:
 *
 *   · confirmando → recién vuelve de Mercado Pago: "Confirmando tu pago...",
 *                   consultando cada 1,5 s durante 15 s.
 *   · listo       → la seña entró: se va al comprobante, sin otro clic.
 *   · esperando   → el pago está en proceso: el comprobante sale apenas se
 *                   acredite, con un botón para volver a revisar.
 *   · faltaPagar  → no hay pago: botón "Pagar la seña".
 *   · rechazado   → el pago no se completó: reintentar.
 *
 * NO se confía en lo que diga la URL de vuelta de Mercado Pago. El estado se
 * consulta al backend, que a su vez se lo pregunta a la API de Mercado Pago con
 * el access token. `?vuelta=aprobado` lo escribe cualquiera: acá solo decide
 * qué mostrar mientras se confirma, nunca si hay comprobante.
 *
 * Cada consulta es también la que puede confirmar la reserva: si el pago está
 * aprobado, el backend la confirma y dispara el comprobante y el aviso al
 * estacionamiento en ese momento. Por eso no hace falta esperar al webhook: si
 * tarda, la consulta lo reemplaza; si llega primero, la consulta lo encuentra
 * hecho.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { Icono } from '../components/ui/Iconos.jsx';
import { Cargando, ErrorCarga } from '../components/ui/Estado.jsx';
import { Aviso } from '../components/ui/Varios.jsx';
import { publico } from '../services/spotnear.service.js';
import { useTitulo, usePedido, useCopiar } from '../hooks/index.js';
import { precio as fmtPrecio } from '../utils/formato.js';
import textos from '../i18n/textos.js';
import './Pago.css';

/** Cada cuánto se le vuelve a preguntar al servidor, en ms. */
const CADA = 4000;

/**
 * Recién vuelto de Mercado Pago se pregunta más seguido: el pago se acaba de
 * hacer y lo normal es que se confirme en uno o dos segundos. 10 consultas
 * cada 1,5 s = 15 s de "Confirmando tu pago...".
 */
const CADA_AL_VOLVER = 1500;
const CONSULTAS_AL_VOLVER = 10;

/**
 * Cuántas consultas (al ritmo normal) antes de dejar de insistir.
 *
 * Dos minutos. Pasado eso se deja de sondear y se le dice al cliente que puede
 * cerrar la pantalla: un pago en efectivo no se va a acreditar mirándolo, y el
 * comprobante le llega por WhatsApp cuando entre. Se puede seguir manualmente
 * con "Revisar de nuevo".
 */
const MAXIMO_DE_CONSULTAS = 30;

export function Pago() {
  const { token } = useParams();
  const [parametros] = useSearchParams();
  const navegar = useNavigate();
  const { copiar } = useCopiar();

  useTitulo(textos.pago.titulo);

  // aprobado | pendiente | rechazado | sin-dato | null (no viene de Mercado Pago)
  const pista = parametros.get('vuelta');
  // Solo se espera confirmando si Mercado Pago dijo que hubo un pago. Si el
  // cliente volvió sin pagar ("sin-dato") o rechazado, no hay nada que esperar.
  const hayQueConfirmar = pista === 'aprobado' || pista === 'pendiente';

  const [estado, setEstado] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [reintentando, setReintentando] = useState(false);
  const [seCanso, setSeCanso] = useState(false);
  const [errorPago, setErrorPago] = useState(null);
  const [confirmando, setConfirmando] = useState(hayQueConfirmar);
  // Link del checkout abierto en otra pestaña (modo sin vuelta automática).
  const [checkoutAbierto, setCheckoutAbierto] = useState(null);
  // Cambiarla reinicia el sondeo desde cero (ver el efecto de abajo).
  const [ronda, setRonda] = useState(0);
  const consultas = useRef(0);
  const enVentanaRapida = useRef(hayQueConfirmar);

  /**
   * ¿Mercado Pago puede devolver al cliente solo? Necesita una URL de vuelta
   * https. Sin ella, el checkout se abre en OTRA pestaña y esta se queda
   * esperando la acreditación, así el cliente no queda encerrado en la
   * pantalla de Mercado Pago.
   */
  const { datos: config } = usePedido(() => publico.config(), []);
  const vueltaAutomatica = Boolean(config?.pago?.vueltaAutomatica);

  const consultar = useCallback(async () => {
    try {
      const datos = await publico.estadoPago(token);
      setEstado(datos);
      setError(null);
      return datos;
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setCargando(false);
    }
  }, [token]);

  /* ── Sondeo hasta que se acredite (o hasta cansarse) ── */
  useEffect(() => {
    let vivo = true;
    let temporizador;
    consultas.current = 0;

    const vuelta = async () => {
      const datos = await consultar();
      if (!vivo) return;

      // Acreditada: el comprobante ya existe, se va para allá sin otro clic.
      if (datos && !datos.esperandoLaSena) {
        navegar(`/comprobante/${token}`, { replace: true });
        return;
      }

      consultas.current += 1;

      if (enVentanaRapida.current) {
        // Un rechazo no se va a arreglar esperando: se muestra ya.
        const rechazado = datos?.estado === 'FALLIDO';
        if (rechazado || consultas.current >= CONSULTAS_AL_VOLVER) {
          // Terminó la ventana de "Confirmando tu pago...". Se sigue
          // consultando, más espaciado, mientras se muestra "en proceso".
          enVentanaRapida.current = false;
          consultas.current = 0;
          setConfirmando(false);
        }
      } else if (consultas.current >= MAXIMO_DE_CONSULTAS) {
        setSeCanso(true);
        return;
      }

      temporizador = setTimeout(vuelta, enVentanaRapida.current ? CADA_AL_VOLVER : CADA);
    };

    vuelta();

    return () => {
      vivo = false;
      clearTimeout(temporizador);
    };
  }, [consultar, navegar, token, ronda]);

  /* ── Al volver a esta pestaña, se consulta en el acto ──
     Es el momento exacto en que el cliente termina de pagar en la otra y vuelve
     acá: no tiene sentido que espere al próximo turno del sondeo. */
  useEffect(() => {
    const alVolver = async () => {
      if (document.visibilityState !== 'visible') return;
      const datos = await consultar();
      if (datos && !datos.esperandoLaSena) navegar(`/comprobante/${token}`, { replace: true });
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
    };
  }, [consultar, navegar, token]);

  /**
   * Arma el checkout y sale a Mercado Pago. Es el ÚNICO camino a la pasarela:
   * el checkout de SpotNear deja al cliente acá, lee que le falta pagar, y
   * recién con este clic se crea la preferencia. Sirve igual para reintentar
   * después de un rechazo.
   */
  const pagar = async () => {
    setReintentando(true);
    setErrorPago(null);

    // Sin vuelta automática la pestaña se abre YA, dentro del clic: si se abre
    // después del await, el navegador la toma como una ventana emergente que
    // nadie pidió y la bloquea.
    const pestana = vueltaAutomatica ? null : window.open('', '_blank');

    try {
      const datos = await publico.pagarSena(token);

      if (!datos.url) {
        // Sin link nuevo (por ejemplo, si ya quedó saldada) se vuelve a consultar.
        pestana?.close();
        setSeCanso(false);
        setRonda((r) => r + 1);
        return;
      }

      if (pestana) {
        // Mercado Pago no necesita tocar esta pestaña.
        pestana.opener = null;
        pestana.location.href = datos.url;
        setCheckoutAbierto(datos.url);
        setSeCanso(false);
        setRonda((r) => r + 1);
        return;
      }

      // Con vuelta automática (o si el navegador bloqueó la pestaña igual) se
      // sale en esta misma: Mercado Pago la devuelve sola al terminar.
      window.location.assign(datos.url);
    } catch (e) {
      pestana?.close();
      setErrorPago(e);
    } finally {
      setReintentando(false);
    }
  };

  /** "Revisar de nuevo": consulta en el acto y retoma el sondeo. */
  const revisarDeNuevo = () => {
    setSeCanso(false);
    setCargando(true);
    setRonda((r) => r + 1);
  };

  if (cargando && !estado) {
    // "Confirmando tu pago" solo si de verdad viene de pagar.
    return <Cargando texto={hayQueConfirmar ? textos.pago.confirmandoTitulo : textos.pago.consultando} />;
  }

  if (!estado) {
    return (
      <div className="sn-contenedor sn-seccion">
        <ErrorCarga error={error} onReintentar={revisarDeNuevo} />
      </div>
    );
  }

  /* ── Qué se muestra ── */

  // La seña ya entró: el efecto de arriba está navegando al comprobante. Se
  // dibuja el caso "listo" en vez del último estado conocido, para que no se
  // vea un "falta pagar" de un cuadro justo después de haber pagado.
  const acreditada = !estado.esperandoLaSena;
  const rechazado =
    !acreditada && (estado.estado === 'FALLIDO' || (pista === 'rechazado' && !estado.detalle));
  // "En proceso" si hay un pago en curso, o si Mercado Pago dijo que lo hubo y
  // todavía no lo ve acreditado (pasada la ventana de confirmación).
  const enCurso = !acreditada && !rechazado && (Boolean(estado.detalle) || hayQueConfirmar);

  const caso = acreditada
    ? 'listo'
    : rechazado
      ? 'rechazado'
      : confirmando
        ? 'confirmando'
        : enCurso
          ? 'esperando'
          : 'faltaPagar';

  const ICONOS = {
    listo: 'checkCirculo',
    rechazado: 'alerta',
    esperando: 'reloj',
    faltaPagar: 'dinero',
  };

  const conSpinner = caso === 'confirmando';

  return (
    <div className="sn-contenedor sn-seccion sn-pago">
      <div className={`sn-pago__caja sn-pago__caja--${caso}`} aria-live="polite">
        <span className="sn-pago__icono" aria-hidden="true">
          {conSpinner ? (
            <span className="sn-spinner" style={{ width: 30, height: 30 }} />
          ) : (
            <Icono nombre={ICONOS[caso]} tam={30} />
          )}
        </span>

        <h1 className="sn-pago__titulo">{textos.pago[`${caso}Titulo`]}</h1>
        <p className="sn-pago__texto">{textos.pago[`${caso}Texto`]}</p>

        <p className="sn-pago__codigo">
          {textos.pago.reserva} <strong className="sn-codigo">{estado.codigo}</strong>
        </p>

        {caso !== 'confirmando' && (
          <dl className="sn-pago__montos">
            <div>
              <dt>{caso === 'faltaPagar' || caso === 'rechazado' ? textos.pago.senaLinea : textos.pago.senaLineaPagada}</dt>
              <dd>{fmtPrecio(estado.sena)}</dd>
            </div>
            <div>
              <dt>{textos.pago.restoLinea}</dt>
              <dd>{fmtPrecio(estado.aPagarEnElLugar)}</dd>
            </div>
          </dl>
        )}

        {checkoutAbierto && !acreditada && caso !== 'esperando' && (
          <Aviso tipo="info">{textos.pago.terminaEnLaOtraPestana}</Aviso>
        )}
        {errorPago && <Aviso tipo="error">{errorPago.message}</Aviso>}
        {error && <Aviso tipo="error">{textos.pago.errorConsulta}</Aviso>}
        {caso === 'esperando' && (
          <p className="sn-pago__nota">
            {seCanso ? textos.pago.tardaMucho : textos.pago.esperandoNota}
          </p>
        )}

        <div className="sn-pago__acciones">
          {((caso === 'faltaPagar' && !checkoutAbierto) || caso === 'rechazado') && (
            <button
              type="button"
              className="sn-boton sn-boton--primario sn-boton--lg"
              onClick={pagar}
              disabled={reintentando}
            >
              {reintentando ? (
                <span className="sn-spinner" style={{ width: 17, height: 17 }} aria-hidden="true" />
              ) : (
                <Icono nombre={caso === 'faltaPagar' ? 'dinero' : 'flechaDerecha'} tam={18} />
              )}
              {caso === 'faltaPagar' ? textos.pago.irAPagar : textos.pago.reintentar}
            </button>
          )}

          {caso === 'esperando' && (
            <>
              <button
                type="button"
                className="sn-boton sn-boton--primario sn-boton--lg"
                onClick={revisarDeNuevo}
                disabled={cargando}
              >
                <Icono nombre="reloj" tam={17} />
                {textos.pago.revisarDeNuevo}
              </button>
              <button
                type="button"
                className="sn-boton sn-boton--secundario sn-boton--lg"
                onClick={() => copiar(`${window.location.origin}/pago/${token}`)}
              >
                <Icono nombre="copiar" tam={17} />
                {textos.pago.copiarLink}
              </button>
            </>
          )}

          {checkoutAbierto && caso === 'faltaPagar' && (
            <a
              href={checkoutAbierto}
              target="_blank"
              rel="noopener noreferrer"
              className="sn-boton sn-boton--secundario sn-boton--lg"
            >
              {textos.pago.reabrirMercadoPago}
            </a>
          )}

          {caso !== 'confirmando' && (
            <Link to="/" className="sn-boton sn-boton--fantasma sn-boton--lg">
              {textos.pago.volverAlInicio}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default Pago;
