import type express from 'express';

/**
 * Error con código HTTP para cortar una ruta desde cualquier punto (404, 409…). El manejador de
 * errores de `index.ts` lo convierte en una respuesta JSON con el mensaje tal cual.
 */
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type AsyncRoute = (req: express.Request, res: express.Response) => Promise<unknown>;

/**
 * Express 4 no captura promesas rechazadas: sin esto, un error de Mongo dentro de una ruta async
 * deja la petición colgada hasta que expira. Acá se derivan al manejador de errores.
 */
export function asyncRoute(handler: AsyncRoute): express.RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}
