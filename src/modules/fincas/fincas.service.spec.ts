import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { FincasService } from './fincas.service';
import { Finca } from './entities/finca.entity';
import { CuartelesService } from '../cuarteles/cuarteles.service';
import { GeoService } from '../../common/geo/geo.service';

const EMPRESA_ID = '11111111-1111-1111-1111-111111111111';
const OTRA_EMPRESA_ID = '22222222-2222-2222-2222-222222222222';
const FINCA_ID = '33333333-3333-3333-3333-333333333333';

describe('FincasService', () => {
  let service: FincasService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let cuartelesService: {
    contarActivosPorFinca: jest.Mock;
    contarActivos: jest.Mock;
  };
  let geoService: {
    derivar: jest.Mock;
    advertenciaCuartelesFueraDelContorno: jest.Mock;
  };

  beforeEach(async () => {
    geoService = {
      derivar: jest.fn(() => Promise.resolve({})),
      advertenciaCuartelesFueraDelContorno: jest.fn(() =>
        Promise.resolve(null),
      ),
    };
    repo = {
      find: jest.fn(() => Promise.resolve([])),
      findOne: jest.fn(() => Promise.resolve(null)),
      create: jest.fn((dto: Partial<Finca>) => dto),
      save: jest.fn((finca) => Promise.resolve(finca)),
    };
    cuartelesService = {
      contarActivosPorFinca: jest.fn(() => Promise.resolve(new Map())),
      contarActivos: jest.fn(() => Promise.resolve(0)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FincasService,
        { provide: getRepositoryToken(Finca), useValue: repo },
        { provide: CuartelesService, useValue: cuartelesService },
        // La lógica espacial se prueba en `geo.service.spec.ts` y contra
        // PostGIS en el e2e; acá solo importa cómo la usa el servicio.
        { provide: GeoService, useValue: geoService },
      ],
    }).compile();

    service = moduleRef.get(FincasService);
  });

  describe('findAll (HU-08)', () => {
    it('acota la búsqueda a la empresa y solo trae fincas activas', async () => {
      await service.findAll(EMPRESA_ID);

      const [{ where }] = repo.find.mock.calls[0] as [
        { where: { empresaId: string; activa: boolean } },
      ];
      expect(where.empresaId).toBe(EMPRESA_ID);
      expect(where.activa).toBe(true);
    });

    it('agrega el conteo de cuarteles activos con una sola consulta agrupada', async () => {
      const fincaA = { id: 'a', nombre: 'A' } as Finca;
      const fincaB = { id: 'b', nombre: 'B' } as Finca;
      repo.find.mockResolvedValueOnce([fincaA, fincaB]);
      cuartelesService.contarActivosPorFinca.mockResolvedValueOnce(
        new Map([
          ['a', 3],
          ['b', 0],
        ]),
      );

      const resultado = await service.findAll(EMPRESA_ID);

      expect(cuartelesService.contarActivosPorFinca).toHaveBeenCalledWith([
        'a',
        'b',
      ]);
      expect(resultado.map((f) => f.cuartelesActivos)).toEqual([3, 0]);
    });

    it('una finca sin conteo devuelve 0, no undefined', async () => {
      repo.find.mockResolvedValueOnce([{ id: 'a', nombre: 'A' } as Finca]);
      cuartelesService.contarActivosPorFinca.mockResolvedValueOnce(new Map());

      const [resultado] = await service.findAll(EMPRESA_ID);

      expect(resultado.cuartelesActivos).toBe(0);
    });
  });

  describe('findById', () => {
    it('tira 404 si la finca no existe en esa empresa', async () => {
      repo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.findById(FINCA_ID, EMPRESA_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('no deja leer una finca de otra empresa aunque el id sea válido', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: FINCA_ID,
        empresaId: OTRA_EMPRESA_ID,
      });

      await service.findById(FINCA_ID, OTRA_EMPRESA_ID);

      const [{ where }] = repo.findOne.mock.calls[0] as [
        { where: { id: string; empresaId: string } },
      ];
      expect(where.empresaId).toBe(OTRA_EMPRESA_ID);
    });
  });

  describe('desactivar (HU-08)', () => {
    it('bloquea la baja con 409 si la finca tiene cuarteles activos', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: FINCA_ID,
        empresaId: EMPRESA_ID,
        activa: true,
      });
      cuartelesService.contarActivos.mockResolvedValueOnce(2);

      await expect(
        service.desactivar(FINCA_ID, EMPRESA_ID),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('da de baja la finca cuando no le quedan cuarteles activos', async () => {
      const finca = {
        id: FINCA_ID,
        empresaId: EMPRESA_ID,
        activa: true,
      } as Finca;
      repo.findOne.mockResolvedValueOnce(finca);
      cuartelesService.contarActivos.mockResolvedValueOnce(0);

      const resultado = await service.desactivar(FINCA_ID, EMPRESA_ID);

      expect(resultado.activa).toBe(false);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ activa: false }),
      );
    });
  });

  describe('polígono (HU-08)', () => {
    const poligono = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [-68.9, -33.0],
          [-68.89, -33.0],
          [-68.89, -33.01],
          [-68.9, -33.01],
          [-68.9, -33.0],
        ],
      ],
    };

    it('al crear, lo derivado del polígono pisa las hectáreas y el punto del pedido', async () => {
      geoService.derivar.mockResolvedValueOnce({
        hectareas: 103.64,
        latitud: -33.005,
        longitud: -68.895,
      });

      await service.create(
        { nombre: 'La Esperanza', hectareas: 999, poligono },
        'user-1',
        EMPRESA_ID,
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          hectareas: 103.64,
          latitud: -33.005,
          poligono,
          empresaId: EMPRESA_ID,
        }),
      );
    });

    it('al editar sin tocar el polígono, no consulta si hay cuarteles afuera', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: FINCA_ID,
        empresaId: EMPRESA_ID,
      });

      await service.update(FINCA_ID, { nombre: 'Otra' }, EMPRESA_ID);

      expect(
        geoService.advertenciaCuartelesFueraDelContorno,
      ).not.toHaveBeenCalled();
    });

    it('al cambiar el contorno, adjunta la advertencia si algún cuartel queda afuera', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: FINCA_ID,
        empresaId: EMPRESA_ID,
      });
      geoService.advertenciaCuartelesFueraDelContorno.mockResolvedValueOnce(
        'Un cuartel con polígono queda fuera del nuevo contorno de la finca: C1.',
      );

      const resultado = await service.update(
        FINCA_ID,
        { poligono },
        EMPRESA_ID,
      );

      expect(resultado.advertencias).toEqual([
        'Un cuartel con polígono queda fuera del nuevo contorno de la finca: C1.',
      ]);
      expect(repo.save).toHaveBeenCalled(); // advertir no impide guardar
    });

    it('si no hay nada que advertir, la respuesta no trae el campo `advertencias`', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: FINCA_ID,
        empresaId: EMPRESA_ID,
      });

      const resultado = await service.update(
        FINCA_ID,
        { poligono },
        EMPRESA_ID,
      );

      expect(resultado).not.toHaveProperty('advertencias');
    });

    it('si el polígono es inválido, no guarda nada', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: FINCA_ID,
        empresaId: EMPRESA_ID,
      });
      geoService.derivar.mockRejectedValueOnce(new Error('polígono inválido'));

      await expect(
        service.update(FINCA_ID, { poligono }, EMPRESA_ID),
      ).rejects.toThrow('polígono inválido');
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
