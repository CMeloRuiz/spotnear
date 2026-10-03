/**
 * Validación de entrada con Zod.
 *
 * Se valida body, query y params por separado y se REEMPLAZA el valor original
 * por el parseado: así los handlers siempre reciben datos tipados y limpios,
 * y nunca campos de más que el cliente haya mandado.
 */
import { AppError } from '../utils/errors.js';

function formatearIssues(error) {
  return error.issues.map((i) => ({
    campo: i.path.join('.') || '(raíz)',
    mensaje: i.message,
  }));
}

/**
 * @param {{ body?: import('zod').ZodTypeAny, query?: import('zod').ZodTypeAny, params?: import('zod').ZodTypeAny }} esquemas
 */
export function validar(esquemas) {
  return (req, res, next) => {
    try {
      if (esquemas.params) req.params = esquemas.params.parse(req.params);
      if (esquemas.query) {
        // req.query es un getter de solo lectura en Express 5 y un objeto en 4.
        // Guardamos el resultado en req.datosQuery para no depender de eso.
        req.datosQuery = esquemas.query.parse(req.query);
      }
      if (esquemas.body) req.body = esquemas.body.parse(req.body ?? {});
      next();
    } catch (error) {
      if (error?.issues) {
        return next(
          new AppError('Revisá los datos ingresados.', 422, 'DATOS_INVALIDOS', {
            campos: formatearIssues(error),
          }),
        );
      }
      next(error);
    }
  };
}

export default validar;
