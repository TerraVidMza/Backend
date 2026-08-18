import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsuariosService } from '../usuarios/usuarios.service';
import { TokenRecuperacionService } from '../token-recuperacion/token-recuperacion.service';
import { LogAuditoriaService } from '../log-auditoria/log-auditoria.service';
import { LoginDto } from './dto/login.dto';
import { RolNombre } from '../../common/enums/rol.enum';

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly tokenRecuperacionService: TokenRecuperacionService,
    private readonly logAuditoriaService: LogAuditoriaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string) {
    const usuario = await this.usuariosService.findByEmail(dto.email);

    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      throw new ForbiddenException(
        `Usuario bloqueado temporalmente hasta ${usuario.bloqueadoHasta.toISOString()}`,
      );
    }

    if (!usuario.activo) {
      throw new ForbiddenException('Usuario inactivo');
    }

    const passwordValida = await bcrypt.compare(
      dto.password,
      usuario.passwordHash,
    );

    if (!passwordValida) {
      await this.usuariosService.registrarIntentoFallido(
        usuario,
        MAX_INTENTOS,
        BLOQUEO_MINUTOS,
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.usuariosService.registrarAccesoExitoso(usuario.id);
    await this.logAuditoriaService.registrar({
      actorId: usuario.id,
      accion: 'LOGIN',
      entidad: 'usuarios',
      entidadId: usuario.id,
      ipAddress,
    });

    return this.buildTokenResponse(
      usuario.id,
      usuario.email,
      usuario.rol.nombreRol as RolNombre,
      usuario.empresaId,
    );
  }

  async logout(usuarioId: string, ipAddress?: string): Promise<void> {
    await this.logAuditoriaService.registrar({
      actorId: usuarioId,
      accion: 'LOGOUT',
      entidad: 'usuarios',
      entidadId: usuarioId,
      ipAddress,
    });
  }

  async forgotPassword(email: string): Promise<string | null> {
    const usuario = await this.usuariosService.findByEmail(email);
    if (!usuario) {
      // No revelamos si el email existe o no.
      return null;
    }
    return this.tokenRecuperacionService.generar(usuario.id);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const usuarioId =
      await this.tokenRecuperacionService.validarYConsumir(token);
    if (!usuarioId) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    const passwordHash = await bcrypt.hash(
      newPassword,
      parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10', 10),
    );
    await this.usuariosService.setPasswordHash(usuarioId, passwordHash);
    await this.logAuditoriaService.registrar({
      actorId: usuarioId,
      accion: 'RESET_PASSWORD',
      entidad: 'usuarios',
      entidadId: usuarioId,
    });
  }

  async changePassword(
    usuarioId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const usuario = await this.usuariosService.findById(usuarioId);
    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    const passwordValida = await bcrypt.compare(
      currentPassword,
      usuario.passwordHash,
    );
    if (!passwordValida) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }
    const passwordHash = await bcrypt.hash(
      newPassword,
      parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10', 10),
    );
    await this.usuariosService.setPasswordHash(usuarioId, passwordHash);
  }

  private buildTokenResponse(
    sub: string,
    email: string,
    rol: RolNombre,
    empresaId: string,
  ) {
    const payload = { sub, email, rol, empresaId };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: sub, email, rol, empresaId },
    };
  }
}
