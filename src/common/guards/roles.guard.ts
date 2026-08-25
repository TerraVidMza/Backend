import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ANY_ROLE_KEY } from '../decorators/any-role.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RolNombre } from '../enums/rol.enum';
import type { AuthenticatedUser } from '../../modules/auth/strategies/jwt.strategy';

@Injectable()
export class RolesGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    // Las rutas públicas no pasan por autenticación, así que tampoco por RBAC.
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    if (this.reflector.getAllAndOverride<boolean>(ANY_ROLE_KEY, targets)) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<RolNombre[]>(
      ROLES_KEY,
      targets,
    );

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    // Fail-closed: un handler sin `@Roles(...)` ni `@AnyRole()` se deniega.
    // Antes se permitía, y por eso cualquier rol —incluido Auditor— llegaba a
    // endpoints sensibles como el margen bruto o el listado de roles.
    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException(
        'No tiene permisos para acceder a este recurso',
      );
    }

    if (!user || !requiredRoles.includes(user.rol)) {
      throw new ForbiddenException(
        'No tiene permisos para acceder a este recurso',
      );
    }

    return true;
  }
}
