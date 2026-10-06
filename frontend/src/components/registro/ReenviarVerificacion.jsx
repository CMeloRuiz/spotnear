/**
 * "Reenviar email de verificación".
 *
 * Lo usan la pantalla de "te enviamos un email" del registro, la del link
 * vencido o inválido, y la pantalla de reenvío (/verificar-email) para quien
 * perdió el mail. El backend responde siempre lo mismo, exista o no la
 * solicitud, así que acá tampoco se distingue.
 *
 * Después de mandar, el botón espera ESPERA_S segundos: el primer mail puede
 * tardar un poco, y tocar diez veces no lo hace llegar antes.
 */
import { useEffect, useState } from 'react';
import { Campo } from '../ui/Campo.jsx';
import { Icono } from '../ui/Iconos.jsx';
import { Aviso } from '../ui/Varios.jsx';
import { publico } from '../../services/spotnear.service.js';
import { esEmailValido } from '../../utils/validaciones.js';
import textos from '../../i18n/textos.js';

const t = textos.registro.verificacion;
const ESPERA_S = 30;

/**
 * @param {object} props
 * @param {string} [props.email]          Si viene, se manda a ese sin pedirlo.
 * @param {(enlace: string) => void} [props.alEnlaceDePrueba]  Solo en desarrollo.
 */
export function ReenviarVerificacion({ email: emailFijo, alEnlaceDePrueba }) {
  const [email, setEmail] = useState(emailFijo ?? '');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return undefined;
    const id = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [espera]);

  const reenviar = async (e) => {
    e?.preventDefault();
    const destino = (emailFijo ?? email).trim();
    if (!esEmailValido(destino)) {
      setError(textos.errores.emailInvalido);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const r = await publico.reenviarVerificacion(destino);
      setMensaje(r.mensaje);
      setEspera(ESPERA_S);
      if (r.enlaceDePrueba) alEnlaceDePrueba?.(r.enlaceDePrueba);
    } catch (err) {
      setError(err.message ?? textos.errores.generico);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="sn-reenviar" onSubmit={reenviar} noValidate>
      {!emailFijo && (
        <Campo
          name="email"
          type="email"
          label={t.tuEmail}
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          error={error}
        />
      )}
      {emailFijo && error && <Aviso tipo="error">{error}</Aviso>}
      {mensaje && <Aviso tipo="ok">{mensaje}</Aviso>}
      <button type="submit" className="sn-boton sn-boton--secundario" disabled={enviando || espera > 0}>
        {enviando ? (
          <span className="sn-spinner" style={{ width: 16, height: 16 }} aria-hidden="true" />
        ) : (
          <Icono nombre="mail" tam={17} />
        )}
        {espera > 0 ? t.reenviarEn(espera) : t.reenviar}
      </button>
    </form>
  );
}

export default ReenviarVerificacion;
