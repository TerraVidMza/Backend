import {
  BadRequestException,
  ForbiddenException,
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
import { RefreshTokenService } from './refresh-token.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { permisosDe, tienePermiso } from '../../common/permisos/permisos';

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

/** Cota superior para la purga cuando el token no trae `exp`. */
const VIGENCIA_MAXIMA_TOKEN_MS = 24 * 60 * 60 * 1000;

function saltRounds(): number {
  return parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10);
}

/**
 * Hash de una contraseña que no corresponde a ninguna cuenta. Se compara contra
 * él cuando el email no existe, para que el login tarde lo mismo exista o no la
 * cuenta y no se pueda enumerar usuarios midiendo el tiempo de respuesta.
 *
 * Se genera al arrancar con una clave aleatoria en vez de vivir en el código:
 * un hash bcrypt versionado es un secreto más para el analizador (SonarCloud lo
 * marcaba BLOCKER, D-035), y así su costo es siempre el de `BCRYPT_SALT_ROUNDS`.
 * Con un costo fijo de 12 y la variable en otro valor, la diferencia de tiempo
 * volvía a delatar si la cuenta existía.
 */
const HASH_DUMMY = bcrypt.hashSync(
  crypto.randomBytes(32).toString('hex'),
  saltRounds(),
);

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
    private readonly refreshTokenService: RefreshTokenService,
    private readonly configuracionService: ConfiguracionService,
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
    if (usuario.empresa && !usuario.empresa.activa) {
      throw new UnauthorizedException('Tu empresa está desactivada');
    }

    // La app de campo solo la usa quien puede registrar labores o pesajes
    // (D-024). Se valida después de la contraseña, como la cuenta desactivada,
    // para no revelar nada a quien no tiene credenciales.
    if (
      dto.cliente === 'movil' &&
      !tienePermiso(usuario.rol.nombreRol as RolNombre, 'appMovil')
    ) {
      throw new ForbiddenException(
        'Tu rol no tiene acceso a la app móvil. Ingresá desde la versión web.',
      );
    }

    await this.usuariosService.registrarAccesoExitoso(usuario.id);
    await this.logAuditoriaService.registrar({
      actorId: usuario.id,
      accion: 'LOGIN',
      entidad: 'usuarios',
      entidadId: usuario.id,
      ipAddress,
    });

    const { sesion } = await this.emitirSesion(
      usuario.id,
      usuario.email,
      usuario.rol.nombreRol as RolNombre,
      usuario.empresaId,
      usuario.debeCambiarPassword,
    );
    return sesion;
  }

  /**
   * Renueva la sesión con un refresh token (D-023).
   *
   * El token presentado se consume y se entrega uno nuevo de la misma familia
   * junto con un access token nuevo. El rol y el estado del usuario se leen de
   * la base, igual que en cada request: un usuario desactivado no renueva.
   */
  async refresh(refreshToken: string, ipAddress?: string) {
    const consumido = await this.refreshTokenService.consumir(refreshToken);

    const usuario = await this.usuariosService.findById(consumido.usuarioId);
    if (!usuario || !usuario.activo || usuario.empresa?.activa === false) {
      await this.refreshTokenService.revocarFamilia(consumido.familiaId);
      throw new UnauthorizedException('Usuario inactivo o inexistente');
    }

    const { sesion, refreshTokenId } = await this.emitirSesion(
      usuario.id,
      usuario.email,
      usuario.rol.nombreRol as RolNombre,
      usuario.empresaId,
      usuario.debeCambiarPassword,
      consumido.familiaId,
    );
    await this.refreshTokenService.marcarReemplazo(
      consumido.id,
      refreshTokenId,
    );

    await this.logAuditoriaService.registrar({
      actorId: usuario.id,
      accion: 'RENOVAR_SESION',
      entidad: 'usuarios',
      entidadId: usuario.id,
      ipAddress,
    });

    return sesion;
  }

  /**
   * Cierra la sesión **invalidando el token** (HU-02).
   *
   * Antes solo escribía la entrada de auditoría: el JWT seguía siendo válido
   * las 8 horas completas, así que "cerrar sesión" no protegía contra un token
   * ya robado ni contra una terminal compartida.
   */
  async logout(
    usuario: {
      id: string;
      jti: string;
      expiraEn: Date | null;
      familiaId?: string | null;
    },
    ipAddress?: string,
  ): Promise<void> {
    // La sesión completa: sin esto el refresh token seguiría renovando
    // access tokens después de "cerrar sesión" (D-023).
    if (usuario.familiaId) {
      await this.refreshTokenService.revocarFamilia(usuario.familiaId);
    }

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
    // Quien restablece la contraseña puede estar recuperando una cuenta
    // comprometida: se cierran todas las sesiones abiertas.
    await this.refreshTokenService.revocarDeUsuario(usuarioId);
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
    familiaIdActual?: string | null,
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
    // Las otras sesiones se cierran; la de quien la cambió sigue (D-023).
    await this.refreshTokenService.revocarDeUsuario(
      usuarioId,
      familiaIdActual ?? undefined,
    );
    await this.logAuditoriaService.registrar({
      actorId: usuarioId,
      accion: 'CAMBIO_PASSWORD',
      entidad: 'usuarios',
      entidadId: usuarioId,
    });
  }

  /**
   * Emite el par access + refresh con las duraciones de la empresa (D-023).
   * Sin `familiaId` abre una sesión nueva; con él, la continúa.
   */
  private async emitirSesion(
    sub: string,
    email: string,
    rol: RolNombre,
    empresaId: string,
    debeCambiarPassword: boolean,
    familiaId?: string,
  ) {
    const duraciones =
      await this.configuracionService.getDuracionesSesion(empresaId);
    const refresh = await this.refreshTokenService.emitir(
      sub,
      duraciones.refreshDias,
      familiaId,
    );

    // `jti` identifica este token concreto para poder revocarlo (HU-02) y
    // `fam` la sesión, para que el logout corte también el refresh token.
    const payload = {
      sub,
      email,
      rol,
      empresaId,
      jti: crypto.randomUUID(),
      fam: refresh.familiaId,
    };
    const expiresIn = duraciones.accessMinutos * 60;

    return {
      sesion: {
        accessToken: this.jwtService.sign(payload, { expiresIn }),
        /** Segundos de vida del access token: el cliente renueva antes de que venza. */
        expiresIn,
        refreshToken: refresh.token,
        refreshExpiresAt: refresh.expiraEn.toISOString(),
        user: {
          id: sub,
          email,
          rol,
          empresaId,
          debeCambiarPassword,
          // Lo que el usuario puede hacer, para que la Web y la app decidan qué
          // mostrar sin una tabla propia (D-024).
          permisos: permisosDe(rol),
        },
      },
      /** Para enlazar la rotación; no viaja al cliente. */
      refreshTokenId: refresh.id,
    };
  }
}
