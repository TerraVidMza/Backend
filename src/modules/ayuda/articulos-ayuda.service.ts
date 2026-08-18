import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArticuloAyuda, ModuloAyuda, TipoArticulo } from './entities/articulo-ayuda.entity';
import { CreateArticuloDto } from './dto/create-articulo.dto';
import { UpdateArticuloDto } from './dto/update-articulo.dto';

@Injectable()
export class ArticulosAyudaService {
  constructor(
    @InjectRepository(ArticuloAyuda)
    private readonly articuloRepository: Repository<ArticuloAyuda>,
  ) {}

  findAll(tipo?: TipoArticulo, modulo?: ModuloAyuda): Promise<ArticuloAyuda[]> {
    return this.articuloRepository.find({
      where: {
        activo: true,
        ...(tipo ? { tipo } : {}),
        ...(modulo ? { modulo } : {}),
      },
      order: { modulo: 'ASC', orden: 'ASC' },
    });
  }

  async findById(id: string): Promise<ArticuloAyuda> {
    const articulo = await this.articuloRepository.findOne({ where: { id } });
    if (!articulo) {
      throw new NotFoundException('Artículo no encontrado');
    }
    return articulo;
  }

  create(dto: CreateArticuloDto): Promise<ArticuloAyuda> {
    const articulo = this.articuloRepository.create({ ...dto, activo: true });
    return this.articuloRepository.save(articulo);
  }

  async update(id: string, dto: UpdateArticuloDto): Promise<ArticuloAyuda> {
    const articulo = await this.findById(id);
    Object.assign(articulo, dto);
    return this.articuloRepository.save(articulo);
  }

  async desactivar(id: string): Promise<ArticuloAyuda> {
    const articulo = await this.findById(id);
    articulo.activo = false;
    return this.articuloRepository.save(articulo);
  }
}
