import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RegistroLabor } from './entities/registro-labor.entity';
import { DetalleInsumoLabor } from './entities/detalle-insumo-labor.entity';
import { CreateRegistroLaborDto } from './dto/create-registro-labor.dto';
import { TipoLaborService } from '../tipo-labor/tipo-labor.service';
import { InsumosService } from '../insumos/insumos.service';
import { EstadoSync } from '../../common/enums/estado-sync.enum';

export interface SyncResultItem {
  localUuid: string;
  estado: EstadoSync;
  registroId?: string;
  errorMessage?: string;
}

@Injectable()
export class RegistroLaborService {
  private readonly logger = new Logger(RegistroLaborService.name);

  constructor(
    @InjectRepository(RegistroLabor)
    private readonly registroLaborRepository: Repository<RegistroLabor>,
    @InjectRepository(DetalleInsumoLabor)
    private readonly detalleInsumoLaborRepository: Repository<DetalleInsumoLabor>,
    private readonly tipoLaborService: TipoLaborService,
    private readonly insumosService: InsumosService,
    private readonly dataSource: DataSource,
  ) {}

  findByCuartel(cuartelId: string): Promise<RegistroLabor[]> {
    return this.registroLaborRepository.find({
      where: { cuartelId },
      relations: { tipoLabor: true, usuario: true },
      order: { fecha: 'DESC' },
    });
  }

  async findById(id: string): Promise<RegistroLabor> {
    const registro = await this.registroLaborRepository.findOne({
      where: { id },
      relations: { tipoLabor: true, cuartel: true, usuario: true },
    });
    if (!registro) {
      throw new NotFoundException('Registro de labor no encontrado');
    }
    return registro;
  }

  /**
   * Idempotente: si local_uuid ya existe, retorna el registro existente sin duplicar
   * (soporta reintentos de sincronización tras desconexiones).
   */
  async registrarUno(
    dto: CreateRegistroLaborDto,
    usuarioId: string,
  ): Promise<SyncResultItem> {
    const existente = await this.registroLaborRepository.findOne({
      where: { localUuid: dto.localUuid },
    });
    if (existente) {
      return {
        localUuid: dto.localUuid,
        estado: existente.estadoSync,
        registroId: existente.id,
      };
    }

    return this.dataSource.transaction(async (manager) => {
      try {
        const costoLabor = await this.tipoLaborService.getCostoVigente(
          dto.tipoLaborId,
          new Date(dto.fecha),
        );

        const registro = manager.create(RegistroLabor, {
          localUuid: dto.localUuid,
          cuartelId: dto.cuartelId,
          tipoLaborId: dto.tipoLaborId,
          usuarioId,
          fecha: dto.fecha,
          cantidad: dto.cantidad,
          costoUnitarioAlSync: costoLabor?.costoUnitario ?? null,
          estadoSync: EstadoSync.SINCRONIZADO,
          syncedAt: new Date(),
        });
        const registroGuardado = await manager.save(registro);

        for (const item of dto.insumos) {
          const costoInsumo = await this.insumosService.getCostoVigente(
            item.insumoId,
            new Date(dto.fecha),
          );
          const detalle = manager.create(DetalleInsumoLabor, {
            registroLaborId: registroGuardado.id,
            insumoId: item.insumoId,
            cantidadUsada: item.cantidadUsada,
            costoUnitarioAlSync: costoInsumo?.costoUnitario ?? null,
          });
          await manager.save(detalle);
        }

        return {
          localUuid: dto.localUuid,
          estado: EstadoSync.SINCRONIZADO,
          registroId: registroGuardado.id,
        };
      } catch (error) {
        this.logger.error(
          `Error al sincronizar registro ${dto.localUuid}`,
          error as Error,
        );

        const registroError = manager.create(RegistroLabor, {
          localUuid: dto.localUuid,
          cuartelId: dto.cuartelId,
          tipoLaborId: dto.tipoLaborId,
          usuarioId,
          fecha: dto.fecha,
          cantidad: dto.cantidad,
          estadoSync: EstadoSync.ERROR,
          errorMessage: (error as Error).message,
        });
        await manager.save(registroError);

        return {
          localUuid: dto.localUuid,
          estado: EstadoSync.ERROR,
          errorMessage: (error as Error).message,
        };
      }
    });
  }

  async sincronizarLote(
    registros: CreateRegistroLaborDto[],
    usuarioId: string,
  ): Promise<SyncResultItem[]> {
    const resultados: SyncResultItem[] = [];
    for (const registro of registros) {
      resultados.push(await this.registrarUno(registro, usuarioId));
    }
    return resultados;
  }

  async getMargenBrutoPorCuartel(cuartelId: string): Promise<{
    costoLabores: number;
    costoInsumos: number;
    costoTotal: number;
  }> {
    const registros = await this.registroLaborRepository.find({
      where: { cuartelId },
    });
    const costoLabores = registros.reduce(
      (acc, r) => acc + Number(r.cantidad) * Number(r.costoUnitarioAlSync ?? 0),
      0,
    );

    const registroIds = registros.map((r) => r.id);
    let costoInsumos = 0;
    if (registroIds.length > 0) {
      const detalles = await this.detalleInsumoLaborRepository
        .createQueryBuilder('d')
        .where('d.registro_labor_id IN (:...ids)', { ids: registroIds })
        .getMany();
      costoInsumos = detalles.reduce(
        (acc, d) =>
          acc + Number(d.cantidadUsada) * Number(d.costoUnitarioAlSync ?? 0),
        0,
      );
    }

    return {
      costoLabores,
      costoInsumos,
      costoTotal: costoLabores + costoInsumos,
    };
  }
}
