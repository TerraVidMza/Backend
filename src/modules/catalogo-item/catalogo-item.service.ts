import {
  BadRequestException,
  ConflictException,
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

  findByTipo(
    tipo: CatalogoTipo,
    empresaId: string,
    soloActivos = true,
  ): Promise<CatalogoItem[]> {
    return this.catalogoRepository.find({
      where: soloActivos
        ? { tipo, empresaId, activo: true }
        : { tipo, empresaId },
      order: { nombre: 'ASC' },
    });
  }

  /** `empresaId` acota al tenant: cada empresa tiene su catálogo (D-h). */
  async findById(id: string, empresaId: string): Promise<CatalogoItem> {
    const item = await this.catalogoRepository.findOne({
      where: { id, empresaId },
    });
    if (!item) {
      throw new NotFoundException('Valor de catálogo no encontrado');
    }
    return item;
  }

  async create(
    dto: CreateCatalogoItemDto,
    empresaId: string,
  ): Promise<CatalogoItem> {
    await this.verificarNombreLibre(dto.tipo, dto.nombre, empresaId);
    const item = this.catalogoRepository.create({
      ...dto,
      empresaId,
      activo: true,
    });
    return this.catalogoRepository.save(item);
  }

  async update(
    id: string,
    dto: UpdateCatalogoItemDto,
    empresaId: string,
  ): Promise<CatalogoItem> {
    const item = await this.findById(id, empresaId);
    // El `update` no revalidaba la unicidad: se podía renombrar un valor al
    // nombre de otro del mismo catálogo (HU-34).
    if (dto.nombre && dto.nombre !== item.nombre) {
      await this.verificarNombreLibre(item.tipo, dto.nombre, empresaId);
    }
    Object.assign(item, dto);
    return this.catalogoRepository.save(item);
  }

  /** 409 y no 400: el nombre es válido, lo que falla es que ya está tomado. */
  private async verificarNombreLibre(
    tipo: CatalogoTipo,
    nombre: string,
    empresaId: string,
  ): Promise<void> {
    const existente = await this.catalogoRepository.exists({
      where: { tipo, nombre, empresaId, activo: true },
    });
    if (existente) {
      throw new ConflictException(
        'Ya existe un valor activo con ese nombre en este catálogo',
      );
    }
  }

  async desactivar(id: string, empresaId: string): Promise<CatalogoItem> {
    const item = await this.findById(id, empresaId);
    item.activo = false;
    return this.catalogoRepository.save(item);
  }

  async remove(id: string, empresaId: string): Promise<void> {
    await this.findById(id, empresaId);

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
