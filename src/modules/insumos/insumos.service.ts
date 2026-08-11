import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Insumo } from './entities/insumo.entity';
import { CostoInsumo } from './entities/costo-insumo.entity';
import { CreateInsumoDto } from './dto/create-insumo.dto';
import { UpdateInsumoDto } from './dto/update-insumo.dto';
import { SetCostoInsumoDto } from './dto/set-costo-insumo.dto';

@Injectable()
export class InsumosService {
  constructor(
    @InjectRepository(Insumo)
    private readonly insumoRepository: Repository<Insumo>,
    @InjectRepository(CostoInsumo)
    private readonly costoInsumoRepository: Repository<CostoInsumo>,
  ) {}

  findAll(soloActivos = true): Promise<Insumo[]> {
    return this.insumoRepository.find({
      where: soloActivos ? { activo: true } : {},
      order: { nombre: 'ASC' },
    });
  }

  async findById(id: string): Promise<Insumo> {
    const insumo = await this.insumoRepository.findOne({ where: { id } });
    if (!insumo) {
      throw new NotFoundException('Insumo no encontrado');
    }
    return insumo;
  }

  async create(dto: CreateInsumoDto, createdById: string): Promise<Insumo> {
    const insumo = this.insumoRepository.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      unidadMedida: dto.unidadMedida,
      activo: true,
    });
    const guardado = await this.insumoRepository.save(insumo);

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

  async update(id: string, dto: UpdateInsumoDto): Promise<Insumo> {
    const insumo = await this.findById(id);
    Object.assign(insumo, dto);
    return this.insumoRepository.save(insumo);
  }

  async desactivar(id: string): Promise<Insumo> {
    const insumo = await this.findById(id);
    insumo.activo = false;
    return this.insumoRepository.save(insumo);
  }

  async setCosto(
    insumoId: string,
    dto: SetCostoInsumoDto,
    createdById: string,
  ): Promise<CostoInsumo> {
    await this.findById(insumoId);
    const costo = this.costoInsumoRepository.create({
      insumoId,
      costoUnitario: dto.costoUnitario,
      validFrom: dto.validFrom,
      createdById,
    });
    return this.costoInsumoRepository.save(costo);
  }

  async getCostoVigente(
    insumoId: string,
    fecha: Date = new Date(),
  ): Promise<CostoInsumo | null> {
    return this.costoInsumoRepository.findOne({
      where: {
        insumoId,
        validFrom: LessThanOrEqual(fecha.toISOString().slice(0, 10)),
      },
      order: { validFrom: 'DESC' },
    });
  }

  async getHistorialCostos(insumoId: string): Promise<CostoInsumo[]> {
    return this.costoInsumoRepository.find({
      where: { insumoId },
      order: { validFrom: 'DESC' },
    });
  }
}
