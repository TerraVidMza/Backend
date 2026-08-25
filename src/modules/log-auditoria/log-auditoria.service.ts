import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindOptionsWhere,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { LogAuditoria } from './entities/log-auditoria.entity';
import { ListarLogAuditoriaDto } from './dto/listar-log-auditoria.dto';
import {
  armarResultado,
  calcularPaginacion,
  ResultadoPaginado,
} from '../../common/dto/pagination-query.dto';
import { rangoDeFechas } from '../../common/fechas/rango-fechas';

interface RegistrarAccionParams {
  actorId: string;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  datosAnteriores?: Record<string, unknown> | null;
  datosNuevos?: Record<string, unknown> | null;
  ipAddress?: string | null;
  /**
   * `EntityManager` de una transacción en curso. Cuando se pasa, el registro de
   * auditoría se confirma o se revierte junto con la operación auditada: sin
   * esto quedaban entradas de cambios que después hicieron rollback (HU-07).
   */
  manager?: EntityManager;
}

/**
 * Campos que nunca se copian a `datos_anteriores` / `datos_nuevos`.
 * El log es consultable por el Auditor, así que un hash o un token guardado
 * acá es una filtración con retención indefinida.
 */
const CAMPOS_SENSIBLES = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'passwordActual',
  'passwordNueva',
  'token',
  'tokenHash',
  'token_hash',
  'accessToken',
  'refreshToken',
]);

@Injectable()
export class LogAuditoriaService {
  private readonly logger = new Logger(LogAuditoriaService.name);

  constructor(
    @InjectRepository(LogAuditoria)
    private readonly logRepository: Repository<LogAuditoria>,
  ) {}

  /**
   * Registra una acción auditable.
   *
   * Fuera de una transacción nunca propaga el error: que falle la auditoría no
   * puede tumbar la operación del usuario. Dentro de una transacción sí lo
   * propaga, porque ahí el criterio es el contrario —el cambio y su registro
   * son atómicos—.
   */
  async registrar(params: RegistrarAccionParams): Promise<void> {
    const datos = {
      actorId: params.actorId,
      accion: params.accion,
      entidad: params.entidad,
      entidadId: params.entidadId ?? null,
      datosAnteriores: this.sanitizar(params.datosAnteriores),
      datosNuevos: this.sanitizar(params.datosNuevos),
      ipAddress: params.ipAddress ?? null,
    };

    if (params.manager) {
      await params.manager.save(params.manager.create(LogAuditoria, datos));
      return;
    }

    try {
      await this.logRepository.save(this.logRepository.create(datos));
    } catch (error) {
      this.logger.error(
        `No se pudo registrar la auditoría de ${params.accion} sobre ${params.entidad}: ${(error as Error).message}`,
      );
    }
  }

  /** Copia el objeto omitiendo credenciales y tokens. */
  private sanitizar(
    datos?: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (!datos) return null;
    const limpio: Record<string, unknown> = {};
    for (const [clave, valor] of Object.entries(datos)) {
      if (!CAMPOS_SENSIBLES.has(clave)) {
        limpio[clave] = valor;
      }
    }
    return limpio;
  }

  async findByUsuario(actorId: string): Promise<LogAuditoria[]> {
    return this.logRepository.find({
      where: { actorId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Solo los eventos generados por usuarios de la empresa del solicitante.
   * Sin este filtro, un Auditor veía la actividad de todas las empresas.
   *
   * El `take: 200` fijo que había antes no era paginación: recortaba en seco y
   * dejaba el resto del historial inalcanzable desde la API.
   */
  async findAll(
    empresaId: string,
    query: ListarLogAuditoriaDto = {},
  ): Promise<ResultadoPaginado<LogAuditoria>> {
    const { page, pageSize, skip, take } = calcularPaginacion(query);

    const where: FindOptionsWhere<LogAuditoria> = { actor: { empresaId } };
    if (query.actorId) where.actorId = query.actorId;
    if (query.entidad) where.entidad = query.entidad;
    if (query.accion) where.accion = query.accion;
    if (query.entidadId) where.entidadId = query.entidadId;

    const rango = rangoDeFechas(query.desde, query.hasta);
    if (rango) where.createdAt = rango;

    const resultado = await this.logRepository.findAndCount({
      where,
      // Sin `actor` el listado solo muestra el UUID del responsable, y el
      // criterio de HU-05 pide identificar quién hizo cada cambio.
      relations: { actor: true },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });

    return armarResultado(resultado, page, pageSize);
  }

  /** Entradas más recientes dentro de una ventana de horas (dashboard del Auditor, HU-32). */
  async findRecientes(
    empresaId: string,
    horas = 24,
    limite = 10,
  ): Promise<LogAuditoria[]> {
    const desde = new Date(Date.now() - horas * 60 * 60 * 1000);
    return this.logRepository.find({
      where: { createdAt: MoreThanOrEqual(desde), actor: { empresaId } },
      relations: { actor: true },
      order: { createdAt: 'DESC' },
      take: limite,
    });
  }
}
