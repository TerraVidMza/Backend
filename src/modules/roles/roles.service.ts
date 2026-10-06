import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Rol } from './entities/rol.entity';
import { ROLES_DE_EMPRESA } from '../../common/enums/rol.enum';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
  ) {}

  /**
   * Roles que un Propietario puede asignar: los de empresa. El Administrador de
   * plataforma no se ofrece (D-025).
   */
  findAll(): Promise<Rol[]> {
    return this.rolRepository.find({
      where: { nombreRol: In([...ROLES_DE_EMPRESA]) },
    });
  }

  findByNombre(nombreRol: string): Promise<Rol | null> {
    return this.rolRepository.findOne({ where: { nombreRol } });
  }
}
