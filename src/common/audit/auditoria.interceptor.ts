import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { LogAuditoriaService } from '../../modules/log-auditoria/log-auditoria.service';
import { AUDITAR_KEY, OpcionesAuditoria } from './auditar.decorator';
import { contextoActual } from './request-context';

interface RequestAutenticada extends Request {
  user?: { id?: string };
}

/**
 * Registra en el log de auditoría los handlers marcados con `@Auditar`.
 *
 * Solo audita respuestas exitosas: un intento fallido no cambió nada, y los
 * intentos de login fallidos se registran aparte porque ahí el intento mismo
 * es el evento de interés (HU-01).
 */
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly logAuditoria: LogAuditoriaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const opciones = this.reflector.getAllAndOverride<OpcionesAuditoria>(
      AUDITAR_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!opciones) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestAutenticada>();
    const actorId = request.user?.id;

    return next.handle().pipe(
      tap((resultado) => {
        if (!actorId) return;

        const contexto = contextoActual();
        const cuerpo =
          opciones.datos === 'ninguno' ? null : this.extraerCuerpo(request);
        const transicion = this.resolverTransicion(opciones, resultado);
        // Sin await: la auditoría no puede demorar la respuesta, y
        // `registrar()` ya absorbe sus propios errores fuera de transacción.
        void this.logAuditoria.registrar({
          actorId,
          accion: opciones.accion,
          entidad: opciones.entidad,
          entidadId: this.resolverEntidadId(opciones, request, resultado),
          datosAnteriores: transicion?.anterior ?? null,
          datosNuevos: transicion
            ? { ...(cuerpo ?? {}), ...transicion.nuevo }
            : cuerpo,
          ipAddress: contexto?.ip ?? null,
        });
      }),
    );
  }

  private resolverEntidadId(
    opciones: OpcionesAuditoria,
    request: RequestAutenticada,
    resultado: unknown,
  ): string | null {
    if (opciones.idDesde?.startsWith('param:')) {
      const nombre = opciones.idDesde.slice('param:'.length);
      const params = request.params as Record<string, string | undefined>;
      return params[nombre] ?? null;
    }

    if (resultado && typeof resultado === 'object' && 'id' in resultado) {
      const id = (resultado as { id?: unknown }).id;
      return typeof id === 'string' ? id : null;
    }
    return null;
  }

  /**
   * `{ estado: 'borrador' }` → `{ estado: 'aprobado' }`. Si el handler no
   * devuelve el campo, no se inventa el estado nuevo: se omite la transición.
   */
  private resolverTransicion(
    opciones: OpcionesAuditoria,
    resultado: unknown,
  ): {
    anterior: Record<string, unknown>;
    nuevo: Record<string, unknown>;
  } | null {
    if (!opciones.transicion) return null;
    const { campo, desde } = opciones.transicion;
    if (!resultado || typeof resultado !== 'object' || !(campo in resultado)) {
      return null;
    }
    const nuevo = (resultado as Record<string, unknown>)[campo];
    return { anterior: { [campo]: desde }, nuevo: { [campo]: nuevo } };
  }

  /**
   * El cuerpo enviado es el "qué cambió". `registrar()` le saca credenciales
   * y tokens antes de persistirlo.
   */
  private extraerCuerpo(
    request: RequestAutenticada,
  ): Record<string, unknown> | null {
    const body: unknown = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return null;
    }
    return body as Record<string, unknown>;
  }
}
