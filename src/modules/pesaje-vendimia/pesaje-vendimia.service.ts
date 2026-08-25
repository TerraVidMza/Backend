import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PesajeVendimia } from './entities/pesaje-vendimia.entity';
import { CreatePesajeDto } from './dto/create-pesaje.dto';
import { CuadrillasService } from '../cuadrillas/cuadrillas.service';
import { EstadoSync } from '../../common/enums/estado-sync.enum';
import { EstadoPesaje } from './entities/estado-pesaje.enum';
import { Cuartel } from '../cuarteles/entities/cuartel.entity';
import { Cuadrilla } from '../cuadrillas/entities/cuadrilla.entity';
import { EstadoCuartel } from '../cuarteles/entities/estado-cuartel.enum';
import {
  armarResultado,
  calcularPaginacion,
  PaginationQueryDto,
  ResultadoPaginado,
} from '../../common/dto/pagination-query.dto';

export interface SyncPesajeResultItem {
  localUuid: string;
  estado: EstadoSync;
  pesajeId?: string;
  errorMessage?: string;
  /** true cuando el pesaje ya estaba sincronizado (reintento idempotente). */
  yaExistia?: boolean;
  /** true cuando la cuadrilla está dada de baja: se acepta y se marca (HU-14). */
  inconsistenciaCatalogo?: boolean;
}

@Injectable()
export class PesajeVendimiaService {
  private readonly logger = new Logger(PesajeVendimiaService.name);

  constructor(
    @InjectRepository(PesajeVendimia)
    private readonly pesajeRepository: Repository<PesajeVendimia>,
    @InjectRepository(Cuartel)
    private readonly cuartelRepository: Repository<Cuartel>,
    @InjectRepository(Cuadrilla)
    private readonly cuadrillaRepository: Repository<Cuadrilla>,
    private readonly cuadrillasService: CuadrillasService,
  ) {}

  /** Solo pesajes sincronizados: los que quedaron en error no son cosecha confirmada. */
  async findByCuartel(
    cuartelId: string,
    query: PaginationQueryDto = {},
  ): Promise<ResultadoPaginado<PesajeVendimia>> {
    const { page, pageSize, skip, take } = calcularPaginacion(query);

    const resultado = await this.pesajeRepository.findAndCount({
      where: { cuartelId, estadoSync: EstadoSync.SINCRONIZADO },
      relations: { cuadrilla: true },
      order: { fecha: 'DESC' },
      skip,
      take,
    });

    return armarResultado(resultado, page, pageSize);
  }

  /** `empresaId` acota al tenant siguiendo cuartel → finca → empresa. */
  async findById(id: string, empresaId: string): Promise<PesajeVendimia> {
    const pesaje = await this.pesajeRepository.findOne({
      where: { id, cuartel: { finca: { empresaId } } },
      relations: { cuadrilla: true, cuartel: { finca: true } },
    });
    if (!pesaje) {
      throw new NotFoundException('Pesaje no encontrado');
    }
    return pesaje;
  }

  /**
   * Idempotente por local_uuid, igual que registro-labor. Un pesaje que quedó
   * en ERROR sí se reprocesa, para que el Capataz pueda corregir y reintentar
   * con el mismo uuid.
   */
  async registrarUno(
    dto: CreatePesajeDto,
    registradoPorId: string,
  ): Promise<SyncPesajeResultItem> {
    const existente = await this.pesajeRepository.findOne({
      where: { localUuid: dto.localUuid },
    });

    if (existente && existente.estadoSync !== EstadoSync.ERROR) {
      return {
        localUuid: dto.localUuid,
        estado: existente.estadoSync,
        pesajeId: existente.id,
        yaExistia: true,
      };
    }

    try {
      const cuartel = await this.cuartelRepository.findOne({
        where: { id: dto.cuartelId },
      });
      if (!cuartel) {
        throw new Error('El cuartel indicado no existe.');
      }
      if (!cuartel.activo) {
        throw new Error('El cuartel está dado de baja.');
      }
      // Un cuartel cosechado ya tiene su remito aprobado: aceptar pesajes
      // nuevos dejaría kilos fuera de toda liquidación (HU-28).
      if (cuartel.estado === EstadoCuartel.COSECHADO) {
        throw new Error(
          'El cuartel ya está cosechado y no acepta nuevos pesajes.',
        );
      }

      const tarifa = await this.cuadrillasService.getTarifaVigente(
        dto.cuadrillaId,
        dto.fecha,
      );

      // Sin tarifa vigente el pesaje entraría al circuito con kilos y sin
      // liquidación: sumaría al remito sin sumar dinero, en silencio.
      if (!tarifa) {
        throw new Error(
          `La cuadrilla no tiene tarifa vigente a la fecha ${dto.fecha}. El Propietario debe asignarla antes de sincronizar el pesaje.`,
        );
      }

      // La cuadrilla dada de baja no invalida el pesaje: los kilos se
      // cosecharon igual. Se marca para revisión (HU-14).
      const inconsistenciaCatalogo = await this.cuadrillaDeBaja(
        dto.cuadrillaId,
      );

      const guardado = await this.pesajeRepository.save(
        this.pesajeRepository.create({
          ...(existente ? { id: existente.id } : {}),
          localUuid: dto.localUuid,
          cuadrillaId: dto.cuadrillaId,
          cuartelId: dto.cuartelId,
          registradoPorId,
          fecha: dto.fecha,
          kgTotales: dto.kgTotales,
          tarifaUtilizada: tarifa.tarifaPorKg,
          montoLiquidacion: this.calcularLiquidacion(
            tarifa.tarifaPorKg,
            dto.kgTotales,
          ),
          estadoSync: EstadoSync.SINCRONIZADO,
          errorMessage: null,
          estado: EstadoPesaje.PENDIENTE_REMITO,
          createdAtLocal: dto.createdAtLocal
            ? new Date(dto.createdAtLocal)
            : new Date(),
          inconsistenciaCatalogo,
          syncedAt: new Date(),
        }),
      );

      // Primer pesaje sincronizado del cuartel: arranca la cosecha (HU-28).
      if (cuartel.estado === EstadoCuartel.PENDIENTE) {
        await this.cuartelRepository.update(cuartel.id, {
          estado: EstadoCuartel.EN_COSECHA,
        });
      }

      return {
        localUuid: dto.localUuid,
        estado: EstadoSync.SINCRONIZADO,
        pesajeId: guardado.id,
        inconsistenciaCatalogo,
      };
    } catch (error) {
      const mensaje = (error as Error).message;
      this.logger.error(
        `Error al sincronizar pesaje ${dto.localUuid}: ${mensaje}`,
      );
      await this.persistirPesajeConError(dto, registradoPorId, mensaje);
      return {
        localUuid: dto.localUuid,
        estado: EstadoSync.ERROR,
        errorMessage: mensaje,
      };
    }
  }

  async sincronizarLote(
    pesajes: CreatePesajeDto[],
    registradoPorId: string,
  ): Promise<SyncPesajeResultItem[]> {
    const resultados: SyncPesajeResultItem[] = [];
    // Más antiguos primero (HU-14): el orden de los pesajes determina cuál
    // dispara la transición del cuartel a `en_cosecha`.
    const enOrden = [...pesajes].sort((a, b) =>
      (a.createdAtLocal ?? '').localeCompare(b.createdAtLocal ?? ''),
    );
    for (const pesaje of enOrden) {
      // Cada ítem por separado: un pesaje inválido no puede tumbar el lote.
      try {
        resultados.push(await this.registrarUno(pesaje, registradoPorId));
      } catch (error) {
        const mensaje = (error as Error).message;
        this.logger.error(
          `Fallo inesperado sincronizando ${pesaje.localUuid}: ${mensaje}`,
        );
        resultados.push({
          localUuid: pesaje.localUuid,
          estado: EstadoSync.ERROR,
          errorMessage: mensaje,
        });
      }
    }
    return resultados;
  }

  /** La cuadrilla existe pero está dada de baja: inconsistencia de catálogo. */
  private cuadrillaDeBaja(cuadrillaId: string): Promise<boolean> {
    return this.cuadrillaRepository.exists({
      where: { id: cuadrillaId, activa: false },
    });
  }

  /**
   * Redondeo explícito a 2 decimales: la columna es `decimal(_, 2)` y dejar
   * que la base trunque un float de JS produce diferencias de centavos.
   */
  private calcularLiquidacion(
    tarifaPorKg: string | number,
    kg: number,
  ): number {
    return Math.round(Number(tarifaPorKg) * kg * 100) / 100;
  }

  private async persistirPesajeConError(
    dto: CreatePesajeDto,
    registradoPorId: string,
    mensaje: string,
  ): Promise<void> {
    try {
      const previo = await this.pesajeRepository.findOne({
        where: { localUuid: dto.localUuid },
      });
      if (previo) {
        await this.pesajeRepository.update(previo.id, {
          estadoSync: EstadoSync.ERROR,
          errorMessage: mensaje,
        });
        return;
      }
      await this.pesajeRepository.save(
        this.pesajeRepository.create({
          localUuid: dto.localUuid,
          cuadrillaId: dto.cuadrillaId,
          cuartelId: dto.cuartelId,
          registradoPorId,
          fecha: dto.fecha,
          kgTotales: dto.kgTotales,
          estadoSync: EstadoSync.ERROR,
          errorMessage: mensaje,
          estado: EstadoPesaje.PENDIENTE_REMITO,
        }),
      );
    } catch (error) {
      this.logger.error(
        `No se pudo persistir el estado de error de ${dto.localUuid}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Estado de cosecha de todos los cuarteles de una finca (HU-28).
   *
   * Es la vista de seguimiento de la vendimia: una fila por cuartel con su
   * estado y sus kilos. Se agrega en SQL para no traer todos los pesajes de la
   * finca a memoria, que en plena vendimia son miles por día.
   */
  async getEstadoCosechaPorFinca(fincaId: string): Promise<{
    cuarteles: Array<{
      cuartelId: string;
      cuartelNombre: string;
      estado: EstadoCuartel;
      hectareas: number | null;
      kgTotalesCosechados: number;
      kgLiquidados: number;
      kgPendientesDeRemito: number;
      kgObservados: number;
      cantidadCuadrillas: number;
      montoLiquidadoTotal: number;
      rendimientoKgPorHa: number | null;
    }>;
    totales: {
      kgTotalesCosechados: number;
      kgLiquidados: number;
      montoLiquidadoTotal: number;
      cuartelesCosechados: number;
      cuartelesEnCosecha: number;
      cuartelesPendientes: number;
    };
  }> {
    const filas = await this.pesajeRepository.query<
      Array<{
        cuartelId: string;
        cuartelNombre: string;
        estado: EstadoCuartel;
        hectareas: string | null;
        kgTotales: string;
        kgLiquidados: string;
        kgPendientes: string;
        kgObservados: string;
        cuadrillas: string;
        montoLiquidado: string;
      }>
    >(
      `SELECT c.id        AS "cuartelId",
              c.nombre    AS "cuartelNombre",
              c.estado    AS "estado",
              c.hectareas AS "hectareas",
              COALESCE(SUM(p.kg_totales), 0)                                        AS "kgTotales",
              COALESCE(SUM(p.kg_totales) FILTER (WHERE p.estado = $2), 0)           AS "kgLiquidados",
              COALESCE(SUM(p.kg_totales) FILTER (WHERE p.estado = $3), 0)           AS "kgPendientes",
              COALESCE(SUM(p.kg_totales) FILTER (WHERE p.estado = $4), 0)           AS "kgObservados",
              COUNT(DISTINCT p.cuadrilla_id)                                        AS "cuadrillas",
              COALESCE(SUM(p.monto_liquidacion) FILTER (WHERE p.estado = $2), 0)    AS "montoLiquidado"
         FROM cuarteles c
         LEFT JOIN pesajes_vendimia p
                ON p.cuartel_id = c.id
               AND p.estado_sync = $5
        WHERE c.finca_id = $1
          AND c.activo = true
        GROUP BY c.id, c.nombre, c.estado, c.hectareas
        ORDER BY c.nombre`,
      [
        fincaId,
        EstadoPesaje.LIQUIDADO,
        EstadoPesaje.PENDIENTE_REMITO,
        EstadoPesaje.OBSERVADO,
        EstadoSync.SINCRONIZADO,
      ],
    );

    const cuarteles = filas.map((f) => {
      const hectareas = f.hectareas === null ? null : Number(f.hectareas);
      const kgTotalesCosechados = Number(f.kgTotales);
      return {
        cuartelId: f.cuartelId,
        cuartelNombre: f.cuartelNombre,
        estado: f.estado,
        hectareas,
        kgTotalesCosechados,
        kgLiquidados: Number(f.kgLiquidados),
        kgPendientesDeRemito: Number(f.kgPendientes),
        kgObservados: Number(f.kgObservados),
        cantidadCuadrillas: Number(f.cuadrillas),
        montoLiquidadoTotal: Number(f.montoLiquidado),
        // El rendimiento por hectárea es el indicador con el que se compara un
        // cuartel contra otro; sin superficie cargada no se puede calcular.
        rendimientoKgPorHa:
          hectareas && hectareas > 0
            ? Math.round((kgTotalesCosechados / hectareas) * 100) / 100
            : null,
      };
    });

    return {
      cuarteles,
      totales: {
        kgTotalesCosechados: cuarteles.reduce(
          (a, c) => a + c.kgTotalesCosechados,
          0,
        ),
        kgLiquidados: cuarteles.reduce((a, c) => a + c.kgLiquidados, 0),
        montoLiquidadoTotal: cuarteles.reduce(
          (a, c) => a + c.montoLiquidadoTotal,
          0,
        ),
        cuartelesCosechados: cuarteles.filter(
          (c) => c.estado === EstadoCuartel.COSECHADO,
        ).length,
        cuartelesEnCosecha: cuarteles.filter(
          (c) => c.estado === EstadoCuartel.EN_COSECHA,
        ).length,
        cuartelesPendientes: cuarteles.filter(
          (c) => c.estado === EstadoCuartel.PENDIENTE,
        ).length,
      },
    };
  }

  async getEstadoCosechaPorCuartel(cuartelId: string): Promise<{
    estado: EstadoCuartel | null;
    kgTotalesCosechados: number;
    kgLiquidados: number;
    kgPendientesDeRemito: number;
    kgObservados: number;
    cantidadCuadrillas: number;
    montoLiquidadoTotal: number;
  }> {
    const cuartel = await this.cuartelRepository.findOne({
      where: { id: cuartelId },
    });
    const pesajes = await this.pesajeRepository.find({
      where: { cuartelId, estadoSync: EstadoSync.SINCRONIZADO },
    });

    const kgTotalesCosechados = pesajes.reduce(
      (acc, p) => acc + Number(p.kgTotales),
      0,
    );
    const liquidados = pesajes.filter(
      (p) => p.estado === EstadoPesaje.LIQUIDADO,
    );
    const kgLiquidados = liquidados.reduce(
      (acc, p) => acc + Number(p.kgTotales),
      0,
    );
    const montoLiquidadoTotal = liquidados.reduce(
      (acc, p) => acc + Number(p.montoLiquidacion ?? 0),
      0,
    );
    const kgPendientesDeRemito = pesajes
      .filter((p) => p.estado === EstadoPesaje.PENDIENTE_REMITO)
      .reduce((acc, p) => acc + Number(p.kgTotales), 0);

    const kgObservados = pesajes
      .filter((p) => p.estado === EstadoPesaje.OBSERVADO)
      .reduce((acc, p) => acc + Number(p.kgTotales), 0);

    return {
      estado: cuartel?.estado ?? null,
      kgTotalesCosechados,
      kgLiquidados,
      kgPendientesDeRemito,
      kgObservados,
      cantidadCuadrillas: new Set(pesajes.map((p) => p.cuadrillaId)).size,
      montoLiquidadoTotal,
    };
  }
}
