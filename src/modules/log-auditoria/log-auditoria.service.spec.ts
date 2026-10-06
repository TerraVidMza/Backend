import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

import { LogAuditoriaService } from './log-auditoria.service';
import { LogAuditoria } from './entities/log-auditoria.entity';

const EMPRESA_ID = '11111111-1111-1111-1111-111111111111';

describe('LogAuditoriaService (HU-07)', () => {
  let service: LogAuditoriaService;
  let repo: { save: jest.Mock; create: jest.Mock; findAndCount: jest.Mock };

  beforeEach(async () => {
    repo = {
      save: jest.fn(() => Promise.resolve()),
      create: jest.fn((dto: unknown) => dto),
      findAndCount: jest.fn(() => Promise.resolve([[], 0])),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LogAuditoriaService,
        { provide: getRepositoryToken(LogAuditoria), useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(LogAuditoriaService);
  });

  describe('registrar', () => {
    it('no propaga el error si falla el guardado fuera de una transacción', async () => {
      repo.save.mockRejectedValueOnce(new Error('la base explotó'));

      await expect(
        service.registrar({
          actorId: 'user-1',
          accion: 'LOGIN',
          entidad: 'usuarios',
        }),
      ).resolves.toBeUndefined();
    });

    it('nunca guarda campos sensibles como password o tokens', async () => {
      await service.registrar({
        actorId: 'user-1',
        accion: 'UPDATE',
        entidad: 'usuarios',
        datosNuevos: {
          nombre: 'Paula',
          password: 'secreta',
          accessToken: 'jwt-secreto',
        },
      });

      const [guardado] = repo.create.mock.calls[0] as [
        { datosNuevos: Record<string, unknown> },
      ];
      expect(guardado.datosNuevos).toEqual({ nombre: 'Paula' });
    });

    it('usa el manager de la transacción cuando se lo pasan, en vez del repo propio', async () => {
      const manager = {
        create: jest.fn((_entity: unknown, dto: unknown) => dto),
        save: jest.fn(() => Promise.resolve()),
      };

      await service.registrar({
        actorId: 'user-1',
        accion: 'LOGIN',
        entidad: 'usuarios',
        manager: manager as unknown as EntityManager,
      });

      expect(manager.save).toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('acota siempre por la empresa del actor', async () => {
      await service.findAll(EMPRESA_ID);

      const [{ where }] = repo.findAndCount.mock.calls[0] as [
        { where: { actor: { empresaId: string } } },
      ];
      expect(where.actor.empresaId).toBe(EMPRESA_ID);
    });

    it('filtra por entidad cuando se pide', async () => {
      await service.findAll(EMPRESA_ID, { entidad: 'fincas' });

      const [{ where }] = repo.findAndCount.mock.calls[0] as [
        { where: { entidad?: string } },
      ];
      expect(where.entidad).toBe('fincas');
    });
  });
});
