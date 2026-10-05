/**
 * Aviso flotante mientras el servidor tarda en responder.
 *
 * El backend en el plan gratuito de Render se duerme sin tráfico y la primera
 * consulta después de eso puede tardar hasta un minuto. El cliente HTTP la
 * reintenta solo (services/api.js); esto le explica al usuario por qué está
 * esperando, en vez de dejarlo frente a un spinner mudo o un error prematuro.
 *
 * Además, al cargar el sitio se hace un pedido liviano a /health: si el
 * servidor estaba dormido, empieza a despertar mientras la persona todavía
 * está eligiendo destino y horario, antes de que apriete "Buscar".
 */
import { useEffect, useState } from 'react';
import { alEsperarServidor, despertarServidor } from '../../services/api.js';
import textos from '../../i18n/textos.js';
import './AvisoServidor.css';

export function AvisoServidor() {
  const [esperando, setEsperando] = useState(false);

  useEffect(() => alEsperarServidor(setEsperando), []);
  useEffect(() => {
    despertarServidor();
  }, []);

  if (!esperando) return null;

  return (
    <div className="sn-aviso-servidor" role="status" aria-live="polite">
      <span className="sn-spinner" style={{ width: 16, height: 16 }} aria-hidden="true" />
      <span>{textos.comunes.servidorDespertando}</span>
    </div>
  );
}

export default AvisoServidor;
