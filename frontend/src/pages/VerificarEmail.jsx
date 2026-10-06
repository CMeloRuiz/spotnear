/**
 * Confirmación del email del alta.
 *
 *  · /verificar-email/:token → es el link del email. Le manda el token a la
 *    API y muestra el resultado: confirmado (la solicitud entró en revisión),
 *    ya confirmado, o link vencido / inválido con la opción de pedir otro.
 *  · /verificar-email        → pantalla de reenvío, para quien perdió el mail
 *    o no le llegó.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icono } from '../components/ui/Iconos.jsx';
import { Cargando } from '../components/ui/Estado.jsx';
import ReenviarVerificacion from '../components/registro/ReenviarVerificacion.jsx';
import { publico } from '../services/spotnear.service.js';
import { useTitulo } from '../hooks/index.js';
import textos from '../i18n/textos.js';
import './VerificarEmail.css';

const t = textos.registro.verificacion;

export function VerificarEmail() {
  const { token } = useParams();
  useTitulo(t.tituloPagina);

  // 'verificando' | 'listo' | 'yaVerificado' | 'error' | 'reenviar'
  const [estado, setEstado] = useState(token ? 'verificando' : 'reenviar');
  const [error, setError] = useState(null);
  const [enlaceDePrueba, setEnlaceDePrueba] = useState(null);
  // En desarrollo React monta dos veces: el token se manda una sola.
  const enviado = useRef(false);

  useEffect(() => {
    if (!token || enviado.current) return;
    enviado.current = true;
    publico
      .verificarEmail(token)
      .then((r) => setEstado(r.yaVerificado ? 'yaVerificado' : 'listo'))
      .catch((e) => {
        setError(e);
        setEstado('error');
      });
  }, [token]);

  if (estado === 'verificando') return <Cargando texto={t.verificando} />;

  const exito = estado === 'listo' || estado === 'yaVerificado';

  return (
    <div className="sn-contenedor sn-verificar">
      <div className="sn-verificar__tarjeta">
        <span
          className={`sn-verificar__icono ${exito ? 'sn-verificar__icono--ok' : ''}`}
          aria-hidden="true"
        >
          <Icono nombre={exito ? 'check' : 'mail'} tam={30} />
        </span>

        {estado === 'listo' && (
          <>
            <h1>{t.listoTitulo}</h1>
            <p>{t.listoTexto}</p>
          </>
        )}

        {estado === 'yaVerificado' && (
          <>
            <h1>{t.yaTitulo}</h1>
            <p>{t.yaTexto}</p>
          </>
        )}

        {estado === 'error' && (
          <>
            <h1>{error?.codigo === 'TOKEN_VENCIDO' ? t.vencidoTitulo : t.invalidoTitulo}</h1>
            <p>{error?.message}</p>
            <ReenviarVerificacion alEnlaceDePrueba={setEnlaceDePrueba} />
          </>
        )}

        {estado === 'reenviar' && (
          <>
            <h1>{t.reenviarTitulo}</h1>
            <p>{t.reenviarTexto}</p>
            <ReenviarVerificacion alEnlaceDePrueba={setEnlaceDePrueba} />
          </>
        )}

        {/* Solo en desarrollo, sin email configurado: el link que iría en el mail. */}
        {enlaceDePrueba && (
          <p className="sn-verificar__dev">
            {t.enlaceDePrueba}{' '}
            <a href={enlaceDePrueba}>{t.abrirEnlace}</a>
          </p>
        )}

        <Link to="/" className="sn-boton sn-boton--fantasma">
          {textos.registro.exitoVolver}
        </Link>
      </div>
    </div>
  );
}

export default VerificarEmail;
