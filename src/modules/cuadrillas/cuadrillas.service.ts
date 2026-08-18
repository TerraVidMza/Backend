import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Cuadrilla } from './entities/cuadrilla.entity';
import { TarifaCuadrilla } from './entities/tarifa-cuadrilla.entity';
import { CreateCuadrillaDto } from './dto/create-cuadrilla.dto';
import { UpdateCuadrillaDto } from './dto/update-cuadrilla.dto';
import { SetTarifaDto } from './dto/set-tarifa.dto';

@Injectable()
export class CuadrillasService {
  constructor(
    @InjectRepository(Cuadrilla)
    private readonly cuadrillaRepository: Repository<Cuadrilla>,
    @InjectRepository(TarifaCuadrilla)
    private readonly tarifaRepository: Repository<TarifaCuadrilla>,
  ) {}

  findByFinca(fincaId: string): Promise<Cuadrilla[]> {
    return this.cuadrillaRepository.find({ where: { fincaId, activa: true }, order: { nombre: 'ASC' } });
  }

  async findById(id: string): Promise<Cuadrilla> {
    const cuadrilla = await this.cuadrillaRepository.findOne({ where: { id } });
    if (!cuadrilla) {
      throw new NotFoundException('Cuadrilla no encontrada');
    }
    return cuadrilla;
  }

  async create(dto: CreateCuadrillaDto, createdById: string): Promise<Cuadrilla> {
    const cuadrilla = this.cuadrillaRepository.create({
      fincaId: dto.fincaId,
      nombre: dto.nombre,
      cantidadIntegrantes: dto.cantidadIntegrantes,
      activa: true,
    });
    const guardada = await this.cuadrillaRepository.save(cuadrilla);

    await this.setTarifa(
      guardada.id,
      { tarifaPorKg: dto.tarifaPorKgInicial, validFrom: new Date().toISOString().slice(0, 10) },
      createdById,
    );

    return guardada;
  }

  async update(id: string, dto: UpdateCuadrillaDto): Promise<Cuadrilla> {
    const cuadrilla = await this.findById(id);
    Object.assign(cuadrilla, dto);
    return this.cuadrillaRepository.save(cuadrilla);
  }

  async desactivar(id: string): Promise<Cuadrilla> {
    const cuadrilla = await this.findById(id);
    cuadrilla.activa = false;
    return this.cuadrillaRepository.save(cuadrilla);
  }

  async setTarifa(cuadrillaId: string, dto: SetTarifaDto, createdById: string): Promise<TarifaCuadrilla> {
    await this.findById(cuadrillaId);
    const tarifa = this.tarifaRepository.create({
      cuadrillaId,
      tarifaPorKg: dto.tarifaPorKg,
      validFrom: dto.validFrom,
      createdById,
    });
    return this.tarifaRepository.save(tarifa);
  }

  async getTarifaVigente(cuadrillaId: string, fecha: Date = new Date()): Promise<TarifaCuadrilla | null> {
    return this.tarifaRepository.findOne({
      where: { cuadrillaId, validFrom: LessThanOrEqual(fecha.toISOString().slice(0, 10)) },
      order: { validFrom: 'DESC' },
    });
  }

  async getHistorialTarifas(cuadrillaId: string): Promise<TarifaCuadrilla[]> {
    return this.tarifaRepository.find({ where: { cuadrillaId }, order: { validFrom: 'DESC' } });
  }
}
