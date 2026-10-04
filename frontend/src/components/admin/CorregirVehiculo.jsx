/**
 * Corregir el tipo de vehículo de una reserva (en el check-in).
 *
 * El tipo lo eligió el cliente o lo detectó el catálogo por marca y modelo,
 * y alguien puede haber cargado un modelo equivocado —a propósito o no— para
 * pagar una tarifa más barata. El playero ve el vehículo en persona y lo
 * corrige acá.
 *
 * El ajuste es automático y solo sobre lo que se paga en el lugar: el backend
 * recotiza con el tipo nuevo y la diferencia se suma (o resta) a lo que el
 * cliente paga al llegar. La seña ya cobrada no cambia. Se muestra la
 * diferencia bien grande para que el playero la cobre.
 */
import { useState } from 'react';
import { Icono } from '../ui/Iconos.jsx';
import { Aviso } from '../ui/Varios.jsx';
import { admin } from '../../services/spotnear.service.js';
import { useToast } from '../../context/ToastContext.jsx';
import { precio as fmtPrecio } from '../../utils/formato.js';
import textos from '../../i18n/textos.js';

const TIPOS = ['AUTO', 'SUV', 'CAMIONETA', 'UTILITARIO', 'MOTO'];

/** Estados en los que tiene sentido corregirlo: antes de que se vaya. */
export const puedeCorregirVehiculo = (reserva) => ['CONFIRMADA', 'EN_CURSO'].includes(reserva?.estado);

export function CorregirVehiculo({ reserva, alCorregir }) {
  const t = textos.admin.detalleReserva.corregirVehiculo;
  const toast = useToast();
  const [tipo, setTipo] = useState(reserva.vehiculo.tipo);
  const [guardando, setGuardando] = useState(false);
  const [ajuste, setAjuste] = useState(null);

  const corregir = async () => {
    setGuardando(true);
    try {
      const r = await admin.reservas.cambiarVehiculo(reserva.id, tipo);
      setAjuste(r.ajuste);
      toast.ok(t.listo);
      alCorregir?.();
    } catch (e) {
      toast.error(e.message ?? textos.errores.generico);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="sn-corregir-vehiculo">
      <label className="sn-campo">
        <span className="sn-campo__label">{t.label}</span>
        <div className="sn-corregir-vehiculo__fila">
          <select className="sn-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((v) => (
              <option key={v} value={v}>
                {textos.parking.tiposVehiculo[v] ?? v}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="sn-boton sn-boton--secundario sn-boton--sm"
            onClick={corregir}
            disabled={guardando || tipo === reserva.vehiculo.tipo}
          >
            <Icono nombre="editar" tam={15} />
            {guardando ? textos.comunes.guardando : t.boton}
          </button>
        </div>
        <span className="sn-campo__ayuda">{t.ayuda}</span>
      </label>

      {ajuste && ajuste.diferencia !== 0 && (
        <Aviso tipo={ajuste.diferencia > 0 ? 'aviso' : 'info'}>
          {ajuste.diferencia > 0
            ? t.cobrarDeMas(fmtPrecio(ajuste.diferencia), fmtPrecio(ajuste.aPagarEnElLugarAhora))
            : t.cobrarDeMenos(fmtPrecio(-ajuste.diferencia), fmtPrecio(ajuste.aPagarEnElLugarAhora))}
        </Aviso>
      )}
    </div>
  );
}

export default CorregirVehiculo;
