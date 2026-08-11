import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rol } from './entities/rol.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
  ) {}

  findAll(): Promise<Rol[]> {
    return this.rolRepository.find();
  }

  findByNombre(nombreRol: string): Promise<Rol | null> {
    return this.rolRepository.findOne({ where: { nombreRol } });
  }
}
