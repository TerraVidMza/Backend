import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LogAuditoria } from './entities/log-auditoria.entity';

interface RegistrarAccionParams {
  actorId: string;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  datosAnteriores?: Record<string, unknown> | null;
  datosNuevos?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

@Injectable()
export class LogAuditoriaService {
  constructor(
    @InjectRepository(LogAuditoria)
    private readonly logRepository: Repository<LogAuditoria>,
  ) {}

  async registrar(params: RegistrarAccionParams): Promise<void> {
    const log = this.logRepository.create({
      actorId: params.actorId,
      accion: params.accion,
      entidad: params.entidad,
      entidadId: params.entidadId ?? null,
      datosAnteriores: params.datosAnteriores ?? null,
      datosNuevos: params.datosNuevos ?? null,
      ipAddress: params.ipAddress ?? null,
    });
    await this.logRepository.save(log);
  }

  async findByUsuario(actorId: string): Promise<LogAuditoria[]> {
    return this.logRepository.find({
      where: { actorId },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(): Promise<LogAuditoria[]> {
    return this.logRepository.find({ order: { createdAt: 'DESC' }, take: 200 });
  }
}
