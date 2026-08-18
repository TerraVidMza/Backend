import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Configuracion } from './entities/configuracion.entity';
import { SetConfiguracionDto } from './dto/set-configuracion.dto';

@Injectable()
export class ConfiguracionService {
  constructor(
    @InjectRepository(Configuracion)
    private readonly configuracionRepository: Repository<Configuracion>,
  ) {}

  findAll(): Promise<Configuracion[]> {
    return this.configuracionRepository.find({ order: { clave: 'ASC' } });
  }

  async findByClave(clave: string): Promise<Configuracion | null> {
    return this.configuracionRepository.findOne({ where: { clave } });
  }

  async set(dto: SetConfiguracionDto, updatedById: string): Promise<Configuracion> {
    let config = await this.findByClave(dto.clave);
    if (!config) {
      config = this.configuracionRepository.create({ clave: dto.clave });
    }
    config.valor = dto.valor;
    config.updatedById = updatedById;
    return this.configuracionRepository.save(config);
  }
}
