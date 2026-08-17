import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from './entities/usuario.entity';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { RolNombre } from '../../common/enums/rol.enum';

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10', 10);

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  async findAll(empresaId: string): Promise<Usuario[]> {
    return this.usuarioRepository.find({
      where: { empresaId },
      relations: { rol: true },
    });
  }

  async findById(id: string): Promise<Usuario | null> {
    return this.usuarioRepository.findOne({
      where: { id },
      relations: { rol: true, empresa: true },
    });
  }

  async findByEmail(email: string): Promise<Usuario | null> {
    return this.usuarioRepository.findOne({
      where: { email },
      relations: { rol: true, empresa: true },
    });
  }

  async create(dto: CreateUsuarioDto): Promise<Usuario> {
    const existente = await this.findByEmail(dto.email);
    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese email');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const usuario = this.usuarioRepository.create({
      nombre: dto.nombre,
      email: dto.email,
      passwordHash,
      empresaId: dto.empresaId,
      rolId: dto.rolId,
      activo: dto.activo ?? true,
    });

    return this.usuarioRepository.save(usuario);
  }

  async update(id: string, dto: UpdateUsuarioDto): Promise<Usuario> {
    const usuario = await this.findById(id);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }
    Object.assign(usuario, dto);
    return this.usuarioRepository.save(usuario);
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.usuarioRepository.update(id, { passwordHash });
  }

  async registrarAccesoExitoso(id: string): Promise<void> {
    await this.usuarioRepository.update(id, {
      ultimoAcceso: new Date(),
      intentosFallidos: 0,
      bloqueadoHasta: null,
    });
  }

  async registrarIntentoFallido(
    usuario: Usuario,
    maxIntentos = 5,
    bloqueoMinutos = 15,
  ): Promise<void> {
    const intentos = usuario.intentosFallidos + 1;
    const bloqueadoHasta =
      intentos >= maxIntentos
        ? new Date(Date.now() + bloqueoMinutos * 60_000)
        : null;
    await this.usuarioRepository.update(usuario.id, {
      intentosFallidos: intentos,
      bloqueadoHasta,
    });
  }

  async findByRolesInEmpresa(empresaId: string, roles: RolNombre[]): Promise<Usuario[]> {
    return this.usuarioRepository.find({
      where: { empresaId, activo: true, rol: { nombreRol: In(roles) } },
      relations: { rol: true },
    });
  }

  async deactivate(id: string): Promise<void> {
    const usuario = await this.findById(id);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }
    await this.usuarioRepository.update(id, { activo: false });
  }
}
