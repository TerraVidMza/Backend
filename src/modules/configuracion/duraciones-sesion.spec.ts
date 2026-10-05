import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';

import { ConfiguracionService } from './configuracion.service';
import { Configuracion } from './entities/configuracion.entity';
import { LIMITES_SESION } from './configuracion.keys';

const EMPRESA_ID = '11111111-1111-1111-1111-111111111111';

/**
 * Duración de las sesiones por empresa (D-023).
 *
 * El riesgo que cuidan estos tests es que una configuración mal cargada deje a
 * una empresa entera sin poder iniciar sesión, o con sesiones de duración
 * absurda: lo que viene de la base se acota, y lo que entra por la API se
 * rechaza si está fuera de rango.
 */
describe('ConfiguracionService — duraciones de sesión', () => {
  let service: ConfiguracionService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  const fila = (clave: string, valor: string) =>
    ({ clave, valor, empresaId: EMPRESA_ID }) as Configuracion;

  beforeEach(async () => {
    repo = {
      find: jest.fn(() => Promise.resolve([])),
      findOne: jest.fn(() => Promise.resolve(null)),
      create: jest.fn((datos: Partial<Configuracion>) => datos),
      save: jest.fn((c: Configuracion) => Promise.resolve(c)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConfiguracionService,
        { provide: getRepositoryToken(Configuracion), useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(ConfiguracionService);
  });

  describe('getDuracionesSesion', () => {
    it('sin configuración usa 15 minutos y 7 días', async () => {
      await expect(service.getDuracionesSesion(EMPRESA_ID)).resolves.toEqual({
        accessMinutos: 15,
        refreshDias: 7,
      });
    });

    it('usa los valores cargados por la empresa', async () => {
      repo.find.mockResolvedValue([
        fila('sesion_access_minutos', '30'),
        fila('sesion_refresh_dias', '14'),
      ]);
      await expect(service.getDuracionesSesion(EMPRESA_ID)).resolves.toEqual({
        accessMinutos: 30,
        refreshDias: 14,
      });
    });

    it.each([
      ['fuera de rango', '600'],
      ['no numérico', 'una hora'],
      ['decimal', '7.5'],
    ])('ignora un valor %s cargado a mano en la base', async (_caso, valor) => {
      repo.find.mockResolvedValue([fila('sesion_access_minutos', valor)]);
      const { accessMinutos } = await service.getDuracionesSesion(EMPRESA_ID);
      expect(accessMinutos).toBe(
        LIMITES_SESION.sesion_access_minutos.porDefecto,
      );
    });
  });

  describe('set', () => {
    it.each([
      ['sesion_access_minutos', '4'],
      ['sesion_access_minutos', '61'],
      ['sesion_refresh_dias', '0'],
      ['sesion_refresh_dias', '31'],
      ['sesion_refresh_dias', '7d'],
    ] as const)('rechaza %s = %s', async (clave, valor) => {
      await expect(
        service.set({ clave, valor }, 'usuario-1', EMPRESA_ID),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('acepta los extremos del rango', async () => {
      await service.set(
        { clave: 'sesion_access_minutos', valor: '5' },
        'usuario-1',
        EMPRESA_ID,
      );
      await service.set(
        { clave: 'sesion_refresh_dias', valor: '30' },
        'usuario-1',
        EMPRESA_ID,
      );
      expect(repo.save).toHaveBeenCalledTimes(2);
    });

    it('no valida rangos en claves que no son de sesión', async () => {
      await service.set(
        { clave: 'moneda', valor: 'USD' },
        'usuario-1',
        EMPRESA_ID,
      );
      expect(repo.save).toHaveBeenCalled();
    });
  });
});
