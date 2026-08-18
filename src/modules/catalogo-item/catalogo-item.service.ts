import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogoItem, CatalogoTipo } from './entities/catalogo-item.entity';
import { Cuartel } from '../cuarteles/entities/cuartel.entity';
import { CreateCatalogoItemDto } from './dto/create-catalogo-item.dto';
import { UpdateCatalogoItemDto } from './dto/update-catalogo-item.dto';

@Injectable()
export class CatalogoItemService {
  constructor(
    @InjectRepository(CatalogoItem)
    private readonly catalogoRepository: Repository<CatalogoItem>,
    @InjectRepository(Cuartel)
    private readonly cuartelRepository: Repository<Cuartel>,
  ) {}

  findByTipo(tipo: CatalogoTipo, soloActivos = true): Promise<CatalogoItem[]> {
    return this.catalogoRepository.find({
      where: soloActivos ? { tipo, activo: true } : { tipo },
      order: { nombre: 'ASC' },
    });
  }

  async findById(id: string): Promise<CatalogoItem> {
    const item = await this.catalogoRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Valor de catálogo no encontrado');
    }
    return item;
  }

  async create(dto: CreateCatalogoItemDto): Promise<CatalogoItem> {
    const existente = await this.catalogoRepository.findOne({
      where: { tipo: dto.tipo, nombre: dto.nombre },
    });
    if (existente) {
      throw new BadRequestException(
        'Ya existe un valor con ese nombre en este catálogo',
      );
    }
    const item = this.catalogoRepository.create({ ...dto, activo: true });
    return this.catalogoRepository.save(item);
  }

  async update(id: string, dto: UpdateCatalogoItemDto): Promise<CatalogoItem> {
    const item = await this.findById(id);
    Object.assign(item, dto);
    return this.catalogoRepository.save(item);
  }

  async desactivar(id: string): Promise<CatalogoItem> {
    const item = await this.findById(id);
    item.activo = false;
    return this.catalogoRepository.save(item);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);

    const referenciasEnUso = await this.cuartelRepository.count({
      where: [{ variedadId: id }, { sistemaConduccionId: id }],
    });

    if (referenciasEnUso > 0) {
      throw new BadRequestException(
        `No es posible eliminar este valor porque está en uso en ${referenciasEnUso} registro(s) de cuarteles. Puedes desactivarlo para que no aparezca en nuevos formularios.`,
      );
    }

    await this.catalogoRepository.delete(id);
  }
}
