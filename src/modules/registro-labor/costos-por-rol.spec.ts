import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { instanceToPlain } from 'class-transformer';
import { DataSource } from 'typeorm';

import { RegistroLaborService } from './registro-labor.service';
import { RegistroLabor } from './entities/registro-labor.entity';
import { DetalleInsumoLabor } from './entities/detalle-insumo-labor.entity';
import { TipoLaborService } from '../tipo-labor/tipo-labor.service';
import { InsumosService } from '../insumos/insumos.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { EstadoSync } from '../../common/enums/estado-sync.enum';

const CUARTEL_ID = '11111111-1111-1111-1111-111111111111';
const REGISTRO_ID = '44444444-4444-4444-4444-444444444444';
const DETALLE_ID = '55555555-5555-5555-5555-555555555555';
const EMPRESA_ID = '66666666-6666-6666-6666-666666666666';

const COSTO_LABOR = 1000;
const COSTO_INSUMO = 250;
const HASH = '$2b$10$hashquenuncadebesalir';

/**
 * El alcance económico del historial por cuartel (HU-17, D-021).
 *
 * `costeo` y `margen-bruto` excluyen al Auditor por `@Roles`, con el comentario
 * "dato económico". El historial no puede hacer lo mismo —HU-17 se lo concede—
 * y hasta ahora le devolvía el costo unitario de la labor **y el de cada
 * insumo**: el dato que esos dos endpoints le cerraban salía por otra puerta.
 *
 * Se prueba en el service porque es donde se filtra. Ocultar la columna en la
 * interfaz sería cosmético: el payload seguiría trayendo el número.
 */
function unDetalle(): DetalleInsumoLabor {
  return Object.assign(new DetalleInsumoLabor(), {
    id: DETALLE_ID,
    registroLaborId: REGISTRO_ID,
    insumoId: '77777777-7777-7777-7777-777777777777',
    cantidadUsada: 3,
    costoUnitarioAlSync: COSTO_INSUMO,
  });
}

function unUsuario(): Usuario {
  return Object.assign(new Usuario(), {
    id: '88888888-8888-8888-8888-888888888888',
    nombre: 'Capataz de prueba',
    email: 'capataz@example.com',
    passwordHash: HASH,
  });
}

function unRegistro(conDetalles = true): RegistroLabor {
  return Object.assign(new RegistroLabor(), {
    id: REGISTRO_ID,
    cuartelId: CUARTEL_ID,
    fecha: '2026-03-10',
    cantidad: 8,
    costoUnitarioAlSync: COSTO_LABOR,
    estadoSync: EstadoSync.SINCRONIZADO,
    usuario: unUsuario(),
    ...(conDetalles ? { detalles: [unDetalle()] } : {}),
  });
}

describe('RegistroLaborService — costos según el alcance del rol', () => {
  let service: RegistroLaborService;
  let repo: { findAndCount: jest.Mock; findOne: jest.Mock };
  let guardado: RegistroLabor;

  beforeEach(async () => {
    guardado = unRegistro();
    repo = {
      findAndCount: jest.fn(() => Promise.resolve([[guardado], 1])),
      findOne: jest.fn(() => Promise.resolve(guardado)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RegistroLaborService,
        { provide: getRepositoryToken(RegistroLabor), useValue: repo },
        {
          provide: getRepositoryToken(DetalleInsumoLabor),
          useValue: { find: jest.fn(), save: jest.fn() },
        },
        { provide: TipoLaborService, useValue: {} },
        { provide: InsumosService, useValue: {} },
        { provide: NotificacionesService, useValue: { crear: jest.fn() } },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(RegistroLaborService);
  });

  it('el historial conserva los costos para los roles con alcance económico', async () => {
    const { data } = await service.findByCuartel(CUARTEL_ID, {}, undefined);

    expect(data[0].costoUnitarioAlSync).toBe(COSTO_LABOR);
    expect(data[0].detalles[0].costoUnitarioAlSync).toBe(COSTO_INSUMO);
  });

  it('con `ocultarCostos` el costo se va de la labor y de cada insumo', async () => {
    const { data } = await service.findByCuartel(
      CUARTEL_ID,
      {},
      undefined,
      true,
    );

    expect(data[0].costoUnitarioAlSync).toBeNull();
    // El insumo es la mitad que más importa: es el detalle línea por línea del
    // que se puede reconstruir el costo total del cuartel a mano.
    expect(data[0].detalles[0].costoUnitarioAlSync).toBeNull();
  });

  it('no muta la entidad que sigue viva en el contexto de TypeORM', async () => {
    await service.findByCuartel(CUARTEL_ID, {}, undefined, true);

    expect(guardado.costoUnitarioAlSync).toBe(COSTO_LABOR);
    expect(guardado.detalles[0].costoUnitarioAlSync).toBe(COSTO_INSUMO);
  });

  /**
   * La copia conserva el prototipo para no dejar a la entidad sin sus metadatos
   * de class-transformer: hoy no declara ninguno, y el día que declare un
   * `@Exclude()` este camino tiene que respetarlo.
   */
  it('la copia sigue siendo la entidad, no un objeto literal', async () => {
    const { data } = await service.findByCuartel(
      CUARTEL_ID,
      {},
      undefined,
      true,
    );

    expect(data[0]).toBeInstanceOf(RegistroLabor);
    expect(data[0].detalles[0]).toBeInstanceOf(DetalleInsumoLabor);
  });

  // El historial trae el usuario que registró cada labor. El hash lo saca el
  // `@Exclude()` del propio `Usuario`, que sobrevive a la copia porque el
  // objeto anidado conserva su clase; se fija acá para que el filtrado de
  // costos no lo rompa al reconstruir el registro.
  it('el hash del usuario no sale en el historial', async () => {
    const { data } = await service.findByCuartel(
      CUARTEL_ID,
      {},
      undefined,
      true,
    );
    const serializado = JSON.stringify(instanceToPlain(data[0]));

    expect(serializado).not.toContain(HASH);
    expect(serializado).toContain('capataz@example.com');
  });

  it('findOne aplica el mismo criterio', async () => {
    const conCostos = await service.findById(REGISTRO_ID, EMPRESA_ID);
    expect(conCostos.costoUnitarioAlSync).toBe(COSTO_LABOR);

    const sinCostos = await service.findById(REGISTRO_ID, EMPRESA_ID, true);
    expect(sinCostos.costoUnitarioAlSync).toBeNull();
  });

  // `findById` no pide la relación `detalles`, así que llega sin ella.
  it('un registro sin detalles cargados no rompe el filtrado', async () => {
    guardado = unRegistro(false);
    repo.findOne.mockResolvedValue(guardado);

    const registro = await service.findById(REGISTRO_ID, EMPRESA_ID, true);

    expect(registro.costoUnitarioAlSync).toBeNull();
    expect(registro.detalles).toBeUndefined();
  });
});
