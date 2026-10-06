import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { CuartelesService } from './cuarteles.service';
import { Cuartel } from './entities/cuartel.entity';
import { RegistroLabor } from '../registro-labor/entities/registro-labor.entity';
import { PesajeVendimia } from '../pesaje-vendimia/entities/pesaje-vendimia.entity';
import { CatalogoItem } from '../catalogo-item/entities/catalogo-item.entity';
import { CampaniasService } from '../campanias/campanias.service';

const EMPRESA_ID = '11111111-1111-1111-1111-111111111111';
const CUARTEL_ID = '22222222-2222-2222-2222-222222222222';

describe('CuartelesService', () => {
  let service: CuartelesService;
  let cuartelRepo: {
    findOne: jest.Mock;
    findAndCount: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let laborRepo: { count: jest.Mock };
  let pesajeRepo: { count: jest.Mock };
  let campaniasService: { getActual: jest.Mock };

  beforeEach(async () => {
    cuartelRepo = {
      findOne: jest.fn(() => Promise.resolve(null)),
      findAndCount: jest.fn(() => Promise.resolve([[], 0])),
      create: jest.fn((dto: Partial<Cuartel>) => dto),
      save: jest.fn((cuartel: Partial<Cuartel>) => Promise.resolve(cuartel)),
    };
    laborRepo = { count: jest.fn(() => Promise.resolve(0)) };
    pesajeRepo = { count: jest.fn(() => Promise.resolve(0)) };
    campaniasService = { getActual: jest.fn(() => Promise.resolve(null)) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CuartelesService,
        { provide: getRepositoryToken(Cuartel), useValue: cuartelRepo },
        { provide: getRepositoryToken(RegistroLabor), useValue: laborRepo },
        { provide: getRepositoryToken(PesajeVendimia), useValue: pesajeRepo },
        { provide: getRepositoryToken(CatalogoItem), useValue: {} },
        { provide: CampaniasService, useValue: campaniasService },
      ],
    }).compile();

    service = moduleRef.get(CuartelesService);
  });

  describe('buscar (HU-11)', () => {
    it('acota siempre a la empresa vía finca.empresaId', async () => {
      await service.buscar(EMPRESA_ID);

      const [{ where }] = cuartelRepo.findAndCount.mock.calls[0] as [
        { where: { finca: { empresaId: string } } },
      ];
      expect(where.finca.empresaId).toBe(EMPRESA_ID);
    });

    it('por defecto solo trae cuarteles activos', async () => {
      await service.buscar(EMPRESA_ID);

      const [{ where }] = cuartelRepo.findAndCount.mock.calls[0] as [
        { where: { activo: boolean } },
      ];
      expect(where.activo).toBe(true);
    });

    it('un fincaId de otra empresa no filtra por fuera del tenant: va dentro del mismo where', async () => {
      await service.buscar(EMPRESA_ID, { fincaId: 'finca-ajena' });

      const [{ where }] = cuartelRepo.findAndCount.mock.calls[0] as [
        { where: { finca: { empresaId: string; id?: string } } },
      ];
      expect(where.finca).toEqual({ empresaId: EMPRESA_ID, id: 'finca-ajena' });
    });
  });

  describe('desactivar (HU-09)', () => {
    it('bloquea la baja si el cuartel tiene labores en la campaña actual', async () => {
      cuartelRepo.findOne.mockResolvedValueOnce({
        id: CUARTEL_ID,
        activo: true,
      });
      laborRepo.count.mockResolvedValueOnce(3);

      await expect(
        service.desactivar(CUARTEL_ID, EMPRESA_ID),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(cuartelRepo.save).not.toHaveBeenCalled();
    });

    it('bloquea la baja si tiene pesajes, aunque no tenga labores', async () => {
      cuartelRepo.findOne.mockResolvedValueOnce({
        id: CUARTEL_ID,
        activo: true,
      });
      laborRepo.count.mockResolvedValueOnce(0);
      pesajeRepo.count.mockResolvedValueOnce(1);

      await expect(
        service.desactivar(CUARTEL_ID, EMPRESA_ID),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('da de baja el cuartel si no tiene labores ni pesajes', async () => {
      cuartelRepo.findOne.mockResolvedValueOnce({
        id: CUARTEL_ID,
        activo: true,
      });

      const resultado = await service.desactivar(CUARTEL_ID, EMPRESA_ID);

      expect(resultado.activo).toBe(false);
    });

    it('tira 404 si el cuartel no existe', async () => {
      cuartelRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.desactivar('inexistente', EMPRESA_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('contarActivosPorFinca (HU-08/09)', () => {
    it('con una lista vacía de fincas no consulta la base', async () => {
      const resultado = await service.contarActivosPorFinca([]);

      expect(resultado.size).toBe(0);
    });
  });
});
