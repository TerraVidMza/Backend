import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsuariosService } from '../../usuarios/usuarios.service';
import { RolNombre } from '../../../common/enums/rol.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  rol: RolNombre;
  empresaId: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  rol: RolNombre;
  empresaId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usuariosService: UsuariosService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') as string,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const usuario = await this.usuariosService.findById(payload.sub);
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario inactivo o inexistente');
    }
    return {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol.nombreRol as RolNombre,
      empresaId: usuario.empresaId,
    };
  }
}
