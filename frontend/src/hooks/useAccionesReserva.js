/**
 * Acciones sobre reservas (check-in, check-out, cancelar, no-show) y el
 * compartir por WhatsApp.
 *
 * Está en un hook y no en cada pantalla porque el dashboard, el listado y el
 * detalle hacen exactamente lo mismo: se comportan igual y avisan igual.
 */
import { useState, useCallback } from 'react';
import { admin } from '../services/spotnear.service.js';
import { useToast } from '../context/ToastContext.jsx';
import textos from '../i18n/textos.js';

const MENSAJE_OK = {
  'check-in': 'Check-in registrado',
  'check-out': 'Check-out registrado',
  confirmar: 'Reserva confirmada',
  cancelar: 'Reserva cancelada',
  'no-show': 'Marcada como no presentada',
};

export function useAccionesReserva({ alActualizar } = {}) {
  const toast = useToast();

  const [procesando, setProcesando] = useState(null);
  const [whatsapp, setWhatsapp] = useState({ abierto: false, cargando: false, mensaje: '', link: '', titulo: '' });

  /**
   * @param {object} reserva
   * @param {'check-in'|'check-out'|'confirmar'|'cancelar'|'no-show'} accion
   */
  const ejecutar = useCallback(
    async (reserva, accion) => {
      // Cancelar y no-show no tienen vuelta atrás: se confirman.
      if (accion === 'cancelar' && !window.confirm(textos.admin.reservas.confirmarCancelar)) return;
      if (accion === 'no-show' && !window.confirm('¿Marcar esta reserva como no presentada?')) return;

      setProcesando(reserva.id);
      try {
        const r = await admin.reservas.accion(reserva.id, accion);
        toast.ok(MENSAJE_OK[accion] ?? 'Reserva actualizada');
        alActualizar?.(r.reserva);
        return r.reserva;
      } catch (error) {
        toast.error(error.message ?? textos.errores.generico);
        return null;
      } finally {
        setProcesando(null);
      }
    },
    [toast, alActualizar],
  );

  /** Abre la ventana de WhatsApp con el mensaje armado por el backend. */
  const abrirWhatsApp = useCallback(
    async (reserva, destino = 'grupo') => {
      setWhatsapp({
        abierto: true,
        cargando: true,
        mensaje: '',
        link: '',
        titulo:
          destino === 'grupo'
            ? textos.admin.detalleReserva.compartirGrupo
            : textos.admin.detalleReserva.compartirCliente,
      });

      try {
        const r = await admin.reservas.whatsapp(reserva.id, destino);
        setWhatsapp((w) => ({ ...w, cargando: false, mensaje: r.mensaje, link: r.link }));
      } catch (error) {
        setWhatsapp({ abierto: false, cargando: false, mensaje: '', link: '', titulo: '' });
        toast.error(error.message ?? textos.errores.generico);
      }
    },
    [toast],
  );

  /** Resumen del día, para pegar en el grupo de una sola vez. */
  const abrirResumenDia = useCallback(
    async (fecha) => {
      setWhatsapp({
        abierto: true,
        cargando: true,
        mensaje: '',
        link: '',
        titulo: textos.admin.reservas.resumenDia,
      });

      try {
        const r = await admin.reservas.resumenDia(fecha);
        setWhatsapp((w) => ({ ...w, cargando: false, mensaje: r.mensaje, link: r.link }));
      } catch (error) {
        setWhatsapp({ abierto: false, cargando: false, mensaje: '', link: '', titulo: '' });
        toast.error(error.message ?? textos.errores.generico);
      }
    },
    [toast],
  );

  const cerrarWhatsApp = useCallback(
    () => setWhatsapp({ abierto: false, cargando: false, mensaje: '', link: '', titulo: '' }),
    [],
  );

  return { procesando, ejecutar, whatsapp, abrirWhatsApp, abrirResumenDia, cerrarWhatsApp };
}

export default useAccionesReserva;
