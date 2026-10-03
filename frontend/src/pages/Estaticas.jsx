/**
 * Páginas de contenido: Sobre nosotros, Términos, Privacidad y 404.
 *
 * Los textos legales son un punto de partida honesto sobre cómo funciona el
 * producto hoy. Antes de salir a producción tienen que pasar por un abogado:
 * está anotado en el README.
 */
import { Link } from 'react-router-dom';
import { Icono } from '../components/ui/Iconos.jsx';
import { useTitulo } from '../hooks/index.js';
import textos from '../i18n/textos.js';
import './Estaticas.css';

/* ═══════════════════ Sobre nosotros ═══════════════════ */

export function SobreNosotros() {
  useTitulo(textos.footer.sobreNosotros);

  return (
    <div className="sn-estatica">
      <div className="sn-contenedor sn-estatica__contenedor">
        {/* <span className="sn-estatica__kicker">{textos.marca.empresa}</span> */}
        <h1>Estacionar cerca de un evento no debería ser una lotería</h1>

        <p className="sn-estatica__entrada">
          SpotNear nació de un problema concreto: los días de recital en el Movistar Arena, los
          estacionamientos de Villa Crespo se llenan y la gente termina dando vueltas a la manzana o
          dejando el auto en cualquier lado. Del otro lado del mostrador, las reservas llegaban por
          WhatsApp, mezcladas entre mensajes, y había que anotarlas a mano.
        </p>

        <h2>Qué hacemos</h2>
        <p>
          Conectamos a quien necesita estacionar con los estacionamientos cercanos al lugar a donde
          va. El cliente reserva por un link, en un minuto y sin crear cuenta. El estacionamiento
          recibe la reserva con todos los datos ya cargados —nombre, teléfono, patente, vehículo,
          horario— en un panel propio.
        </p>

        <h2>Para los estacionamientos</h2>
        <ul className="sn-estatica__lista">
          <li>
            <Icono nombre="checkCirculo" tam={18} />
            <span>
              <strong>Panel propio.</strong> Ves solo tus reservas. Buscás por patente o por código
              cuando el cliente llega, y marcás el ingreso y la salida desde el celular.
            </span>
          </li>
          <li>
            <Icono nombre="checkCirculo" tam={18} />
            <span>
              <strong>Sin sobreventa.</strong> El sistema controla la capacidad por franja horaria.
              Nunca se reserva un lugar que no existe.
            </span>
          </li>
          <li>
            <Icono nombre="checkCirculo" tam={18} />
            <span>
              <strong>Tarifas tuyas.</strong> Por hora, por día y mensual, con media estadía y
              estadía completa calculadas solas, y precios distintos por tipo de vehículo.
            </span>
          </li>
          <li>
            <Icono nombre="checkCirculo" tam={18} />
            <span>
              <strong>Sigue funcionando con WhatsApp.</strong> Cada reserva genera un mensaje listo
              para pegar en el grupo del estacionamiento. No hay que cambiar de golpe cómo se
              trabaja.
            </span>
          </li>
          <li>
            <Icono nombre="checkCirculo" tam={18} />
            <span>
              <strong>Comisión del 10%.</strong> Solo por reserva confirmada. Si no entra nadie, no
              pagás nada.
            </span>
          </li>
        </ul>

        <h2>Cómo cobramos</h2>
        <p>
          SpotNear cobra una comisión del 10% sobre cada reserva confirmada (es configurable por
          estacionamiento). El precio que ve el cliente es el precio final: la comisión sale de ahí,
          no es un cargo extra que se le suma.
        </p>

        <h2>Hacia dónde vamos</h2>
        <p>
          Estamos empezando por Villa Crespo y las zonas cercanas al Movistar Arena, y sumando
          estacionamientos en Palermo, Chacarita, Almagro y el Microcentro. En las próximas versiones
          llegan el pago online con Mercado Pago, el envío automático por WhatsApp y la aplicación
          móvil.
        </p>

        <div className="sn-estatica__cta">
          <p>
            <strong>¿Querés sumar tu estacionamiento?</strong> Escribinos y lo damos de alta.
          </p>
          <a
            href={`https://wa.me/${(import.meta.env.VITE_WHATSAPP_SOPORTE || '').replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="sn-boton sn-boton--whatsapp sn-boton--lg"
          >
            <Icono nombre="whatsapp" tam={19} />
            Hablemos por WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ Términos ═══════════════════ */

export function Terminos() {
  useTitulo(textos.footer.terminos);

  return (
    <div className="sn-estatica">
      <div className="sn-contenedor sn-estatica__contenedor">
        <h1>Términos y condiciones</h1>
        <p className="sn-estatica__fecha">Última actualización: {new Date().getFullYear()}</p>

        <div className="sn-aviso sn-aviso--aviso sn-estatica__disclaimer">
          <span className="sn-aviso__icono">
            <Icono nombre="alerta" tam={18} />
          </span>
          <div>
            Este texto describe cómo funciona el servicio hoy y es un borrador de trabajo. Antes de
            operar comercialmente tiene que ser revisado por un profesional del derecho.
          </div>
        </div>

        <h2>1. Qué es SpotNear</h2>
        <p>
          SpotNear es una plataforma operada por ColdevIA que conecta a conductores con
          estacionamientos adheridos en la Ciudad Autónoma de Buenos Aires. SpotNear intermedia la
          reserva; el servicio de guarda del vehículo lo presta el estacionamiento, que es el único
          responsable por él.
        </p>

        <h2>2. Reservas</h2>
        <p>
          Al confirmar una reserva se compromete un lugar en el estacionamiento elegido para el
          horario indicado. La reserva se identifica con un código único que hay que presentar al
          ingresar. Los datos que se cargan (nombre, teléfono, patente y vehículo) tienen que ser
          verdaderos: el estacionamiento puede rechazar el ingreso si no coinciden.
        </p>

        <h2>3. Precios y pago</h2>
        <p>
          El precio que se muestra antes de confirmar es el precio final de la estadía e incluye
          todos los cargos. En esta versión el pago se realiza directamente en el estacionamiento, al
          momento del ingreso o del egreso, según lo que indique cada local.
        </p>
        <p>
          Si el vehículo permanece más tiempo del reservado, el estacionamiento puede cobrar el
          excedente según su tarifa vigente.
        </p>

        <h2>4. Cancelaciones</h2>
        <p>
          La reserva se puede cancelar sin costo hasta la hora de inicio. Como el pago se hace en el
          lugar, no hay importes a devolver. Si el cliente no se presenta, la reserva se marca como
          &laquo;no se presentó&raquo; y el lugar queda liberado.
        </p>

        <h2>5. Responsabilidad</h2>
        <p>
          SpotNear no opera los estacionamientos ni custodia los vehículos. La responsabilidad por el
          vehículo, sus accesorios y los objetos que haya en su interior corresponde al
          estacionamiento, conforme a la normativa vigente y a las condiciones que exhiba en su
          local.
        </p>
        <p>
          SpotNear se compromete a que la información publicada (dirección, horarios, tarifas y
          disponibilidad) sea la que carga cada estacionamiento, y a mantener el servicio disponible
          dentro de lo razonable.
        </p>

        <h2>6. Uso de la plataforma</h2>
        <p>
          No está permitido usar SpotNear para hacer reservas falsas, bloquear lugares sin intención
          de usarlos, ni para ningún fin ilícito. Detectado un uso indebido, se pueden cancelar las
          reservas y bloquear el acceso.
        </p>

        <h2>7. Cambios</h2>
        <p>
          Estos términos pueden actualizarse. Los cambios rigen para las reservas hechas a partir de
          su publicación.
        </p>

        <h2>8. Contacto</h2>
        <p>Por cualquier consulta podés escribirnos por WhatsApp desde el pie del sitio.</p>
      </div>
    </div>
  );
}

/* ═══════════════════ Privacidad ═══════════════════ */

export function Privacidad() {
  useTitulo(textos.footer.privacidad);

  return (
    <div className="sn-estatica">
      <div className="sn-contenedor sn-estatica__contenedor">
        <h1>Política de privacidad</h1>
        <p className="sn-estatica__fecha">Última actualización: {new Date().getFullYear()}</p>

        <div className="sn-aviso sn-aviso--aviso sn-estatica__disclaimer">
          <span className="sn-aviso__icono">
            <Icono nombre="alerta" tam={18} />
          </span>
          <div>
            Borrador de trabajo. Debe ser revisado por un profesional antes de operar
            comercialmente, especialmente respecto de la Ley 25.326 de Protección de Datos
            Personales.
          </div>
        </div>

        <h2>Qué datos pedimos</h2>
        <p>Para poder reservar un lugar necesitamos:</p>
        <ul className="sn-estatica__lista sn-estatica__lista--simple">
          <li>Nombre y apellido</li>
          <li>Teléfono (para mandarte el comprobante y poder avisarte de algún cambio)</li>
          <li>Patente, tipo y datos del vehículo</li>
          <li>Email, solo si lo dejás</li>
        </ul>
        <p>
          El email, el color del vehículo, el evento al que vas y las notas son opcionales: la
          reserva funciona igual sin ellos.
        </p>

        <h2>Para qué los usamos</h2>
        <p>
          Únicamente para gestionar tu reserva: identificarte al ingresar, enviarte el comprobante y
          compartirle al estacionamiento los datos que necesita para recibirte. No vendemos tus datos
          ni los cedemos a terceros con fines publicitarios.
        </p>

        <h2>Quién los ve</h2>
        <p>
          El estacionamiento donde reservaste ve los datos de esa reserva. Un estacionamiento nunca
          puede ver las reservas de otro: el sistema lo impide a nivel de servidor, no solo
          ocultándolo en pantalla.
        </p>

        <h2>El link del comprobante</h2>
        <p>
          Tu comprobante es accesible por un link con un código largo e imposible de adivinar. Quien
          tenga ese link puede verlo, así que compartilo solo con quien quieras.
        </p>

        <h2>Cuánto los guardamos</h2>
        <p>
          Conservamos las reservas mientras sean necesarias para la operación y para cumplir con las
          obligaciones contables y fiscales del estacionamiento.
        </p>

        <h2>Tus derechos</h2>
        <p>
          Podés pedirnos acceder, rectificar o suprimir tus datos escribiéndonos por WhatsApp. La
          Agencia de Acceso a la Información Pública es el órgano de control de la Ley 25.326 y
          atiende las denuncias de quienes vean afectado su derecho.
        </p>

        <h2>Cookies</h2>
        <p>
          No usamos cookies de seguimiento ni publicidad. Guardamos datos en tu navegador solo para
          mantener la sesión abierta en el panel administrativo.
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════ 404 ═══════════════════ */

export function NoEncontrado() {
  useTitulo(textos.error404.titulo);

  return (
    <div className="sn-404">
      <div className="sn-contenedor sn-404__interior">
        <span className="sn-404__codigo">404</span>
        <h1>{textos.error404.titulo}</h1>
        <p>{textos.error404.texto}</p>
        <div className="sn-404__acciones">
          <Link to="/" className="sn-boton sn-boton--primario sn-boton--lg">
            {textos.error404.volver}
          </Link>
        </div>
      </div>
    </div>
  );
}
