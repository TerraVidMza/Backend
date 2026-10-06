export enum RolNombre {
  PROPIETARIO = 'Propietario',
  CAPATAZ = 'Capataz',
  AGRONOMO = 'Agronomo',
  AUDITOR = 'Auditor',
  /**
   * Administrador de la plataforma (D-025): da de alta empresas y su primer
   * Propietario. No pertenece a ninguna empresa cliente y no ve sus datos.
   */
  ADMINISTRADOR = 'Administrador',
}

/**
 * Los roles **dentro de una empresa**: los que un Propietario puede asignar y
 * los que cubre `@AnyRole()`. El Administrador de plataforma queda afuera.
 */
export const ROLES_DE_EMPRESA = [
  RolNombre.PROPIETARIO,
  RolNombre.AGRONOMO,
  RolNombre.CAPATAZ,
  RolNombre.AUDITOR,
] as const;
