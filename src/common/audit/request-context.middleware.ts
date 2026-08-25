import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { almacenContexto } from './request-context';

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
  use(req: RequestConUsuario, _res: Response, next: NextFunction): void {
    almacenContexto.run(
      {
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
