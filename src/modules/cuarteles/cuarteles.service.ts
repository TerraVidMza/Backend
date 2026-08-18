import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cuartel } from './entities/cuartel.entity';
import { CreateCuartelDto } from './dto/create-cuartel.dto';
import { UpdateCuartelDto } from './dto/update-cuartel.dto';

@Injectable()
export class CuartelesService {
  constructor(
    @InjectRepository(Cuartel)
    private readonly cuartelRepository: Repository<Cuartel>,
  ) {}

  findByFinca(fincaId: string): Promise<Cuartel[]> {
    return this.cuartelRepository.find({
      where: { fincaId, activo: true },
      relations: { variedad: true, sistemaConduccion: true },
      order: { nombre: 'ASC' },
    });
  }

  async findById(id: string): Promise<Cuartel> {
    const cuartel = await this.cuartelRepository.findOne({
      where: { id },
      relations: { finca: true, variedad: true, sistemaConduccion: true },
    });
    if (!cuartel) {
      throw new NotFoundException('Cuartel no encontrado');
    }
    return cuartel;
  }

  create(dto: CreateCuartelDto): Promise<Cuartel> {
    const cuartel = this.cuartelRepository.create({ ...dto, activo: true });
    return this.cuartelRepository.save(cuartel);
  }

  async update(id: string, dto: UpdateCuartelDto): Promise<Cuartel> {
    const cuartel = await this.findById(id);
    Object.assign(cuartel, dto);
    return this.cuartelRepository.save(cuartel);
  }

  async desactivar(id: string): Promise<Cuartel> {
    const cuartel = await this.findById(id);
    cuartel.activo = false;
    return this.cuartelRepository.save(cuartel);
  }
}
