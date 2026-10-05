import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsuariosService } from '../../usuarios/usuarios.service';
import { TokenRevocadoService } from '../token-revocado.service';
import { RolNombre } from '../../../common/enums/rol.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  rol: RolNombre;
  empresaId: string;
  /** Identificador del token: lo que se revoca al cerrar sesión (HU-02). */
  jti: string;
  /** Familia de refresh tokens de la sesión (D-023). Ausente en tokens viejos. */
  fam?: string;
  /** Vencimiento en segundos Unix, puesto por `jsonwebtoken`. */
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  rol: RolNombre;
  empresaId: string;
  /** Necesarios para revocar este token exacto en el logout. */
  jti: string;
  expiraEn: Date | null;
  /** Sesión (familia de refresh tokens) a la que pertenece el token (D-023). */
  familiaId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usuariosService: UsuariosService,
    private readonly tokenRevocadoService: TokenRevocadoService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') as string,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Primero la revocación: es una consulta por índice único y evita cargar el
    // usuario para un token del que ya sabemos que no sirve.
    if (
      payload.jti &&
      (await this.tokenRevocadoService.estaRevocado(payload.jti))
    ) {
      throw new UnauthorizedException('La sesión fue cerrada');
    }

    const usuario = await this.usuariosService.findById(payload.sub);
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario inactivo o inexistente');
    }

    return {
      id: usuario.id,
      email: usuario.email,
      // El rol sale de la base, no del payload: un cambio de rol aplica en la
      // request siguiente en vez de esperar a que venza el token (D-006).
      rol: usuario.rol.nombreRol as RolNombre,
      empresaId: usuario.empresaId,
      jti: payload.jti,
      expiraEn: payload.exp ? new Date(payload.exp * 1000) : null,
      familiaId: payload.fam ?? null,
    };
  }
}
