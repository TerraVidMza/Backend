import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { almacenContexto } from './request-context';

/** Cabecera de correlación, en la forma que ya usan proxies y clientes. */
const CABECERA_REQUEST_ID = 'x-request-id';

interface RequestConUsuario extends Request {
  user?: { id?: string };
}

/**
 * Abre el contexto de la request y encadena el resto del pipeline dentro.
 *
 * Corre antes que los guards, así que `req.user` todavía no está poblado; el
 * `usuarioId` lo completa el interceptor de auditoría, que sí corre después.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: RequestConUsuario, res: Response, next: NextFunction): void {
    // Se respeta el id que venga de afuera: así una operación que atraviesa el
    // proxy, la API y —más adelante— otro servicio se sigue con un solo valor.
    // Se acota el largo porque es un dato que entra sin validar y termina en el
    // log.
    const entrante = req.get(CABECERA_REQUEST_ID)?.slice(0, 64);
    const requestId = entrante && entrante.length > 0 ? entrante : randomUUID();

    // Devolverlo es lo que vuelve útil la correlación del lado del cliente: con
    // este valor, un usuario que reporta un error permite encontrar sus líneas
    // exactas en el log.
    res.setHeader('X-Request-Id', requestId);

    almacenContexto.run(
      {
        requestId,
        // `req.ip` respeta X-Forwarded-For solo con `trust proxy` configurado;
        // sin eso, detrás de un reverse proxy todas las entradas del log
        // quedarían con la IP del proxy.
        ip: req.ip ?? null,
        usuarioId: null,
        userAgent: req.get('user-agent') ?? null,
      },
      () => next(),
    );
  }
}
