import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { TipoLaborService } from './tipo-labor.service';
import { CreateTipoLaborDto } from './dto/create-tipo-labor.dto';
import { TipoLabor } from './entities/tipo-labor.entity';
import { CostoLabor } from './entities/costo-labor.entity';

const EMPRESA_ID = '11111111-1111-1111-1111-111111111111';
const OTRA_EMPRESA_ID = '22222222-2222-2222-2222-222222222222';
const TIPO_LABOR_ID = '33333333-3333-3333-3333-333333333333';

describe('TipoLaborService (HU-16)', () => {
  let service: TipoLaborService;
  let tipoLaborRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let costoLaborRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    tipoLaborRepo = {
      find: jest.fn(() => Promise.resolve([])),
      findOne: jest.fn(() => Promise.resolve(null)),
      create: jest.fn((dto: Partial<TipoLabor>) => dto),
      save: jest.fn((entidad: Partial<TipoLabor>) =>
        Promise.resolve({ id: TIPO_LABOR_ID, ...entidad }),
      ),
    };
    costoLaborRepo = {
      create: jest.fn((dto: Partial<CostoLabor>) => dto),
      save: jest.fn((entidad: Partial<CostoLabor>) => Promise.resolve(entidad)),
      findOne: jest.fn(() => Promise.resolve(null)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TipoLaborService,
        { provide: getRepositoryToken(TipoLabor), useValue: tipoLaborRepo },
        { provide: getRepositoryToken(CostoLabor), useValue: costoLaborRepo },
      ],
    }).compile();

    service = moduleRef.get(TipoLaborService);
  });

  describe('findAll', () => {
    it('por defecto solo trae los tipos de labor activos de la empresa', async () => {
      await service.findAll(EMPRESA_ID);

      expect(tipoLaborRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { empresaId: EMPRESA_ID, activo: true },
        }),
      );
    });

    it('con soloActivos=false trae también los dados de baja', async () => {
      await service.findAll(EMPRESA_ID, false);

      expect(tipoLaborRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { empresaId: EMPRESA_ID } }),
      );
    });
  });

  describe('findById', () => {
    it('tira 404 para un tipo de labor de otra empresa (no 403)', async () => {
      tipoLaborRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.findById(TIPO_LABOR_ID, OTRA_EMPRESA_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    it('crea el tipo de labor y le da de alta el costo inicial vigente desde hoy', async () => {
      tipoLaborRepo.findOne.mockResolvedValueOnce({
        id: TIPO_LABOR_ID,
        empresaId: EMPRESA_ID,
      });

      await service.create(
        {
          nombre: 'Poda',
          unidadMedida: 'jornal',
          costoUnitarioInicial: 15000,
        } as CreateTipoLaborDto,
        'user-1',
        EMPRESA_ID,
      );

      expect(costoLaborRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoLaborId: TIPO_LABOR_ID,
          costoUnitario: 15000,
          createdById: 'user-1',
        }),
      );
    });
  });

  describe('desactivar', () => {
    it('da de baja el tipo de labor de la propia empresa', async () => {
      tipoLaborRepo.findOne.mockResolvedValueOnce({
        id: TIPO_LABOR_ID,
        empresaId: EMPRESA_ID,
        activo: true,
      });

      const resultado = await service.desactivar(TIPO_LABOR_ID, EMPRESA_ID);

      expect(resultado.activo).toBe(false);
    });
  });

  describe('getCostoVigente', () => {
    it('busca el costo con validFrom <= la fecha pedida, más reciente primero', async () => {
      await service.getCostoVigente(TIPO_LABOR_ID, '2026-03-10');

      const [{ where, order }] = costoLaborRepo.findOne.mock.calls[0] as [
        { where: { tipoLaborId: string }; order: unknown },
      ];
      expect(where.tipoLaborId).toBe(TIPO_LABOR_ID);
      expect(order).toEqual({ validFrom: 'DESC', createdAt: 'DESC' });
    });
  });
});
