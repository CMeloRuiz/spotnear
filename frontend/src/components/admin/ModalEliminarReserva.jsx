/**
 * Confirmación para quitar del panel una reserva terminada.
 *
 * Lo usan el listado (ícono al final de la fila) y el detalle. Es una acción
 * irreversible desde el panel, así que siempre pasa por acá: nunca se elimina
 * con un solo clic.
 */
import { useState } from 'react';
import { Aviso, Modal } from '../ui/Varios.jsx';
import { admin } from '../../services/spotnear.service.js';
import { useToast } from '../../context/ToastContext.jsx';
import textos from '../../i18n/textos.js';

/** Estados que se pueden quitar del panel. Espejo de ESTADOS_ELIMINABLES del backend. */
export const ESTADOS_ELIMINABLES = ['FINALIZADA', 'CANCELADA', 'NO_SHOW'];

export const sePuedeEliminar = (reserva) => ESTADOS_ELIMINABLES.includes(reserva?.estado);

/**
 * @param {object} props
 * @param {object|null} props.reserva  La reserva a eliminar; null = modal cerrado.
 * @param {() => void} props.alCerrar
 * @param {() => void} props.alEliminar Se llama después de eliminarla.
 */
export function ModalEliminarReserva({ reserva, alCerrar, alEliminar }) {
  const toast = useToast();
  const [eliminando, setEliminando] = useState(false);
  const t = textos.admin.reservas;

  const eliminar = async () => {
    setEliminando(true);
    try {
      const r = await admin.reservas.eliminar(reserva.id);
      toast.ok(r?.mensaje ?? t.eliminada);
      alEliminar();
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    } finally {
      setEliminando(false);
    }
  };

  return (
    <Modal
      abierto={Boolean(reserva)}
      alCerrar={alCerrar}
      titulo={reserva ? t.eliminarTitulo(reserva.codigo) : ''}
      ancho={460}
      pie={
        <>
          <button type="button" className="sn-boton sn-boton--fantasma" onClick={alCerrar}>
            {textos.comunes.cancelar}
          </button>
          <button
            type="button"
            className="sn-boton sn-boton--peligro"
            onClick={eliminar}
            disabled={eliminando}
          >
            {eliminando ? textos.comunes.guardando : t.eliminar}
          </button>
        </>
      }
    >
      <div className="sn-form">
        <Aviso tipo="error">{t.eliminarAviso}</Aviso>
        <p>{t.eliminarTexto}</p>
      </div>
    </Modal>
  );
}

export default ModalEliminarReserva;
