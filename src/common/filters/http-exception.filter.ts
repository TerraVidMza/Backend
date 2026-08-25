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
const PG_EXCLUSION_VIOLATION = '23P01';
const PG_RESTRICT_VIOLATION = '23001';
/**
 * Dato con sintaxis inválida para el tipo de la columna: una fecha que no es
 * fecha, un número que no es número. Es siempre entrada mal formada del cliente,
 * nunca una falla del servidor.
 */
const PG_INVALID_DATETIME_FORMAT = '22007';
const PG_INVALID_TEXT_REPRESENTATION = '22P02';

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
  excl_campanias_sin_solape:
    'El rango se superpone con otra campaña de la empresa. Las campañas no pueden solaparse.',
  chk_campania_rango:
    'La fecha de fin de la campaña debe ser posterior a la de inicio.',
  uq_campanias_nombre: 'Ya existe una campaña con ese nombre en la empresa.',
  uq_device_token:
    'Ese token de dispositivo ya está registrado para otro usuario.',
  uq_recomendacion_activa:
    'Ya existe una recomendación activa de esa regla para el cuartel.',
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
      // Solapamiento de campañas (D-014). El servicio ya lo valida y da un
      // mensaje con la campaña que choca; acá se cubre el caso concurrente, en
      // que dos altas pasan la validación antes de que cualquiera inserte.
      case PG_EXCLUSION_VIOLATION:
        return {
          status: HttpStatus.CONFLICT,
          message:
            mensajeEspecifico ??
            'El rango se superpone con otro registro existente.',
          constraint,
        };
      // El trigger append-only del log de auditoría (HU-07). Que llegue acá
      // significa que algún camino de la aplicación intentó modificarlo: es un
      // bug, no una entrada inválida del usuario.
      case PG_RESTRICT_VIOLATION:
        return {
          status: HttpStatus.FORBIDDEN,
          message: 'La operación está prohibida sobre este registro.',
          constraint,
        };
      /**
       * Red de seguridad para los parámetros mal formados que se escapen de un
       * DTO. Un `?desde=basura` llegaba al SQL y devolvía **500**, que le dice
       * al cliente "el servidor se cayó" cuando el problema es lo que mandó.
       *
       * Lo correcto sigue siendo validar en el DTO —así el mensaje dice qué
       * campo y qué formato se espera—; esto sólo garantiza que un descuido
       * cueste un 400 y no una caída, en un endpoint nuevo o en uno viejo que
       * nadie revisó.
       */
      case PG_INVALID_DATETIME_FORMAT:
      case PG_INVALID_TEXT_REPRESENTATION:
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Alguno de los datos enviados tiene un formato inválido.',
          constraint,
        };
      default:
        return null;
    }
  }
}
