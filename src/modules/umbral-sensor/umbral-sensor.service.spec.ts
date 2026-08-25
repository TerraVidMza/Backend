import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';

import { SetUmbralDto } from './dto/set-umbral.dto';
import { UmbralSensor } from './entities/umbral-sensor.entity';
import { UmbralSensorService } from './umbral-sensor.service';

const SENSOR_ID = '11111111-1111-1111-1111-111111111111';
const USUARIO_ID = '22222222-2222-2222-2222-222222222222';

/**
 * Los DTO se construyen con `plainToInstance`, igual que hace el
 * `ValidationPipe`. Es la parte que importa: con `target: ES2023` los campos
 * declarados existen como propiedades propias en `undefined` aunque el cliente
 * no los haya enviado, así que un test que arme el DTO como objeto literal
 * pasa aunque el service esté roto.
 */
function comoLoArmaElPipe(payload: Record<string, unknown>): SetUmbralDto {
  return plainToInstance(SetUmbralDto, payload);
}

/** Doble mínimo del repositorio: solo los tres métodos que usa `setUmbral`. */
interface RepoFalso {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
}

describe('UmbralSensorService.setUmbral', () => {
  let service: UmbralSensorService;
  let repo: RepoFalso;
  let existente: UmbralSensor;

  beforeEach(async () => {
    existente = {
      id: '33333333-3333-3333-3333-333333333333',
      sensorId: SENSOR_ID,
      umbralMinimo: 20,
      umbralMaximo: 80,
      configuradoPorId: USUARIO_ID,
    } as UmbralSensor;

    repo = {
      findOne: jest.fn().mockResolvedValue(existente),
      create: jest.fn((datos: Partial<UmbralSensor>) => datos as UmbralSensor),
      save: jest.fn((umbral: UmbralSensor) => Promise.resolve(umbral)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UmbralSensorService,
        { provide: getRepositoryToken(UmbralSensor), useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(UmbralSensorService);
  });

  it('null borra el umbral mínimo', async () => {
    const r = await service.setUmbral(
      SENSOR_ID,
      comoLoArmaElPipe({ umbralMinimo: null }),
      USUARIO_ID,
    );
    expect(r.umbralMinimo).toBeNull();
  });

  // Regresión: con el operador `in` el máximo omitido se borraba junto con el
  // mínimo, porque `plainToInstance` deja la propiedad presente en undefined.
  it('un umbral omitido conserva su valor anterior', async () => {
    const r = await service.setUmbral(
      SENSOR_ID,
      comoLoArmaElPipe({ umbralMinimo: null }),
      USUARIO_ID,
    );
    expect(r.umbralMaximo).toBe(80);
  });

  it('borra ambos cuando ambos llegan en null', async () => {
    const r = await service.setUmbral(
      SENSOR_ID,
      comoLoArmaElPipe({ umbralMinimo: null, umbralMaximo: null }),
      USUARIO_ID,
    );
    expect(r.umbralMinimo).toBeNull();
    expect(r.umbralMaximo).toBeNull();
  });

  it('actualiza solo el valor enviado', async () => {
    const r = await service.setUmbral(
      SENSOR_ID,
      comoLoArmaElPipe({ umbralMinimo: 35 }),
      USUARIO_ID,
    );
    expect(r.umbralMinimo).toBe(35);
    expect(r.umbralMaximo).toBe(80);
  });

  it('rechaza un mínimo mayor o igual al máximo', async () => {
    await expect(
      service.setUmbral(
        SENSOR_ID,
        comoLoArmaElPipe({ umbralMinimo: 90 }),
        USUARIO_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // Borrar el mínimo tiene que poder dejar un máximo que antes era inválido
  // en combinación con él: sin el guard de `null` la comparación tiraría 400.
  it('borrar un umbral no dispara la validación de rango', async () => {
    const r = await service.setUmbral(
      SENSOR_ID,
      comoLoArmaElPipe({ umbralMaximo: null }),
      USUARIO_ID,
    );
    expect(r.umbralMaximo).toBeNull();
    expect(r.umbralMinimo).toBe(20);
  });

  it('crea el umbral si el sensor no tenía uno', async () => {
    repo.findOne.mockResolvedValue(null);
    const r = await service.setUmbral(
      SENSOR_ID,
      comoLoArmaElPipe({ umbralMaximo: 40 }),
      USUARIO_ID,
    );
    expect(repo.create).toHaveBeenCalled();
    expect(r.umbralMaximo).toBe(40);
  });
});
