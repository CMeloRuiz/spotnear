/**
 * Íconos.
 *
 * Son SVG inline en un solo archivo, sin librería: pesan poco, heredan el
 * color del texto (currentColor) y no agregan una dependencia más al proyecto.
 *
 * Uso:  <Icono nombre="lupa" />  ·  <Icono nombre="auto" tam={20} />
 */

/** Trazos de cada ícono, sobre una grilla de 24×24. */
const TRAZOS = {
  lupa: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,

  pin: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.7" />
    </>
  ),

  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),

  reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>,

  auto: (
    <>
      <path d="M4 16v2.5a1 1 0 0 1-1 1H2.5M20 16v2.5a1 1 0 0 0 1 1h.5" />
      <path d="M3 16v-3.2a2 2 0 0 1 .2-.9l2-4A2 2 0 0 1 7 6.8h10a2 2 0 0 1 1.8 1.1l2 4a2 2 0 0 1 .2.9V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
      <path d="M3.6 12h16.8" />
      <circle cx="7.5" cy="14.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="14.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),

  camioneta: (
    <>
      <path d="M2 16V9.5a1.5 1.5 0 0 1 1.5-1.5H13v8" />
      <path d="M13 11h4.2a2 2 0 0 1 1.7 1l2 3.2a2 2 0 0 1 .1 1V16a1 1 0 0 1-1 1h-1" />
      <path d="M2 16h1.2M9.8 16h4.4" />
      <circle cx="6.5" cy="17" r="2" />
      <circle cx="17.5" cy="17" r="2" />
    </>
  ),

  moto: (
    <>
      <circle cx="5" cy="16.5" r="3.2" />
      <circle cx="19" cy="16.5" r="3.2" />
      <path d="M5 16.5h5l3.5-6H10M13.5 10.5 16 16.5M13 6h3l1.4 3" />
    </>
  ),

  utilitario: (
    <>
      <rect x="2" y="7" width="13" height="9" rx="1.5" />
      <path d="M15 10h3.4a2 2 0 0 1 1.7 1l1.6 2.6a2 2 0 0 1 .3 1V16h-2" />
      <circle cx="6.5" cy="17.5" r="1.8" />
      <circle cx="17.5" cy="17.5" r="1.8" />
      <path d="M8.3 17.5h7.4" />
    </>
  ),

  estrella: (
    <path
      d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9L12 3.6Z"
      fill="currentColor"
      stroke="none"
    />
  ),

  camara: (
    <>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.8l1.3-2h6.8l1.3 2h2.8A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5Z" />
      <circle cx="12" cy="13" r="3.4" />
    </>
  ),

  escudo: (
    <>
      <path d="M12 3 5 6v5.5c0 4.3 2.9 8.2 7 9.5 4.1-1.3 7-5.2 7-9.5V6l-7-3Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),

  techo: <><path d="M3 11 12 4l9 7" /><path d="M5 11v9h14v-9" /><path d="M9.5 20v-5h5v5" /></>,

  rayo: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" />,

  reloj24: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
      <path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21" />
    </>
  ),

  agua: <path d="M12 3s6 6.6 6 10.4A6 6 0 0 1 6 13.4C6 9.6 12 3 12 3Z" />,

  llave: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8 2 2-2 2 2 2-2 2-2-2-2 2-2-2" /></>,

  estacionamiento: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M9.5 17V7.5h3.2a3 3 0 0 1 0 6H9.5" />
    </>
  ),

  flechaAbajo: <path d="m6 9 6 6 6-6" />,
  flechaArriba: <path d="m6 15 6-6 6 6" />,
  flechaIzquierda: <path d="m14 6-6 6 6 6" />,
  flechaDerecha: <path d="m10 6 6 6-6 6" />,

  check: <path d="m5 13 4.5 4.5L19 7.5" />,

  checkCirculo: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12.2 2.4 2.4 4.6-4.9" /></>,

  equis: <path d="m6 6 12 12M18 6 6 18" />,

  mas: <path d="M12 5v14M5 12h14" />,

  menos: <path d="M5 12h14" />,

  whatsapp: (
    <path
      d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.14c-.25.69-1.44 1.32-1.99 1.36-.53.04-1.02.23-3.44-.72-2.9-1.14-4.73-4.1-4.87-4.29-.14-.2-1.16-1.55-1.16-2.95 0-1.4.73-2.09.99-2.37.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.41-.07.65.49.24.58.81 2 .88 2.14.07.14.12.31.02.5-.1.19-.15.31-.29.48-.14.16-.3.37-.43.49-.14.14-.29.29-.13.57.17.29.74 1.22 1.59 1.98 1.09.97 2.01 1.27 2.29 1.41.29.14.45.12.62-.07.17-.19.72-.84.91-1.13.19-.29.38-.24.64-.14.26.09 1.67.79 1.95.93.29.14.48.21.55.33.07.12.07.69-.18 1.38Z"
      fill="currentColor"
      stroke="none"
    />
  ),

  mail: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></>,

  telefono: (
    <path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L17 13l4 1.5v3a2 2 0 0 1-2.2 2A16.8 16.8 0 0 1 3.5 5.2 2 2 0 0 1 5.5 3Z" />
  ),

  descargar: <><path d="M12 3.5v11" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M4 18.5v1a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5v-1" /></>,

  imagen: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.7" />
      <path d="m4 17 4.8-4.5a1.6 1.6 0 0 1 2.2 0L16 17M14 14.2l1.6-1.5a1.6 1.6 0 0 1 2.2 0L20.5 15" />
    </>
  ),

  mapa: (
    <>
      <path d="m3 6.5 6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5Z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </>
  ),

  lista: <><path d="M9 6.5h11M9 12h11M9 17.5h11" /><circle cx="4.7" cy="6.5" r="1.3" fill="currentColor" stroke="none" /><circle cx="4.7" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="4.7" cy="17.5" r="1.3" fill="currentColor" stroke="none" /></>,

  filtro: <path d="M3.5 5.5h17l-6.5 7.5v6l-4 2v-8L3.5 5.5Z" />,

  menu: <path d="M4 7h16M4 12h16M4 17h16" />,

  usuario: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>,

  gente: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16.5 5.2a3.4 3.4 0 0 1 0 6.6M17.5 14.2a6.2 6.2 0 0 1 3.7 5.8" />
    </>
  ),

  salir: <><path d="M15 4.5h3a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-3" /><path d="M10 8 6 12l4 4M6 12h9" /></>,

  tablero: (
    <>
      <rect x="3" y="3" width="7.5" height="8.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="5.5" rx="2" />
      <rect x="3" y="14.5" width="7.5" height="6.5" rx="2" />
      <rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2" />
    </>
  ),

  ticket: (
    <>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h15A1.5 1.5 0 0 1 21 8.5v2a2.2 2.2 0 0 0 0 4.4v1.6A1.5 1.5 0 0 1 19.5 18h-15A1.5 1.5 0 0 1 3 16.5v-1.6a2.2 2.2 0 0 0 0-4.4Z" />
      <path d="M12 8.2v1.6M12 11.7v1.6M12 15.2v1.6" strokeDasharray="0.1 2.6" />
    </>
  ),

  dinero: <><circle cx="12" cy="12" r="9" /><path d="M14.8 9.2A3 3 0 0 0 12 7.5c-1.7 0-2.8.9-2.8 2.1 0 3 5.8 1.6 5.8 4.6 0 1.3-1.2 2.3-3 2.3a3.2 3.2 0 0 1-3-1.8" /><path d="M12 6v12" /></>,

  grafico: <><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8 20v-6M12.5 20V8M17 20v-9" /></>,

  evento: (
    <>
      <path d="M12 3v7.5" />
      <path d="M8.5 6.5 12 3l3.5 3.5" />
      <rect x="3.5" y="10.5" width="17" height="10" rx="2.5" />
      <path d="M8 14.5h8M8 17.5h5" />
    </>
  ),

  editar: <><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m15 6 3 3" /></>,

  basura: <><path d="M4 7h16" /><path d="M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" /><path d="M6.5 7 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" /><path d="M10.5 11v5.5M13.5 11v5.5" /></>,

  copiar: <><rect x="8.5" y="8.5" width="12" height="12" rx="2.2" /><path d="M15.5 5.5v-.8a1.2 1.2 0 0 0-1.2-1.2H4.7a1.2 1.2 0 0 0-1.2 1.2v9.6a1.2 1.2 0 0 0 1.2 1.2h.8" /></>,

  compartir: <><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m8.3 10.8 7.4-4.1M8.3 13.2l7.4 4.1" /></>,

  alerta: <><path d="M12 4.5 2.8 20h18.4L12 4.5Z" /><path d="M12 10.5v4M12 17.2v.1" /></>,

  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.8v.1" /></>,

  ayuda: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.4M12 16.8v.1" /></>,

  externo: <><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10" /></>,

  qr: (
    <>
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5" />
      <path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM14 20.5h1M20.5 14v1.5" />
    </>
  ),

  llegada: <><path d="M3 12h12" /><path d="m11 8 4 4-4 4" /><path d="M18 4v16" /></>,

  salida: <><path d="M9 12h12" /><path d="m17 8 4 4-4 4" /><path d="M4 4v16" /></>,

  ubicacion: <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="8" /><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" /></>,

  edificio: (
    <>
      <path d="M4 21V5.5A1.5 1.5 0 0 1 5.5 4h8A1.5 1.5 0 0 1 15 5.5V21" />
      <path d="M15 11h3.5A1.5 1.5 0 0 1 20 12.5V21" />
      <path d="M2.5 21h19" />
      <path d="M7.5 8h4M7.5 12h4M7.5 16h4" />
    </>
  ),

  sinLugar: <><circle cx="12" cy="12" r="9" /><path d="m8 8 8 8" /></>,

  // Ojo abierto: la contraseña se está viendo.
  ojo: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  // Ojo tachado: la contraseña está oculta.
  ojoTachado: (
    <>
      <path d="M9.9 5.7A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.8 3.6" />
      <path d="M6.3 7.3A16.9 16.9 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.8-.3 4-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3.5 3.5 17 17" />
    </>
  ),
  candado: <><rect x="4.5" y="10" width="15" height="10.5" rx="2.5" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /></>,
};

/**
 * @param {object} props
 * @param {keyof typeof TRAZOS} props.nombre
 * @param {number} [props.tam=20]
 * @param {number} [props.grosor=1.7]
 */
export function Icono({ nombre, tam = 20, grosor = 1.7, className = '', ...resto }) {
  const trazo = TRAZOS[nombre];
  if (!trazo) return null;

  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...resto}
    >
      {trazo}
    </svg>
  );
}

/** Ícono correspondiente a cada tipo de vehículo. */
export const ICONO_VEHICULO = {
  AUTO: 'auto',
  CAMIONETA: 'camioneta',
  // El SUV comparte el ícono: dibujar dos siluetas casi iguales no aporta.
  SUV: 'camioneta',
  MOTO: 'moto',
  UTILITARIO: 'utilitario',
};

/** Ícono correspondiente a cada servicio del estacionamiento. */
export const ICONO_SERVICIO = {
  camaras: 'camara',
  '24hs': 'reloj24',
  vigilancia: 'escudo',
  techado: 'techo',
  lavado: 'agua',
  valet: 'llave',
  cargador_electrico: 'rayo',
};

export default Icono;
