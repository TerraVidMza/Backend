import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ANY_ROLE_KEY } from '../decorators/any-role.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RolNombre } from '../enums/rol.enum';

/**
 * Metadata simulada por clave, para no montar un módulo Nest completo.
 */
function buildGuard(metadata: Record<string, unknown>): RolesGuard {
  const reflector = {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

function buildContext(rol?: RolNombre): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => (rol ? { user: { rol } } : {}),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('deniega cuando el handler no declara ningún decorador (fail-closed)', () => {
    const guard = buildGuard({});
    expect(() =>
      guard.canActivate(buildContext(RolNombre.PROPIETARIO)),
    ).toThrow(ForbiddenException);
  });

  it('deniega al rol que no está en la lista de @Roles', () => {
    const guard = buildGuard({ [ROLES_KEY]: [RolNombre.PROPIETARIO] });
    expect(() => guard.canActivate(buildContext(RolNombre.AUDITOR))).toThrow(
      ForbiddenException,
    );
  });

  it('permite al rol incluido en @Roles', () => {
    const guard = buildGuard({ [ROLES_KEY]: [RolNombre.PROPIETARIO] });
    expect(guard.canActivate(buildContext(RolNombre.PROPIETARIO))).toBe(true);
  });

  it('permite cualquier rol cuando el handler declara @AnyRole', () => {
    const guard = buildGuard({ [ANY_ROLE_KEY]: true });
    expect(guard.canActivate(buildContext(RolNombre.CAPATAZ))).toBe(true);
  });

  it('no interfiere con las rutas @Public, que no tienen usuario', () => {
    const guard = buildGuard({ [IS_PUBLIC_KEY]: true });
    expect(guard.canActivate(buildContext())).toBe(true);
  });

  it('deniega si no hay usuario en el request aunque el handler declare roles', () => {
    const guard = buildGuard({ [ROLES_KEY]: [RolNombre.PROPIETARIO] });
    expect(() => guard.canActivate(buildContext())).toThrow(ForbiddenException);
  });
});
