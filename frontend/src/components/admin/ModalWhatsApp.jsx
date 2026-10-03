/**
 * Ventana para compartir por WhatsApp.
 *
 * Muestra el mensaje ya armado, deja copiarlo y abre wa.me. Los dos caminos
 * importan: a veces el encargado quiere pegarlo en un grupo puntual, y wa.me
 * sin número abre el selector de chats.
 */
import { Modal } from '../ui/Varios.jsx';
import { Icono } from '../ui/Iconos.jsx';
import { useCopiar } from '../../hooks/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import textos from '../../i18n/textos.js';
import './ModalWhatsApp.css';

/**
 * @param {object} props
 * @param {boolean} props.abierto
 * @param {() => void} props.alCerrar
 * @param {string} props.titulo
 * @param {string} props.mensaje
 * @param {string} props.link
 * @param {boolean} [props.cargando]
 */
export function ModalWhatsApp({ abierto, alCerrar, titulo, mensaje, link, cargando = false }) {
  const { copiar } = useCopiar();
  const toast = useToast();

  const copiarMensaje = async () => {
    const ok = await copiar(mensaje);
    if (ok) toast.ok(textos.admin.detalleReserva.mensajeCopiado);
    else toast.error('No pudimos copiar el mensaje.');
  };

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={titulo}
      ancho={520}
      pie={
        <>
          <button
            type="button"
            className="sn-boton sn-boton--secundario"
            onClick={copiarMensaje}
            disabled={cargando || !mensaje}
          >
            <Icono nombre="copiar" tam={16} />
            {textos.admin.detalleReserva.copiarMensaje}
          </button>
          <a
            href={link || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="sn-boton sn-boton--whatsapp"
            aria-disabled={cargando || !link}
            onClick={(e) => {
              if (cargando || !link) e.preventDefault();
            }}
          >
            <Icono nombre="whatsapp" tam={17} />
            Abrir WhatsApp
          </a>
        </>
      }
    >
      {cargando ? (
        <div className="sn-wa__cargando">
          <span className="sn-spinner" aria-hidden="true" />
          Armando el mensaje...
        </div>
      ) : (
        <>
          <p className="sn-wa__ayuda">
            Este es el mensaje que se va a enviar. Podés copiarlo y pegarlo donde quieras.
          </p>
          {/* El mensaje se muestra tal cual se va a mandar, con sus saltos de
              línea y emojis: lo que se ve acá es lo que llega al grupo. */}
          <pre className="sn-wa__mensaje">{mensaje}</pre>
        </>
      )}
    </Modal>
  );
}

export default ModalWhatsApp;
