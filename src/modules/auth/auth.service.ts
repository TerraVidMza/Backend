import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsuariosService } from '../usuarios/usuarios.service';
import {
  TOKEN_TTL_MINUTES,
  TokenRecuperacionService,
} from '../token-recuperacion/token-recuperacion.service';
import { LogAuditoriaService } from '../log-auditoria/log-auditoria.service';
import { LoginDto } from './dto/login.dto';
import { RolNombre } from '../../common/enums/rol.enum';
import { MailService } from '../../common/mail/mail.service';
import { TokenRevocadoService } from './token-revocado.service';

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

/** Cota superior para la purga cuando el token no trae `exp`. */
const VIGENCIA_MAXIMA_TOKEN_MS = 24 * 60 * 60 * 1000;

/**
 * Hash de una contraseña que no corresponde a ninguna cuenta. Se compara contra
 * él cuando el email no existe, para que el login tarde lo mismo exista o no la
 * cuenta y no se pueda enumerar usuarios midiendo el tiempo de respuesta.
 */
const HASH_DUMMY =
  '$2b$12$stKYE0dgRWfR.AsqRU73LOa9wn80sxrWVM8nVqe1J130OOoOWqxby';

function saltRounds(): number {
  return parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly tokenRecuperacionService: TokenRecuperacionService,
    private readonly logAuditoriaService: LogAuditoriaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly tokenRevocadoService: TokenRevocadoService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string) {
    const usuario = await this.usuariosService.findByEmail(dto.email);

    if (!usuario) {
      // Comparación contra un hash fijo para igualar el tiempo de respuesta
      // con el del caso "la cuenta existe pero la contraseña no coincide".
      await bcrypt.compare(dto.password, HASH_DUMMY);
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      throw new HttpException(
        `Cuenta bloqueada por demasiados intentos. Intente en ${BLOQUEO_MINUTOS} minutos`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
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
      await this.logAuditoriaService.registrar({
        actorId: usuario.id,
        accion: 'LOGIN_FALLIDO',
        entidad: 'usuarios',
        entidadId: usuario.id,
        ipAddress,
      });
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    // Se valida después de la contraseña: hacerlo antes le confirmaría a un
    // atacante sin credenciales que la cuenta existe.
    if (!usuario.activo) {
      throw new UnauthorizedException('Tu cuenta está desactivada');
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
      usuario.debeCambiarPassword,
    );
  }

  /**
   * Cierra la sesión **invalidando el token** (HU-02).
   *
   * Antes solo escribía la entrada de auditoría: el JWT seguía siendo válido
   * las 8 horas completas, así que "cerrar sesión" no protegía contra un token
   * ya robado ni contra una terminal compartida.
   */
  async logout(
    usuario: { id: string; jti: string; expiraEn: Date | null },
    ipAddress?: string,
  ): Promise<void> {
    if (usuario.jti) {
      // Sin `exp` se usa la vigencia configurada como cota: la fila se puede
      // purgar recién cuando el token no pueda seguir siendo aceptado.
      const expiraEn =
        usuario.expiraEn ?? new Date(Date.now() + VIGENCIA_MAXIMA_TOKEN_MS);
      await this.tokenRevocadoService.revocar(
        usuario.jti,
        usuario.id,
        expiraEn,
      );
    }

    await this.logAuditoriaService.registrar({
      actorId: usuario.id,
      accion: 'LOGOUT',
      entidad: 'usuarios',
      entidadId: usuario.id,
      ipAddress,
    });
  }

  /**
   * Genera el token de recuperación y **lo envía por correo** (HU-03).
   *
   * Antes solo lo generaba y lo devolvía: el token quedaba en la respuesta HTTP
   * —lo que anula el propósito de mandarlo al mail del titular— y el usuario
   * nunca recibía nada. Ahora se devuelve solo en desarrollo, para poder probar
   * el flujo sin SMTP.
   */
  async forgotPassword(email: string): Promise<string | null> {
    const usuario = await this.usuariosService.findByEmail(email);
    if (!usuario) {
      // No revelamos si el email existe o no.
      return null;
    }

    const token = await this.tokenRecuperacionService.generar(usuario.id);
    const enlace = `${process.env.APP_URL ?? 'http://localhost:5173'}/reset-password?token=${token}`;

    const enviado = await this.mailService.enviar(
      {
        para: usuario.email,
        asunto: '[TerraVid] Recuperación de contraseña',
        texto: [
          `Hola ${usuario.nombre},`,
          '',
          'Recibimos una solicitud para restablecer tu contraseña.',
          `Ingresá en el siguiente enlace: ${enlace}`,
          '',
          `El enlace vence en ${TOKEN_TTL_MINUTES} minutos y sirve una sola vez.`,
          'Si no pediste esto, podés ignorar este mensaje: tu contraseña no cambia.',
        ].join('\n'),
      },
      usuario.empresaId,
    );

    if (!enviado) {
      this.logger.warn(
        `No se pudo enviar el mail de recuperación a ${usuario.email}; el token quedó generado.`,
      );
    }

    return process.env.NODE_ENV === 'production' ? null : token;
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const usuarioId =
      await this.tokenRecuperacionService.validarYConsumir(token);
    if (!usuarioId) {
      throw new BadRequestException(
        'El enlace expiró o ya fue utilizado. Solicita uno nuevo.',
      );
    }
    const passwordHash = await bcrypt.hash(newPassword, saltRounds());
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
      throw new BadRequestException('La contraseña actual es incorrecta');
    }
    const passwordHash = await bcrypt.hash(newPassword, saltRounds());
    await this.usuariosService.setPasswordHash(usuarioId, passwordHash);
    await this.logAuditoriaService.registrar({
      actorId: usuarioId,
      accion: 'CAMBIO_PASSWORD',
      entidad: 'usuarios',
      entidadId: usuarioId,
    });
  }

  private buildTokenResponse(
    sub: string,
    email: string,
    rol: RolNombre,
    empresaId: string,
    debeCambiarPassword: boolean,
  ) {
    // `jti` identifica este token concreto para poder revocarlo (HU-02).
    const payload = { sub, email, rol, empresaId, jti: crypto.randomUUID() };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: sub, email, rol, empresaId, debeCambiarPassword },
    };
  }
}
