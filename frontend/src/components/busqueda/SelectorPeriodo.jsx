/**
 * Selector de horario de ingreso y salida.
 *
 * Se usan inputs nativos `datetime-local`: en el celular abren el selector del
 * sistema, que es el que la gente ya sabe usar, y no hay que mantener un
 * calendario propio. El input trabaja en hora local, que es justo lo que
 * queremos (todo el producto opera en hora de Buenos Aires).
 *
 * Debajo de los campos no va nada más: los atajos de duración (2 h, 4 h…) y el
 * resumen del período en formato argentino se sacaron a pedido, porque cargaban
 * la tarjeta del hero. Contrapartida conocida: el input nativo se dibuja con el
 * formato del navegador, y en un Chrome en inglés eso es mm/dd/aaaa.
 *
 * Dos formas de dibujarlo, misma lógica:
 *
 *   · `separado` (tarjeta del hero) → dos casillas independientes, una al lado
 *     de la otra: Ingreso y Salida se leen como dos campos distintos, que es lo
 *     que espera cualquiera que reservó alguna vez.
 *   · por defecto (barra de resultados) → una sola casilla con los dos campos
 *     adentro, porque ahí la barra compite en ancho con el destino y el botón.
 */
import { useId } from 'react';
import { Icono } from '../ui/Iconos.jsx';
import { paraInputDateTime } from '../../utils/formato.js';
import textos from '../../i18n/textos.js';
import './SelectorPeriodo.css';

/**
 * @param {object} props
 * @param {Date} props.inicio
 * @param {Date} props.fin
 * @param {(cambios: { inicio?: Date, fin?: Date }) => void} props.onChange
 * @param {string} [props.error]
 */
export function SelectorPeriodo({
  inicio,
  fin,
  onChange,
  error,
  compacto = false,
  separado = false,
  className = '',
}) {
  const idInicio = useId();
  const idFin = useId();

  const cambiarInicio = (valor) => {
    if (!valor) return;
    const nuevoInicio = new Date(valor);
    if (Number.isNaN(nuevoInicio.getTime())) return;

    // Si el nuevo ingreso deja la salida en el pasado, se corre la salida
    // manteniendo la duración que el usuario ya había elegido.
    const cambios = { inicio: nuevoInicio };
    if (fin <= nuevoInicio) {
      const duracionMs = Math.max(3_600_000, fin - inicio);
      cambios.fin = new Date(nuevoInicio.getTime() + duracionMs);
    }
    onChange(cambios);
  };

  const cambiarFin = (valor) => {
    if (!valor) return;
    const nuevoFin = new Date(valor);
    if (Number.isNaN(nuevoFin.getTime())) return;
    onChange({ fin: nuevoFin });
  };

  const icono = (
    <span className="sn-periodo__icono" aria-hidden="true">
      <Icono nombre="calendario" tam={compacto ? 17 : 19} />
    </span>
  );

  const campoInicio = (
    <div className="sn-periodo__campo">
      <label className="sn-periodo__label" htmlFor={idInicio}>
        {textos.busqueda.desde}
      </label>
      <input
        id={idInicio}
        type="datetime-local"
        className="sn-periodo__input"
        value={paraInputDateTime(inicio)}
        onChange={(e) => cambiarInicio(e.target.value)}
        aria-invalid={error ? 'true' : undefined}
      />
    </div>
  );

  const campoFin = (
    <div className="sn-periodo__campo">
      <label className="sn-periodo__label" htmlFor={idFin}>
        {textos.busqueda.hasta}
      </label>
      <input
        id={idFin}
        type="datetime-local"
        className="sn-periodo__input"
        value={paraInputDateTime(fin)}
        min={paraInputDateTime(inicio)}
        onChange={(e) => cambiarFin(e.target.value)}
        aria-invalid={error ? 'true' : undefined}
      />
    </div>
  );

  const claseCaja = `sn-periodo__caja ${error ? 'sn-periodo__caja--error' : ''}`;

  return (
    <div
      className={[
        'sn-periodo',
        compacto ? 'sn-periodo--compacto' : '',
        separado ? 'sn-periodo--separado' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {separado ? (
        <div className="sn-periodo__fila">
          <div className={claseCaja}>
            {icono}
            {campoInicio}
          </div>
          <div className={claseCaja}>
            {icono}
            {campoFin}
          </div>
        </div>
      ) : (
        <div className={claseCaja}>
          {icono}
          {campoInicio}

          <span className="sn-periodo__separador" aria-hidden="true">
            <Icono nombre="flechaDerecha" tam={14} />
          </span>

          {campoFin}
        </div>
      )}

      {error && (
        <span className="sn-campo__error" role="alert">
          <Icono nombre="alerta" tam={13} />
          {error}
        </span>
      )}
    </div>
  );
}

export default SelectorPeriodo;
