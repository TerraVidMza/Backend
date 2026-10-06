import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Empresa } from './entities/empresa.entity';
import { CrearEmpresaDto } from './dto/crear-empresa.dto';
import { ActualizarEmpresaDto } from './dto/actualizar-empresa.dto';
import { CatalogoItem } from '../catalogo-item/entities/catalogo-item.entity';
import { CATALOGOS_POR_DEFECTO } from '../catalogo-item/catalogos-por-defecto';
import { Rol } from '../roles/entities/rol.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { RolNombre } from '../../common/enums/rol.enum';

export interface EmpresaListada {
  id: string;
  nombre: string;
  cuit: string;
  activa: boolean;
  createdAt: Date;
  usuariosActivos: number;
}

@Injectable()
export class EmpresasService {
  private readonly logger = new Logger(EmpresasService.name);

  constructor(
    @InjectRepository(Empresa)
    private readonly empresaRepository: Repository<Empresa>,
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly usuariosService: UsuariosService,
  ) {}

  findAll(): Promise<Empresa[]> {
    return this.empresaRepository.find();
  }

  async findById(id: string): Promise<Empresa> {
    const empresa = await this.empresaRepository.findOne({ where: { id } });
    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }
    return empresa;
  }

  /** Empresas cliente con la cantidad de usuarios activos (D-025). */
  listar(): Promise<EmpresaListada[]> {
    return this.empresaRepository.query<EmpresaListada[]>(
      `SELECT e.id, e.nombre, e.cuit, e.activa, e.created_at AS "createdAt",
              COUNT(u.id) FILTER (WHERE u.activo)::int AS "usuariosActivos"
         FROM empresas e
         LEFT JOIN usuarios u ON u.empresa_id = e.id
        WHERE NOT e.es_plataforma
        GROUP BY e.id
        ORDER BY e.nombre`,
    );
  }

  /**
   * Alta de una empresa cliente con su primer Propietario (D-025).
   *
   * La empresa y sus catálogos por defecto se crean en una transacción. El
   * Propietario se crea después con el alta normal de usuarios, que genera
   * una contraseña temporal y le manda el correo de bienvenida: así el
   * Administrador nunca conoce la contraseña. Si ese paso falla, la empresa
   * se borra para no dejar una empresa sin nadie que pueda administrarla.
   */
  async crear(
    dto: CrearEmpresaDto,
    actorId: string,
  ): Promise<Empresa & { propietario: { id: string; email: string } }> {
    await this.verificarCuitLibre(dto.cuit);
    if (await this.usuariosService.findByEmail(dto.propietario.email)) {
      throw new ConflictException('Ya existe un usuario con ese email');
    }

    const empresa = await this.dataSource.transaction(async (manager) => {
      const nueva = await manager.save(
        manager.create(Empresa, {
          nombre: dto.nombre,
          cuit: dto.cuit,
          activa: true,
          esPlataforma: false,
          createdById: actorId,
        }),
      );
      await manager.save(
        CATALOGOS_POR_DEFECTO.map((item) =>
          manager.create(CatalogoItem, {
            ...item,
            empresaId: nueva.id,
            activo: true,
          }),
        ),
      );
      return nueva;
    });

    try {
      const rol = await this.rolRepository.findOneOrFail({
        where: { nombreRol: RolNombre.PROPIETARIO },
      });
      const propietario = await this.usuariosService.create(
        {
          nombre: dto.propietario.nombre,
          email: dto.propietario.email,
          rolId: rol.id,
        },
        empresa.id,
      );
      return {
        ...empresa,
        propietario: { id: propietario.id, email: propietario.email },
      };
    } catch (error) {
      this.logger.error(
        `Falló el alta del Propietario de ${empresa.nombre}; se revierte la empresa: ${(error as Error).message}`,
      );
      await this.dataSource.transaction(async (manager) => {
        await manager.delete(CatalogoItem, { empresaId: empresa.id });
        await manager.delete(Empresa, { id: empresa.id });
      });
      throw error;
    }
  }

  async actualizar(id: string, dto: ActualizarEmpresaDto): Promise<Empresa> {
    const empresa = await this.findCliente(id);
    if (dto.cuit && dto.cuit !== empresa.cuit) {
      await this.verificarCuitLibre(dto.cuit);
    }
    Object.assign(empresa, dto);
    return this.empresaRepository.save(empresa);
  }

  /**
   * Activa o desactiva una empresa. Desactivada, ninguno de sus usuarios
   * puede iniciar ni renovar sesión, y los access tokens vigentes dejan de
   * servir en la request siguiente (lo verifica la estrategia JWT).
   */
  async setActiva(id: string, activa: boolean): Promise<Empresa> {
    const empresa = await this.findCliente(id);
    empresa.activa = activa;
    return this.empresaRepository.save(empresa);
  }

  /** Solo empresas cliente: la de plataforma no se edita por la API. */
  private async findCliente(id: string): Promise<Empresa> {
    const empresa = await this.empresaRepository.findOne({
      where: { id, esPlataforma: false },
    });
    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }
    return empresa;
  }

  private async verificarCuitLibre(cuit: string): Promise<void> {
    if (await this.empresaRepository.exists({ where: { cuit } })) {
      throw new ConflictException('Ya existe una empresa con ese CUIT');
    }
  }
}
