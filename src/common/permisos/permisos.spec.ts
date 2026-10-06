import { Reflector } from '@nestjs/core';
import { RolNombre, ROLES_DE_EMPRESA } from '../enums/rol.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import {
  ANY_ROLE_KEY,
  CON_ADMINISTRADOR,
} from '../decorators/any-role.decorator';
import { PERMISOS, permisosDe, tienePermiso, type Permiso } from './permisos';

import { AlertasIotController } from '../../modules/alertas-iot/alertas-iot.controller';
import { AyudaController } from '../../modules/ayuda/ayuda.controller';
import { CampaniasController } from '../../modules/campanias/campanias.controller';
import { CatalogoItemController } from '../../modules/catalogo-item/catalogo-item.controller';
import { ConfiguracionController } from '../../modules/configuracion/configuracion.controller';
import { CuadrillasController } from '../../modules/cuadrillas/cuadrillas.controller';
import { CuartelesController } from '../../modules/cuarteles/cuarteles.controller';
import { DashboardController } from '../../modules/dashboard/dashboard.controller';
import { EmpresasController } from '../../modules/empresas/empresas.controller';
import { MetasCosechaController } from '../../modules/metas-cosecha/metas-cosecha.controller';
import { FincasController } from '../../modules/fincas/fincas.controller';
import { InsumosController } from '../../modules/insumos/insumos.controller';
import { InteligenciaAgronomicaController } from '../../modules/inteligencia-agronomica/inteligencia-agronomica.controller';
import { LecturasIotController } from '../../modules/lecturas-iot/lecturas-iot.controller';
import { LogAuditoriaController } from '../../modules/log-auditoria/log-auditoria.controller';
import { NotificacionesController } from '../../modules/notificaciones/notificaciones.controller';
import { PesajeVendimiaController } from '../../modules/pesaje-vendimia/pesaje-vendimia.controller';
import { RegistroLaborController } from '../../modules/registro-labor/registro-labor.controller';
import { RemitosController } from '../../modules/remitos/remitos.controller';
import { RolesController } from '../../modules/roles/roles.controller';
import { SensoresController } from '../../modules/sensores/sensores.controller';
import { TipoLaborController } from '../../modules/tipo-labor/tipo-labor.controller';
import { UmbralSensorController } from '../../modules/umbral-sensor/umbral-sensor.controller';
import { UsuariosController } from '../../modules/usuarios/usuarios.controller';

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type Handler = [Function, string];

const TODOS = ROLES_DE_EMPRESA;

/**
 * Qué handlers cubre cada permiso (D-024). Un permiso sin handlers propios
 * (`appMovil`) se verifica aparte.
 */
const COBERTURA: Record<Exclude<Permiso, 'appMovil'>, Handler[]> = {
  dashboard: [[DashboardController, 'getIndicadores']],
  perfil: [
    [UsuariosController, 'findMe'],
    [UsuariosController, 'updateMe'],
  ],
  empresas: [
    [EmpresasController, 'listar'],
    [EmpresasController, 'crear'],
    [EmpresasController, 'actualizar'],
    [EmpresasController, 'desactivar'],
    [EmpresasController, 'activar'],
  ],
  notificaciones: [
    [NotificacionesController, 'findMine'],
    [NotificacionesController, 'marcarLeida'],
    [NotificacionesController, 'marcarTodasLeidas'],
  ],
  catalogos: [[CatalogoItemController, 'findByTipo']],
  campanias: [
    [CampaniasController, 'findAll'],
    [CampaniasController, 'getActual'],
    [CampaniasController, 'findOne'],
  ],
  ayuda: [
    [AyudaController, 'findArticulos'],
    [AyudaController, 'crearTicket'],
  ],
  fincas: [
    [FincasController, 'findAll'],
    [FincasController, 'findOne'],
    [CuartelesController, 'findByFinca'],
    [CuartelesController, 'buscar'],
    [CuartelesController, 'variedades'],
    [CuartelesController, 'findOne'],
  ],
  fincasEscritura: [
    [FincasController, 'create'],
    [FincasController, 'update'],
    [FincasController, 'desactivar'],
  ],
  cuartelesEscritura: [
    [CuartelesController, 'create'],
    [CuartelesController, 'update'],
  ],
  cuartelesBaja: [[CuartelesController, 'desactivar']],
  usuarios: [
    [UsuariosController, 'findAll'],
    [UsuariosController, 'findOne'],
    [UsuariosController, 'create'],
    [UsuariosController, 'update'],
    [UsuariosController, 'fincasAsignadas'],
    [UsuariosController, 'asignarFincas'],
    [UsuariosController, 'deactivate'],
  ],
  roles: [[RolesController, 'findAll']],
  logAuditoria: [[LogAuditoriaController, 'findAll']],
  catalogosEscritura: [
    [CatalogoItemController, 'create'],
    [CatalogoItemController, 'update'],
    [CatalogoItemController, 'desactivar'],
    [CatalogoItemController, 'remove'],
  ],
  configuracion: [
    [ConfiguracionController, 'findAll'],
    [ConfiguracionController, 'findByClave'],
    [ConfiguracionController, 'set'],
  ],
  campaniasEscritura: [
    [CampaniasController, 'create'],
    [CampaniasController, 'update'],
    [CampaniasController, 'cerrar'],
    [CampaniasController, 'reabrir'],
    [MetasCosechaController, 'fijar'],
  ],
  ayudaAdministracion: [
    [AyudaController, 'createArticulo'],
    [AyudaController, 'updateArticulo'],
    [AyudaController, 'desactivarArticulo'],
    [AyudaController, 'findTickets'],
  ],
  operaciones: [
    [RegistroLaborController, 'costeo'],
    [RegistroLaborController, 'margenBruto'],
    [InsumosController, 'historialCostos'],
    [InsumosController, 'create'],
    [InsumosController, 'update'],
    [InsumosController, 'setCosto'],
    [TipoLaborController, 'historialCostos'],
    [TipoLaborController, 'create'],
    [TipoLaborController, 'update'],
    [TipoLaborController, 'setCosto'],
  ],
  operacionesBaja: [
    [InsumosController, 'desactivar'],
    [TipoLaborController, 'desactivar'],
  ],
  operacionesLectura: [
    [InsumosController, 'findAll'],
    [InsumosController, 'findOne'],
    [TipoLaborController, 'findAll'],
    [TipoLaborController, 'findOne'],
  ],
  historialLabores: [
    [RegistroLaborController, 'findByCuartel'],
    [RegistroLaborController, 'findOne'],
  ],
  laboresRegistro: [
    [RegistroLaborController, 'registrarUno'],
    [RegistroLaborController, 'sincronizarLote'],
  ],
  telemetria: [
    [SensoresController, 'findByFinca'],
    [SensoresController, 'findOne'],
    [SensoresController, 'create'],
    [SensoresController, 'update'],
    [SensoresController, 'desactivar'],
    [SensoresController, 'credencialMqtt'],
    [LecturasIotController, 'findBySensor'],
    [LecturasIotController, 'serie'],
    [AlertasIotController, 'findPendientes'],
    [AlertasIotController, 'marcarRevisada'],
    [UmbralSensorController, 'findBySensor'],
    [UmbralSensorController, 'setUmbral'],
  ],
  vendimia: [
    [RemitosController, 'findAll'],
    [RemitosController, 'findOne'],
    [RemitosController, 'generarBorrador'],
    [PesajeVendimiaController, 'findByCuartel'],
    [PesajeVendimiaController, 'estadoCosechaFinca'],
    [PesajeVendimiaController, 'estadoCosecha'],
    [PesajeVendimiaController, 'findOne'],
    [MetasCosechaController, 'avanceActual'],
    [MetasCosechaController, 'avance'],
  ],
  pesajesRegistro: [
    [PesajeVendimiaController, 'registrarUno'],
    [PesajeVendimiaController, 'sincronizarLote'],
  ],
  vendimiaAprobacion: [
    [RemitosController, 'aprobar'],
    [RemitosController, 'rechazar'],
    [RemitosController, 'registrarLiquidacion'],
    [RemitosController, 'getLiquidacion'],
  ],
  cuadrillas: [
    [CuadrillasController, 'findByFinca'],
    [CuadrillasController, 'findOne'],
    [CuadrillasController, 'create'],
  ],
  cuadrillasEdicion: [
    [CuadrillasController, 'update'],
    [CuadrillasController, 'historialTarifas'],
  ],
  cuadrillasTarifas: [
    [CuadrillasController, 'setTarifa'],
    [CuadrillasController, 'desactivar'],
  ],
  inteligencia: [
    [InteligenciaAgronomicaController, 'correlacion'],
    [InteligenciaAgronomicaController, 'recomendaciones'],
    [InteligenciaAgronomicaController, 'resolverRecomendacion'],
    [InteligenciaAgronomicaController, 'compararCampanias'],
  ],
};

const reflector = new Reflector();

/** Roles efectivos de un handler, como los resuelve el `RolesGuard`. */
function rolesDe([controlador, metodo]: Handler): RolNombre[] {
  const handler = (controlador.prototype as Record<string, unknown>)[metodo] as
    Handler[0] | undefined;
  if (!handler) throw new Error(`${controlador.name}.${metodo} no existe`);
  const objetivos = [handler, controlador];
  const anyRole = reflector.getAllAndOverride<
    boolean | typeof CON_ADMINISTRADOR | undefined
  >(ANY_ROLE_KEY, objetivos);
  if (anyRole) {
    return anyRole === CON_ADMINISTRADOR
      ? [...TODOS, RolNombre.ADMINISTRADOR]
      : [...TODOS];
  }
  return (
    reflector.getAllAndOverride<RolNombre[] | undefined>(
      ROLES_KEY,
      objetivos,
    ) ?? []
  );
}

const ordenar = (roles: readonly RolNombre[]) => [...roles].sort();

describe('Tabla de permisos (D-024)', () => {
  describe.each(Object.entries(COBERTURA))('%s', (permiso, handlers) => {
    it.each(handlers.map((h) => [`${h[0].name}.${h[1]}`, h] as const))(
      '%s acepta exactamente los roles del permiso',
      (_nombre, handler) => {
        expect(ordenar(rolesDe(handler))).toEqual(
          ordenar(PERMISOS[permiso as Permiso]),
        );
      },
    );
  });

  it('appMovil es la unión de registrar labores y registrar pesajes', () => {
    const union = new Set([
      ...PERMISOS.laboresRegistro,
      ...PERMISOS.pesajesRegistro,
    ]);
    expect(ordenar(PERMISOS.appMovil)).toEqual(ordenar([...union]));
  });

  it('el Auditor no usa la app móvil y el Capataz sí', () => {
    expect(tienePermiso(RolNombre.AUDITOR, 'appMovil')).toBe(false);
    expect(tienePermiso(RolNombre.CAPATAZ, 'appMovil')).toBe(true);
  });

  it('permisosDe devuelve solo los del rol', () => {
    const auditor = permisosDe(RolNombre.AUDITOR);
    expect(auditor).toContain('logAuditoria');
    expect(auditor).toContain('fincas');
    expect(auditor).not.toContain('usuarios');
    // El Propietario administra su empresa: tiene todos salvo dar de alta
    // empresas, que es de la plataforma (D-025).
    expect(permisosDe(RolNombre.PROPIETARIO)).toEqual(
      (Object.keys(PERMISOS) as Permiso[]).filter((p) => p !== 'empresas'),
    );
  });

  it('el Administrador de plataforma solo administra empresas y su perfil', () => {
    expect(permisosDe(RolNombre.ADMINISTRADOR)).toEqual(['perfil', 'empresas']);
  });
});
