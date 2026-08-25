import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

/** Códigos de error de PostgreSQL que corresponden a un problema del cliente. */
const PG_UNIQUE_VIOLATION = '23505';
const PG_CHECK_VIOLATION = '23514';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_NOT_NULL_VIOLATION = '23502';

/**
 * Mensajes por constraint. La alternativa —exponer el texto de Postgres— filtra
 * nombres de tablas y columnas al cliente, y además es ilegible para el usuario.
 */
const MENSAJES_POR_CONSTRAINT: Record<string, string> = {
  uq_costo_insumo_vigencia:
    'Ya existe un costo para ese insumo con la misma fecha de vigencia. Elegí otra fecha o corregí el costo existente.',
  uq_costo_labor_vigencia:
    'Ya existe un costo para ese tipo de labor con la misma fecha de vigencia. Elegí otra fecha o corregí el costo existente.',
  uq_tarifa_cuadrilla_vigencia:
    'Ya existe una tarifa para esa cuadrilla con la misma fecha de vigencia. Elegí otra fecha o corregí la tarifa existente.',
  uq_detalle_insumo_labor:
    'El insumo está repetido en la misma labor. Sumá las cantidades en una sola línea.',
  chk_pesaje_kg_positivos: 'Los kilos del pesaje deben ser mayores que cero.',
  chk_registro_labor_cantidad_positiva:
    'La cantidad de la labor debe ser mayor que cero.',
  chk_detalle_cantidad_positiva:
    'La cantidad de insumo utilizada debe ser mayor que cero.',
};

interface ErrorPostgres {
  code?: string;
  constraint?: string;
  detail?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const traducido = this.traducirErrorDeBase(exception);

    const status: HttpStatus =
      traducido?.status ??
      (exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR);

    const message =
      traducido?.message ??
      (exception instanceof HttpException
        ? exception.getResponse()
        : 'Error interno del servidor');

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
    } else if (traducido) {
      // Una constraint que salta es la última línea de defensa: si llegó hasta
      // acá es porque la validación de servicio no la cubrió, y eso se revisa.
      this.logger.warn(
        `Constraint de base violada en ${request.method} ${request.url}: ${traducido.constraint ?? 'desconocida'}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message:
        typeof message === 'string'
          ? message
          : ((message as { message?: string | string[] }).message ?? message),
    });
  }

  /**
   * Una violación de constraint es un error del cliente, no del servidor:
   * devolvía 500 y el front no tenía forma de distinguirla de una caída real.
   */
  private traducirErrorDeBase(exception: unknown): {
    status: HttpStatus;
    message: string;
    constraint?: string;
  } | null {
    if (!(exception instanceof QueryFailedError)) {
      return null;
    }

    const { code, constraint } = exception.driverError as ErrorPostgres;
    const mensajeEspecifico = constraint
      ? MENSAJES_POR_CONSTRAINT[constraint]
      : undefined;

    switch (code) {
      case PG_UNIQUE_VIOLATION:
        return {
          status: HttpStatus.CONFLICT,
          message: mensajeEspecifico ?? 'El registro ya existe.',
          constraint,
        };
      case PG_CHECK_VIOLATION:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: mensajeEspecifico ?? 'Los datos enviados no son válidos.',
          constraint,
        };
      case PG_FOREIGN_KEY_VIOLATION:
        return {
          status: HttpStatus.CONFLICT,
          message:
            'La operación referencia un registro inexistente, o el registro está en uso y no puede eliminarse.',
          constraint,
        };
      case PG_NOT_NULL_VIOLATION:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Falta un dato obligatorio.',
          constraint,
        };
      default:
        return null;
    }
  }
}
