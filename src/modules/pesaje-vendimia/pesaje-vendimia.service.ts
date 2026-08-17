import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PesajeVendimia } from './entities/pesaje-vendimia.entity';
import { CreatePesajeDto } from './dto/create-pesaje.dto';
import { CuadrillasService } from '../cuadrillas/cuadrillas.service';
import { EstadoSync } from '../../common/enums/estado-sync.enum';

export interface SyncPesajeResultItem {
  localUuid: string;
  estado: EstadoSync;
  pesajeId?: string;
  errorMessage?: string;
}

@Injectable()
export class PesajeVendimiaService {
  private readonly logger = new Logger(PesajeVendimiaService.name);

  constructor(
    @InjectRepository(PesajeVendimia)
    private readonly pesajeRepository: Repository<PesajeVendimia>,
    private readonly cuadrillasService: CuadrillasService,
  ) {}

  findByCuartel(cuartelId: string): Promise<PesajeVendimia[]> {
    return this.pesajeRepository.find({
      where: { cuartelId },
      relations: { cuadrilla: true },
      order: { fecha: 'DESC' },
    });
  }

  async findById(id: string): Promise<PesajeVendimia> {
    const pesaje = await this.pesajeRepository.findOne({
      where: { id },
      relations: { cuadrilla: true, cuartel: true },
    });
    if (!pesaje) {
      throw new NotFoundException('Pesaje no encontrado');
    }
    return pesaje;
  }

  /**
   * Idempotente por local_uuid, igual que registro-labor: soporta reintentos
   * de sincronización desde la app móvil tras desconexiones.
   */
  async registrarUno(dto: CreatePesajeDto, registradoPorId: string): Promise<SyncPesajeResultItem> {
    const existente = await this.pesajeRepository.findOne({ where: { localUuid: dto.localUuid } });
    if (existente) {
      return { localUuid: dto.localUuid, estado: existente.estadoSync, pesajeId: existente.id };
    }

    try {
      const tarifa = await this.cuadrillasService.getTarifaVigente(dto.cuadrillaId, new Date(dto.fecha));

      const pesaje = this.pesajeRepository.create({
        localUuid: dto.localUuid,
        cuadrillaId: dto.cuadrillaId,
        cuartelId: dto.cuartelId,
        registradoPorId,
        fecha: dto.fecha,
        kgTotales: dto.kgTotales,
        tarifaUtilizada: tarifa?.tarifaPorKg ?? null,
        montoLiquidacion: tarifa ? Number(tarifa.tarifaPorKg) * dto.kgTotales : null,
        estadoSync: EstadoSync.SINCRONIZADO,
        estado: 'pendiente_remito',
        syncedAt: new Date(),
      });
      const guardado = await this.pesajeRepository.save(pesaje);

      return { localUuid: dto.localUuid, estado: EstadoSync.SINCRONIZADO, pesajeId: guardado.id };
    } catch (error) {
      this.logger.error(`Error al sincronizar pesaje ${dto.localUuid}`, error as Error);

      const pesajeError = this.pesajeRepository.create({
        localUuid: dto.localUuid,
        cuadrillaId: dto.cuadrillaId,
        cuartelId: dto.cuartelId,
        registradoPorId,
        fecha: dto.fecha,
        kgTotales: dto.kgTotales,
        estadoSync: EstadoSync.ERROR,
        estado: 'pendiente_remito',
      });
      await this.pesajeRepository.save(pesajeError);

      return { localUuid: dto.localUuid, estado: EstadoSync.ERROR, errorMessage: (error as Error).message };
    }
  }

  async sincronizarLote(pesajes: CreatePesajeDto[], registradoPorId: string): Promise<SyncPesajeResultItem[]> {
    const resultados: SyncPesajeResultItem[] = [];
    for (const pesaje of pesajes) {
      resultados.push(await this.registrarUno(pesaje, registradoPorId));
    }
    return resultados;
  }

  async getEstadoCosechaPorCuartel(cuartelId: string): Promise<{
    kgTotalesCosechados: number;
    kgLiquidados: number;
    kgPendientesDeRemito: number;
    montoLiquidadoTotal: number;
  }> {
    const pesajes = await this.pesajeRepository.find({ where: { cuartelId } });

    const kgTotalesCosechados = pesajes.reduce((acc, p) => acc + Number(p.kgTotales), 0);
    const liquidados = pesajes.filter((p) => p.estado === 'liquidado');
    const kgLiquidados = liquidados.reduce((acc, p) => acc + Number(p.kgTotales), 0);
    const montoLiquidadoTotal = liquidados.reduce((acc, p) => acc + Number(p.montoLiquidacion ?? 0), 0);
    const kgPendientesDeRemito = pesajes
      .filter((p) => p.estado === 'pendiente_remito')
      .reduce((acc, p) => acc + Number(p.kgTotales), 0);

    return { kgTotalesCosechados, kgLiquidados, kgPendientesDeRemito, montoLiquidadoTotal };
  }
}
