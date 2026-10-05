import { SetMetadata } from '@nestjs/common';

export const ANY_ROLE_KEY = 'anyRole';

/** Valor de la metadata cuando el handler admite también al Administrador. */
export const CON_ADMINISTRADOR = 'conAdministrador';

/**
 * Marca un handler como accesible para cualquier usuario autenticado de una
 * empresa, sin importar su rol.
 *
 * `RolesGuard` deniega por defecto cuando un handler no declara `@Roles(...)`,
 * de modo que olvidarse el decorador falle cerrado. Este decorador es la forma
 * explícita de decir "acá el rol no importa" — usar solo cuando sea cierto
 * (perfil propio, notificaciones propias, catálogos de solo lectura).
 *
 * **No incluye al Administrador de plataforma** (D-025): sus datos de empresa
 * están vacíos y no tiene nada que hacer en el dashboard ni en los catálogos.
 * Los pocos handlers que sí usa (perfil, cambio de contraseña, logout) lo
 * piden con `{ incluyeAdministrador: true }`.
 */
export const AnyRole = (opciones: { incluyeAdministrador?: boolean } = {}) =>
  SetMetadata(
    ANY_ROLE_KEY,
    opciones.incluyeAdministrador ? CON_ADMINISTRADOR : true,
  );
