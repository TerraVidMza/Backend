import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EstadoRemito, Remito } from './entities/remito.entity';
import { PesajeVendimia } from '../pesaje-vendimia/entities/pesaje-vendimia.entity';

@Injectable()
export class RemitosService {
  constructor(
    @InjectRepository(Remito)
    private readonly remitoRepository: Repository<Remito>,
    @InjectRepository(PesajeVendimia)
    private readonly pesajeRepository: Repository<PesajeVendimia>,
    private readonly dataSource: DataSource,
  ) {}

  findByCuartel(cuartelId: string): Promise<Remito[]> {
    return this.remitoRepository.find({ where: { cuartelId }, order: { fechaGeneracion: 'DESC' } });
  }

  async findById(id: string): Promise<Remito> {
    const remito = await this.remitoRepository.findOne({ where: { id } });
    if (!remito) {
      throw new NotFoundException('Remito no encontrado');
    }
    return remito;
  }

  async generarBorrador(cuartelId: string, generadoPorId: string): Promise<Remito> {
    return this.dataSource.transaction(async (manager) => {
      const pesajesPendientes = await manager.find(PesajeVendimia, {
        where: { cuartelId, estado: 'pendiente_remito' },
      });

      if (pesajesPendientes.length === 0) {
        throw new BadRequestException('No hay pesajes pendientes de remito para este cuartel');
      }

      const totalKg = pesajesPendientes.reduce((acc, p) => acc + Number(p.kgTotales), 0);
      const totalLiquidacion = pesajesPendientes.reduce((acc, p) => acc + Number(p.montoLiquidacion ?? 0), 0);

      const numeroRemito = await this.generarNumeroRemito(manager.getRepository(Remito));

      const remito = manager.create(Remito, {
        numeroRemito,
        cuartelId,
        generadoPorId,
        estado: EstadoRemito.BORRADOR,
        totalKg,
        totalLiquidacion,
        fecha: new Date().toISOString().slice(0, 10),
      });
      const remitoGuardado = await manager.save(remito);

      const ids = pesajesPendientes.map((p) => p.id);
      await manager.update(PesajeVendimia, ids, { remitoId: remitoGuardado.id, estado: 'en_remito' });

      return remitoGuardado;
    });
  }

  async aprobar(id: string, aprobadoPorId: string): Promise<Remito> {
    return this.dataSource.transaction(async (manager) => {
      const remito = await manager.findOne(Remito, { where: { id } });
      if (!remito) {
        throw new NotFoundException('Remito no encontrado');
      }
      if (remito.estado !== EstadoRemito.BORRADOR) {
        throw new BadRequestException('Solo se pueden aprobar remitos en estado borrador');
      }

      remito.estado = EstadoRemito.APROBADO;
      remito.aprobadoPorId = aprobadoPorId;
      remito.fechaAprobacion = new Date();
      const guardado = await manager.save(remito);

      await manager.update(PesajeVendimia, { remitoId: id }, { estado: 'liquidado' });

      return guardado;
    });
  }

  async rechazar(id: string, rechazadoPorId: string, motivoRechazo: string): Promise<Remito> {
    return this.dataSource.transaction(async (manager) => {
      const remito = await manager.findOne(Remito, { where: { id } });
      if (!remito) {
        throw new NotFoundException('Remito no encontrado');
      }
      if (remito.estado !== EstadoRemito.BORRADOR) {
        throw new BadRequestException('Solo se pueden rechazar remitos en estado borrador');
      }

      remito.estado = EstadoRemito.RECHAZADO;
      remito.rechazadoPorId = rechazadoPorId;
      remito.motivoRechazo = motivoRechazo;
      remito.fechaRechazo = new Date();
      const guardado = await manager.save(remito);

      // Libera los pesajes para que puedan agruparse en un nuevo borrador.
      await manager.update(PesajeVendimia, { remitoId: id }, { remitoId: null, estado: 'pendiente_remito' });

      return guardado;
    });
  }

  private async generarNumeroRemito(remitoRepository: Repository<Remito>): Promise<string> {
    const year = new Date().getFullYear();
    const count = await remitoRepository.count();
    return `REM-${year}-${String(count + 1).padStart(5, '0')}`;
  }
}
