import { SetMetadata } from '@nestjs/common';

export const ANY_ROLE_KEY = 'anyRole';

/**
 * Marca un handler como accesible para cualquier usuario autenticado,
 * sin importar su rol.
 *
 * `RolesGuard` deniega por defecto cuando un handler no declara `@Roles(...)`,
 * de modo que olvidarse el decorador falle cerrado. Este decorador es la forma
 * explícita de decir "acá el rol no importa" — usar solo cuando sea cierto
 * (perfil propio, notificaciones propias, catálogos de solo lectura).
 */
export const AnyRole = () => SetMetadata(ANY_ROLE_KEY, true);
