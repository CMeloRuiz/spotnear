/**
 * Gráfico de reservas por día. SVG puro, sin librerías de gráficos.
 *
 * Decisiones de diseño (una sola serie, magnitud en el tiempo):
 *  · Barras, que es la forma correcta para comparar magnitudes discretas.
 *  · Sin leyenda: con una sola serie, el título ya dice qué se está mirando.
 *  · El color de las barras es --sn-marca-fuerte (#1177C5) y no el azul del
 *    logo (#188FEB): el del logo queda en 3,40:1 contra el fondo blanco, al
 *    filo del mínimo de 3:1 que necesita un elemento gráfico. Este da 4,70:1.
 *  · Etiquetas directas solo en el máximo y en hoy; poner el número sobre cada
 *    barra convierte el gráfico en una tabla fea.
 *  · Tooltip al pasar el mouse o tocar, y tabla equivalente para lectores de
 *    pantalla: la información nunca depende solo del color ni de la forma.
 */
import { useState, useId, useMemo } from 'react';
import { precio as fmtPrecio, DIAS_CORTOS } from '../../utils/formato.js';
import './GraficoBarras.css';

const ALTO = 180;
const PADDING_SUPERIOR = 24;
const PADDING_INFERIOR = 28;

/**
 * @param {object} props
 * @param {Array<{ fecha: string, cantidad: number, monto: number }>} props.serie
 * @param {string} props.titulo
 */
export function GraficoBarras({ serie = [], titulo, className = '' }) {
  const [activo, setActivo] = useState(null);
  const idTabla = useId();

  const { maximo, hoyIndice, maxIndice } = useMemo(() => {
    const max = Math.max(...serie.map((d) => d.cantidad), 1);
    const claveHoy = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    return {
      maximo: max,
      hoyIndice: serie.findIndex((d) => d.fecha === claveHoy),
      maxIndice: serie.findIndex((d) => d.cantidad === max && max > 0),
    };
  }, [serie]);

  if (serie.length === 0) return null;

  const altoUtil = ALTO - PADDING_SUPERIOR - PADDING_INFERIOR;
  const anchoBarra = 100 / serie.length;

  /** Fecha "2026-09-21" → { dia: "Lun", numero: "21" } sin pasar por Date (evita el corrimiento de zona). */
  const partirFecha = (clave) => {
    const [a, m, d] = clave.split('-').map(Number);
    const fecha = new Date(a, m - 1, d);
    return { dia: DIAS_CORTOS[fecha.getDay()], numero: String(d) };
  };

  // Líneas de referencia: mínimas y recesivas, solo para poder leer alturas.
  const guias = [0, 0.5, 1].map((f) => ({
    valor: Math.round(maximo * f),
    y: PADDING_SUPERIOR + altoUtil * (1 - f),
  }));

  return (
    <figure className={`sn-grafico ${className}`}>
      <figcaption className="sn-grafico__titulo">{titulo}</figcaption>

      <div className="sn-grafico__lienzo">
        <svg
          viewBox={`0 0 100 ${ALTO}`}
          preserveAspectRatio="none"
          className="sn-grafico__svg"
          role="img"
          aria-labelledby={idTabla}
        >
          {/* Guías horizontales */}
          {guias.map((g) => (
            <line
              key={g.y}
              x1="0"
              x2="100"
              y1={g.y}
              y2={g.y}
              className={g.valor === 0 ? 'sn-grafico__base' : 'sn-grafico__guia'}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {serie.map((d, i) => {
            const alto = d.cantidad > 0 ? Math.max(3, (d.cantidad / maximo) * altoUtil) : 0;
            const y = PADDING_SUPERIOR + altoUtil - alto;
            // 2px de aire entre barras vecinas, expresado en el sistema de
            // coordenadas del viewBox (que es de 100 unidades de ancho).
            const separacion = Math.min(anchoBarra * 0.3, 1.4);
            const x = i * anchoBarra + separacion / 2;
            const ancho = anchoBarra - separacion;
            const esHoy = i === hoyIndice;

            return (
              <g key={d.fecha}>
                {/* Zona sensible: más grande que la barra, para poder apuntarle */}
                <rect
                  x={i * anchoBarra}
                  y={0}
                  width={anchoBarra}
                  height={ALTO}
                  fill="transparent"
                  onMouseEnter={() => setActivo(i)}
                  onMouseLeave={() => setActivo(null)}
                  onFocus={() => setActivo(i)}
                  onBlur={() => setActivo(null)}
                  tabIndex={0}
                  role="presentation"
                  className="sn-grafico__zona"
                />

                {d.cantidad > 0 && (
                  <rect
                    x={x}
                    y={y}
                    width={ancho}
                    height={alto}
                    rx="1.2"
                    className={`sn-grafico__barra ${esHoy ? 'sn-grafico__barra--hoy' : ''} ${activo === i ? 'sn-grafico__barra--activa' : ''}`}
                    pointerEvents="none"
                  />
                )}

                {/* Etiqueta directa solo en el máximo y en hoy */}
                {(i === maxIndice || esHoy) && d.cantidad > 0 && activo !== i && (
                  <text
                    x={x + ancho / 2}
                    y={y - 7}
                    className="sn-grafico__valor"
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    {d.cantidad}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Eje de días en HTML: el texto dentro de un SVG con preserveAspectRatio
            "none" se deformaría junto con el lienzo. */}
        <div className="sn-grafico__eje" aria-hidden="true">
          {serie.map((d, i) => {
            const { dia, numero } = partirFecha(d.fecha);
            return (
              <span
                key={d.fecha}
                className={`sn-grafico__etiqueta ${i === hoyIndice ? 'sn-grafico__etiqueta--hoy' : ''}`}
              >
                <span className="sn-grafico__etiqueta-dia">{dia}</span>
                <span className="sn-grafico__etiqueta-num">{numero}</span>
              </span>
            );
          })}
        </div>

        {/* Tooltip */}
        {activo !== null && serie[activo] && (
          <div
            className="sn-grafico__tooltip"
            style={{
              left: `${(activo + 0.5) * anchoBarra}%`,
              // Cerca de los bordes el tooltip se corre para no salirse
              transform: `translateX(${activo < serie.length / 4 ? '-10%' : activo > (serie.length * 3) / 4 ? '-90%' : '-50%'})`,
            }}
            role="status"
          >
            <strong>
              {(() => {
                const { dia, numero } = partirFecha(serie[activo].fecha);
                return `${dia} ${numero}`;
              })()}
            </strong>
            <span>
              {serie[activo].cantidad}{' '}
              {serie[activo].cantidad === 1 ? 'reserva' : 'reservas'}
            </span>
            <span className="sn-grafico__tooltip-monto">{fmtPrecio(serie[activo].monto)}</span>
          </div>
        )}
      </div>

      {/* Tabla equivalente para lectores de pantalla */}
      <table className="sn-solo-lectores" id={idTabla}>
        <caption>{titulo}</caption>
        <thead>
          <tr>
            <th scope="col">Día</th>
            <th scope="col">Reservas</th>
            <th scope="col">Monto</th>
          </tr>
        </thead>
        <tbody>
          {serie.map((d) => (
            <tr key={d.fecha}>
              <th scope="row">{d.fecha}</th>
              <td>{d.cantidad}</td>
              <td>{fmtPrecio(d.monto)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export default GraficoBarras;
