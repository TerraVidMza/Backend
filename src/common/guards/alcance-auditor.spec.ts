import { PATH_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { ANY_ROLE_KEY } from '../decorators/any-role.decorator';
import { RolNombre } from '../enums/rol.enum';
import { FincasController } from '../../modules/fincas/fincas.controller';
import { CuartelesController } from '../../modules/cuarteles/cuarteles.controller';
import { RegistroLaborController } from '../../modules/registro-labor/registro-labor.controller';
import { ConfiguracionController } from '../../modules/configuracion/configuracion.controller';

type Handler = (...args: never[]) => unknown;

/**
 * El handler por su nombre, y no `Controlador.prototype.metodo` directo, para
 * no arrastrar una referencia a un método sin ligar. El nombre lo sigue
 * verificando el compilador por `keyof`, así que renombrar un endpoint rompe
 * el test en `tsc` y no recién al correrlo.
 */
function handlerDe<T extends object, K extends keyof T>(
  controlador: { prototype: T },
  metodo: K,
): Handler {
  return controlador.prototype[metodo] as Handler;
}

function rolesDe(handler: Handler): RolNombre[] {
  return (Reflect.getMetadata(ROLES_KEY, handler) as RolNombre[]) ?? [];
}

function esAnyRole(handler: Handler): boolean {
  return Reflect.getMetadata(ANY_ROLE_KEY, handler) === true;
}

function rutaDe(handler: Handler): string {
  return Reflect.getMetadata(PATH_METADATA, handler) as string;
}

/**
 * El alcance del Auditor, endpoint por endpoint (HU-07 / HU-17, D-021).
 *
 * El `RolesGuard` es fail-closed y ya tiene su propia cobertura: lo que estos
 * tests fijan es la otra mitad, qué declara cada handler. Es una decisión de
 * producto que se escribe en un decorador de una línea y se rompe igual de
 * fácil: agregar un rol de más a un `@Roles` no hace fallar nada.
 *
 * El caso que motiva el archivo: HU-17 le concede al Auditor el historial de
 * operaciones **por cuartel**, pero los listados de fincas y de cuarteles lo
 * excluían, así que no tenía de dónde sacar el `cuartelId` y su única historia
 * de negocio era inalcanzable.
 */
describe('Alcance del Auditor', () => {
  const lecturas: Array<[string, Handler]> = [
    ['fincas · listar', handlerDe(FincasController, 'findAll')],
    ['fincas · ver una', handlerDe(FincasController, 'findOne')],
    ['cuarteles · por finca', handlerDe(CuartelesController, 'findByFinca')],
    ['cuarteles · buscar', handlerDe(CuartelesController, 'buscar')],
    ['cuarteles · variedades', handlerDe(CuartelesController, 'variedades')],
    ['cuarteles · ver uno', handlerDe(CuartelesController, 'findOne')],
    [
      'labores · historial',
      handlerDe(RegistroLaborController, 'findByCuartel'),
    ],
    ['labores · ver una', handlerDe(RegistroLaborController, 'findOne')],
  ];

  it.each(lecturas)('lee %s', (_nombre, handler) => {
    expect(rolesDe(handler)).toContain(RolNombre.AUDITOR);
  });

  const escrituras: Array<[string, Handler]> = [
    ['fincas · crear', handlerDe(FincasController, 'create')],
    ['fincas · editar', handlerDe(FincasController, 'update')],
    ['fincas · dar de baja', handlerDe(FincasController, 'desactivar')],
    ['cuarteles · crear', handlerDe(CuartelesController, 'create')],
    ['cuarteles · editar', handlerDe(CuartelesController, 'update')],
    ['cuarteles · dar de baja', handlerDe(CuartelesController, 'desactivar')],
    ['labores · registrar', handlerDe(RegistroLaborController, 'registrarUno')],
    [
      'labores · sincronizar',
      handlerDe(RegistroLaborController, 'sincronizarLote'),
    ],
  ];

  it.each(escrituras)('no escribe %s', (_nombre, handler) => {
    expect(rolesDe(handler)).not.toContain(RolNombre.AUDITOR);
  });

  /**
   * Los dos endpoints que el propio código rotula como «dato económico». Que
   * el Auditor lea el historial no los reabre: el costo unitario se filtra del
   * payload, no se le concede el acceso a la tabla de costeo.
   */
  const economicos: Array<[string, Handler]> = [
    ['costeo por cuartel', handlerDe(RegistroLaborController, 'costeo')],
    ['margen bruto', handlerDe(RegistroLaborController, 'margenBruto')],
  ];

  it.each(economicos)('%s sigue fuera de su alcance', (_nombre, handler) => {
    const roles = rolesDe(handler);
    expect(roles).not.toContain(RolNombre.AUDITOR);
    expect(roles).not.toContain(RolNombre.CAPATAZ);
  });
});

/**
 * La configuración partida en dos (D-020): las preferencias de presentación
 * las lee cualquiera; la configuración del sistema, que incluye el SMTP sin
 * enmascarar salvo la contraseña, sigue siendo del Propietario.
 */
describe('Configuración', () => {
  it('las preferencias las lee cualquier rol autenticado', () => {
    expect(
      esAnyRole(handlerDe(ConfiguracionController, 'findPreferencias')),
    ).toBe(true);
  });

  it.each([
    ['listado completo', handlerDe(ConfiguracionController, 'findAll')],
    ['una clave', handlerDe(ConfiguracionController, 'findByClave')],
    ['escritura', handlerDe(ConfiguracionController, 'set')],
  ] as Array<[string, Handler]>)(
    '%s sigue siendo del Propietario',
    (_nombre, handler) => {
      expect(esAnyRole(handler)).toBe(false);
      expect(rolesDe(handler)).toEqual([RolNombre.PROPIETARIO]);
    },
  );

  /**
   * `GET /configuracion/:clave` capturaría "preferencias" y respondería 403 al
   * rol que no es Propietario. Nest registra las rutas en el orden en que el
   * `MetadataScanner` recorre el prototipo, que es el de declaración: mover el
   * handler unas líneas más abajo rompe el endpoint sin tocar una sola línea
   * suya, y sin que falle nada más.
   */
  it('la ruta de preferencias se declara antes que la de :clave', () => {
    expect(rutaDe(handlerDe(ConfiguracionController, 'findPreferencias'))).toBe(
      'preferencias',
    );
    expect(rutaDe(handlerDe(ConfiguracionController, 'findByClave'))).toBe(
      ':clave',
    );

    const metodos = Object.getOwnPropertyNames(
      ConfiguracionController.prototype,
    );
    expect(metodos).toContain('findPreferencias');
    expect(metodos.indexOf('findPreferencias')).toBeLessThan(
      metodos.indexOf('findByClave'),
    );
  });
});
