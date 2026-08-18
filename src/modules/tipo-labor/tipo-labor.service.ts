import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { TipoLabor } from './entities/tipo-labor.entity';
import { CostoLabor } from './entities/costo-labor.entity';
import { CreateTipoLaborDto } from './dto/create-tipo-labor.dto';
import { UpdateTipoLaborDto } from './dto/update-tipo-labor.dto';
import { SetCostoLaborDto } from './dto/set-costo-labor.dto';

@Injectable()
export class TipoLaborService {
  constructor(
    @InjectRepository(TipoLabor)
    private readonly tipoLaborRepository: Repository<TipoLabor>,
    @InjectRepository(CostoLabor)
    private readonly costoLaborRepository: Repository<CostoLabor>,
  ) {}

  findAll(soloActivos = true): Promise<TipoLabor[]> {
    return this.tipoLaborRepository.find({
      where: soloActivos ? { activo: true } : {},
      order: { nombre: 'ASC' },
    });
  }

  async findById(id: string): Promise<TipoLabor> {
    const tipoLabor = await this.tipoLaborRepository.findOne({ where: { id } });
    if (!tipoLabor) {
      throw new NotFoundException('Tipo de labor no encontrado');
    }
    return tipoLabor;
  }

  async create(
    dto: CreateTipoLaborDto,
    createdById: string,
  ): Promise<TipoLabor> {
    const tipoLabor = this.tipoLaborRepository.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      unidadMedida: dto.unidadMedida,
      activo: true,
    });
    const guardado = await this.tipoLaborRepository.save(tipoLabor);

    await this.setCosto(
      guardado.id,
      {
        costoUnitario: dto.costoUnitarioInicial,
        validFrom: new Date().toISOString().slice(0, 10),
      },
      createdById,
    );

    return guardado;
  }

  async update(id: string, dto: UpdateTipoLaborDto): Promise<TipoLabor> {
    const tipoLabor = await this.findById(id);
    Object.assign(tipoLabor, dto);
    return this.tipoLaborRepository.save(tipoLabor);
  }

  async desactivar(id: string): Promise<TipoLabor> {
    const tipoLabor = await this.findById(id);
    tipoLabor.activo = false;
    return this.tipoLaborRepository.save(tipoLabor);
  }

  async setCosto(
    tipoLaborId: string,
    dto: SetCostoLaborDto,
    createdById: string,
  ): Promise<CostoLabor> {
    await this.findById(tipoLaborId);
    const costo = this.costoLaborRepository.create({
      tipoLaborId,
      costoUnitario: dto.costoUnitario,
      validFrom: dto.validFrom,
      createdById,
    });
    return this.costoLaborRepository.save(costo);
  }

  async getCostoVigente(
    tipoLaborId: string,
    fecha: Date = new Date(),
  ): Promise<CostoLabor | null> {
    return this.costoLaborRepository.findOne({
      where: {
        tipoLaborId,
        validFrom: LessThanOrEqual(fecha.toISOString().slice(0, 10)),
      },
      order: { validFrom: 'DESC' },
    });
  }

  async getHistorialCostos(tipoLaborId: string): Promise<CostoLabor[]> {
    return this.costoLaborRepository.find({
      where: { tipoLaborId },
      order: { validFrom: 'DESC' },
    });
  }
}
