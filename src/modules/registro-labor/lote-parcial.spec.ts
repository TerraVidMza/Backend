import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { RegistroLaborService } from './registro-labor.service';
import { RegistroLabor } from './entities/registro-labor.entity';
import { DetalleInsumoLabor } from './entities/detalle-insumo-labor.entity';
import { TipoLaborService } from '../tipo-labor/tipo-labor.service';
import { InsumosService } from '../insumos/insumos.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { EstadoSync } from '../../common/enums/estado-sync.enum';
import type { CreateRegistroLaborDto } from './dto/create-registro-labor.dto';

const CUARTEL_ID = '11111111-1111-1111-1111-111111111111';
const TIPO_LABOR_ID = '22222222-2222-2222-2222-222222222222';
const USUARIO_ID = '33333333-3333-3333-3333-333333333333';

/** Lo que `NotificacionesService.crear` recibe, para poder afirmarlo tipado. */
interface AvisoCreado {
  usuarioId: string;
  tipo: string;
  titulo: string;
  descripcion: string;
  urlAccion?: string | null;
}

/**
 * Lote parcialmente fallido (HU-14, F1-2).
 *
 * El bug original hacía que **un registro malo devolviera 500 y descartara el
 * lote entero**: no había try/catch por ítem, y la rama de error escribía dentro
 * de una transacción ya abortada. Un capataz con diez partes del día perdía los
 * diez por culpa de uno.
 *
 * Se prueba a nivel de service y no de DTO porque lo que importa es el
 * aislamiento entre ítems, que solo existe en el bucle de `sincronizarLote`.
 */
describe('RegistroLaborService.sincronizarLote — lote parcial', () => {
  let service: RegistroLaborService;
  let notificaciones: { crear: jest.Mock<Promise<unknown>, [AvisoCreado]> };

  const registro = (
    localUuid: string,
    fecha: string,
  ): CreateRegistroLaborDto => ({
    localUuid,
    cuartelId: CUARTEL_ID,
    tipoLaborId: TIPO_LABOR_ID,
    fecha,
    cantidad: 1,
    insumos: [],
    createdAtLocal: `${fecha}T08:00:00.000Z`,
  });

  beforeEach(async () => {
    notificaciones = {
      crear: jest.fn<Promise<unknown>, [AvisoCreado]>(() =>
        Promise.resolve({}),
      ),
    };

    // El costo solo está vigente desde 2026-01-01: todo lo anterior falla con
    // "sin costo vigente", que es el camino de error real de F1-1.
    const tipoLabor = {
      getCostoVigente: jest.fn((_id: string, fecha: string) =>
        Promise.resolve(fecha >= '2026-01-01' ? { costoUnitario: 1000 } : null),
      ),
      findById: jest
        .fn()
        .mockResolvedValue({ id: TIPO_LABOR_ID, activo: true }),
    };

    const manager = {
      findOne: jest.fn().mockResolvedValue(null),
      // Ningún ítem de catálogo está dado de baja: la inconsistencia de
      // catálogo es otro caso y tiene su propia cobertura en el smoke test.
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn((_e: unknown, datos: unknown) => datos),
      save: jest.fn((datos: { localUuid?: string }) =>
        Promise.resolve({ id: `srv-${datos.localUuid ?? 'x'}`, ...datos }),
      ),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };

    const dataSource = {
      transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
        cb(manager),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RegistroLaborService,
        {
          provide: getRepositoryToken(RegistroLabor),
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn((d: unknown) => Promise.resolve(d)),
            create: jest.fn((d: unknown) => d),
            update: jest.fn(),
            query: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DetalleInsumoLabor),
          useValue: { find: jest.fn(), save: jest.fn() },
        },
        { provide: TipoLaborService, useValue: tipoLabor },
        { provide: InsumosService, useValue: { getCostoVigente: jest.fn() } },
        { provide: NotificacionesService, useValue: notificaciones },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(RegistroLaborService);
  });

  it('un registro inválido no descarta los válidos del mismo lote', async () => {
    const resultados = await service.sincronizarLote(
      [
        registro('aaaaaaaa-0000-4000-8000-000000000001', '2026-03-10'),
        registro('aaaaaaaa-0000-4000-8000-000000000002', '2020-03-10'), // sin costo
        registro('aaaaaaaa-0000-4000-8000-000000000003', '2026-03-12'),
      ],
      USUARIO_ID,
    );

    expect(resultados).toHaveLength(3);
    const porUuid = new Map(resultados.map((r) => [r.localUuid, r.estado]));
    expect(porUuid.get('aaaaaaaa-0000-4000-8000-000000000001')).toBe(
      EstadoSync.SINCRONIZADO,
    );
    expect(porUuid.get('aaaaaaaa-0000-4000-8000-000000000002')).toBe(
      EstadoSync.ERROR,
    );
    expect(porUuid.get('aaaaaaaa-0000-4000-8000-000000000003')).toBe(
      EstadoSync.SINCRONIZADO,
    );
  });

  it('el ítem fallido explica el motivo', async () => {
    const [resultado] = await service.sincronizarLote(
      [registro('bbbbbbbb-0000-4000-8000-000000000001', '2020-03-10')],
      USUARIO_ID,
    );
    expect(resultado.estado).toBe(EstadoSync.ERROR);
    expect(resultado.errorMessage).toMatch(/costo vigente/i);
  });

  /**
   * HU-14 pide procesar de más antiguo a más nuevo: si dos partes del mismo
   * cuartel entran juntos, el orden tiene que ser el de la finca y no el que el
   * cliente serializó.
   */
  it('procesa el lote de más antiguo a más nuevo', async () => {
    const resultados = await service.sincronizarLote(
      [
        registro('cccccccc-0000-4000-8000-000000000003', '2026-03-20'),
        registro('cccccccc-0000-4000-8000-000000000001', '2026-03-10'),
        registro('cccccccc-0000-4000-8000-000000000002', '2026-03-15'),
      ],
      USUARIO_ID,
    );

    expect(resultados.map((r) => r.localUuid)).toEqual([
      'cccccccc-0000-4000-8000-000000000001',
      'cccccccc-0000-4000-8000-000000000002',
      'cccccccc-0000-4000-8000-000000000003',
    ]);
  });

  /** HU-35: el Capataz tiene que enterarse de lo que no entró. */
  it('notifica una sola vez por lote, no una por registro fallido', async () => {
    await service.sincronizarLote(
      [
        registro('dddddddd-0000-4000-8000-000000000001', '2020-03-10'),
        registro('dddddddd-0000-4000-8000-000000000002', '2020-03-11'),
      ],
      USUARIO_ID,
    );

    expect(notificaciones.crear).toHaveBeenCalledTimes(1);
    const aviso = notificaciones.crear.mock.calls[0][0];
    expect(aviso.tipo).toBe('error_sincronizacion');
    expect(aviso.usuarioId).toBe(USUARIO_ID);
    expect(aviso.titulo).toContain('2');
  });

  it('un lote sin fallas no notifica nada', async () => {
    await service.sincronizarLote(
      [registro('eeeeeeee-0000-4000-8000-000000000001', '2026-03-10')],
      USUARIO_ID,
    );
    expect(notificaciones.crear).not.toHaveBeenCalled();
  });
});
