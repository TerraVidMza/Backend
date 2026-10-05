import { RolNombre } from '../enums/rol.enum';

const { PROPIETARIO, AGRONOMO, CAPATAZ, AUDITOR } = RolNombre;
const TODOS = [PROPIETARIO, AGRONOMO, CAPATAZ, AUDITOR] as const;

/**
 * Qué puede hacer cada rol, expresado como capacidades (D-024).
 *
 * Es la **única** tabla de permisos del sistema: viaja al cliente en el login,
 * en la renovación de sesión y en `GET /usuarios/me`, y la Web y la app móvil
 * deciden con ella qué mostrar. Antes la Web tenía su propia copia y ya se
 * había desfasado (decía que el Auditor no veía fincas cuando D-021 se lo
 * habilitó).
 *
 * La autoridad sigue siendo el `RolesGuard` con los `@Roles` de cada handler.
 * `permisos.spec.ts` verifica que cada permiso coincida exactamente con los
 * roles de los handlers que cubre: si alguien cambia un `@Roles` sin tocar
 * esta tabla (o al revés), el test falla.
 */
export const PERMISOS = {
  /** `DashboardController` — el contenido varía por rol (HU-32). */
  dashboard: TODOS,
  /** `UsuariosController.findMe/updateMe` (HU-04). */
  perfil: TODOS,
  /** `NotificacionesController` — cada uno ve las suyas (HU-35). */
  notificaciones: TODOS,
  /** `CatalogoItemController.findByTipo`. */
  catalogos: TODOS,
  /** `CampaniasController` lectura (HU-31). */
  campanias: TODOS,
  /** `AyudaController.findArticulos` / `crearTicket` (HU-36). */
  ayuda: TODOS,

  /** Lectura de fincas y cuarteles; incluye al Auditor (D-021). */
  fincas: [PROPIETARIO, AGRONOMO, CAPATAZ, AUDITOR],
  fincasEscritura: [PROPIETARIO],
  cuartelesEscritura: [PROPIETARIO, AGRONOMO],
  cuartelesBaja: [PROPIETARIO],

  usuarios: [PROPIETARIO],
  roles: [PROPIETARIO],
  logAuditoria: [PROPIETARIO, AUDITOR],
  catalogosEscritura: [PROPIETARIO],
  configuracion: [PROPIETARIO],
  campaniasEscritura: [PROPIETARIO],
  ayudaAdministracion: [PROPIETARIO],

  /** Costeo, margen y costos de insumos y tipos de labor (dato económico). */
  operaciones: [PROPIETARIO, AGRONOMO],
  /** Baja de insumos y tipos de labor. */
  operacionesBaja: [PROPIETARIO],
  /** Lectura de insumos y tipos de labor: los usa el formulario de campo. */
  operacionesLectura: [PROPIETARIO, AGRONOMO, CAPATAZ],
  /** Historial de labores por cuartel; incluye al Auditor (HU-17). */
  historialLabores: [PROPIETARIO, AGRONOMO, CAPATAZ, AUDITOR],
  /** Registrar labores en campo, una o en lote (HU-12, HU-14). */
  laboresRegistro: [PROPIETARIO, AGRONOMO, CAPATAZ],

  telemetria: [PROPIETARIO, AGRONOMO],

  /** Remitos y pesajes, lectura; generar el borrador del remito. */
  vendimia: [PROPIETARIO, AGRONOMO, CAPATAZ],
  /** Registrar pesajes en campo, uno o en lote (HU-24). */
  pesajesRegistro: [PROPIETARIO, AGRONOMO, CAPATAZ],
  /** Aprobar, rechazar y liquidar remitos: dato económico. */
  vendimiaAprobacion: [PROPIETARIO, AGRONOMO],
  /** Ver y dar de alta cuadrillas: el Capataz da de alta (HU-23). */
  cuadrillas: [PROPIETARIO, AGRONOMO, CAPATAZ],
  cuadrillasEdicion: [PROPIETARIO, AGRONOMO],
  /** La tarifa a destajo la fija solo el Propietario (HU-23). */
  cuadrillasTarifas: [PROPIETARIO],

  inteligencia: [PROPIETARIO, AGRONOMO],

  /**
   * Usar la app móvil de campo. No cubre un endpoint: es la unión de lo que
   * la app permite hacer (registrar labores o pesajes). El login con
   * `cliente: 'movil'` lo exige.
   */
  appMovil: [PROPIETARIO, AGRONOMO, CAPATAZ],
} as const satisfies Record<string, readonly RolNombre[]>;

export type Permiso = keyof typeof PERMISOS;

export function permisosDe(rol: RolNombre): Permiso[] {
  return (Object.keys(PERMISOS) as Permiso[]).filter((p) =>
    (PERMISOS[p] as readonly RolNombre[]).includes(rol),
  );
}

export function tienePermiso(rol: RolNombre, permiso: Permiso): boolean {
  return (PERMISOS[permiso] as readonly RolNombre[]).includes(rol);
}
