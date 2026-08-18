import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Finca } from './entities/finca.entity';
import { CreateFincaDto } from './dto/create-finca.dto';
import { UpdateFincaDto } from './dto/update-finca.dto';

@Injectable()
export class FincasService {
  constructor(
    @InjectRepository(Finca)
    private readonly fincaRepository: Repository<Finca>,
  ) {}

  findAll(empresaId: string, search?: string): Promise<Finca[]> {
    return this.fincaRepository.find({
      where: {
        empresaId,
        activa: true,
        ...(search ? { nombre: ILike(`%${search}%`) } : {}),
      },
      order: { nombre: 'ASC' },
    });
  }

  async findById(id: string): Promise<Finca> {
    const finca = await this.fincaRepository.findOne({ where: { id } });
    if (!finca) {
      throw new NotFoundException('Finca no encontrada');
    }
    return finca;
  }

  create(dto: CreateFincaDto, createdById: string): Promise<Finca> {
    const finca = this.fincaRepository.create({
      ...dto,
      createdById,
      activa: true,
    });
    return this.fincaRepository.save(finca);
  }

  async update(id: string, dto: UpdateFincaDto): Promise<Finca> {
    const finca = await this.findById(id);
    Object.assign(finca, dto);
    return this.fincaRepository.save(finca);
  }

  async desactivar(id: string): Promise<Finca> {
    const finca = await this.findById(id);
    finca.activa = false;
    return this.fincaRepository.save(finca);
  }
}
