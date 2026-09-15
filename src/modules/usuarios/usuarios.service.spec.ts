import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { UsuariosService } from './usuarios.service';
import { Usuario } from './entities/usuario.entity';
import { UsuarioFinca } from './entities/usuario-finca.entity';
import { Finca } from '../fincas/entities/finca.entity';
import { Rol } from '../roles/entities/rol.entity';
import { TokenRecuperacionService } from '../token-recuperacion/token-recuperacion.service';
import { MailService } from '../../common/mail/mail.service';

const EMPRESA_ID = '11111111-1111-1111-1111-111111111111';

describe('UsuariosService', () => {
  let service: UsuariosService;
  let usuarioRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let rolRepo: { findOne: jest.Mock };
  let mailService: { enviar: jest.Mock };

  beforeEach(async () => {
    // `create()` ahora relee con `findById` tras el `save()` (para traer la
    // relación `rol`, ver el fix del bug de Zod en el Web): el mock de
    // `findOne` tiene que devolver lo último guardado, no siempre `null`.
    let ultimoGuardado: Partial<Usuario> | null = null;
    usuarioRepo = {
      findOne: jest.fn(() => Promise.resolve(ultimoGuardado)),
      create: jest.fn((dto: Partial<Usuario>) => dto),
      save: jest.fn((usuario: Partial<Usuario>) => {
        ultimoGuardado = usuario;
        return Promise.resolve(usuario);
      }),
      update: jest.fn(() => Promise.resolve()),
    };
    rolRepo = { findOne: jest.fn() };
    mailService = { enviar: jest.fn(() => Promise.resolve(true)) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: getRepositoryToken(Usuario), useValue: usuarioRepo },
        {
          provide: getRepositoryToken(UsuarioFinca),
          useValue: { find: jest.fn(), delete: jest.fn(), insert: jest.fn() },
        },
        { provide: getRepositoryToken(Finca), useValue: { count: jest.fn() } },
        { provide: getRepositoryToken(Rol), useValue: rolRepo },
        {
          provide: TokenRecuperacionService,
          useValue: { generar: jest.fn(() => Promise.resolve('token-x')) },
        },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = moduleRef.get(UsuariosService);
  });

  describe('create (HU-05)', () => {
    it('rechaza el alta si ya existe un usuario con ese email', async () => {
      usuarioRepo.findOne.mockResolvedValueOnce({ id: 'existente' });

      await expect(
        service.create(
          {
            nombre: 'Paula',
            email: 'paula@x.com',
            rolId: 'rol-1',
          },
          EMPRESA_ID,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('sin password, marca al usuario como debeCambiarPassword y manda el mail de bienvenida', async () => {
      const usuario = await service.create(
        { nombre: 'Paula', email: 'nueva@x.com', rolId: 'rol-1' },
        EMPRESA_ID,
      );

      expect(usuario.debeCambiarPassword).toBe(true);
      expect(mailService.enviar).toHaveBeenCalled();
    });

    it('con password explícita, no la marca como temporal ni manda bienvenida', async () => {
      const usuario = await service.create(
        {
          nombre: 'Paula',
          email: 'nueva@x.com',
          rolId: 'rol-1',
          password: 'UnaPassSegura1!',
        },
        EMPRESA_ID,
      );

      expect(usuario.debeCambiarPassword).toBe(false);
      expect(mailService.enviar).not.toHaveBeenCalled();
    });
  });

  describe('update (HU-06)', () => {
    it('no deja que un usuario se cambie el rol a sí mismo', async () => {
      usuarioRepo.findOne.mockResolvedValueOnce({
        id: 'user-1',
        empresaId: EMPRESA_ID,
        rolId: 'rol-viejo',
      });

      await expect(
        service.update(
          'user-1',
          { rolId: 'rol-nuevo' },
          {
            id: 'user-1',
            empresaId: EMPRESA_ID,
          },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rechaza un rolId que no existe en la lista de roles asignables', async () => {
      usuarioRepo.findOne.mockResolvedValueOnce({
        id: 'user-2',
        empresaId: EMPRESA_ID,
        rolId: 'rol-viejo',
      });
      rolRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.update(
          'user-2',
          { rolId: 'rol-inexistente' },
          {
            id: 'user-1',
            empresaId: EMPRESA_ID,
          },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('otro usuario sí puede cambiarle el rol a uno válido', async () => {
      usuarioRepo.findOne.mockResolvedValueOnce({
        id: 'user-2',
        empresaId: EMPRESA_ID,
        rolId: 'rol-viejo',
      });
      rolRepo.findOne.mockResolvedValueOnce({
        id: 'rol-nuevo',
        nombreRol: 'Agronomo',
      });

      const resultado = await service.update(
        'user-2',
        { rolId: 'rol-nuevo' },
        { id: 'user-1', empresaId: EMPRESA_ID },
      );

      expect(resultado.rolId).toBe('rol-nuevo');
    });

    it('tira 404 si el usuario a editar no existe en la empresa del actor', async () => {
      usuarioRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.update(
          'inexistente',
          { nombre: 'X' },
          {
            id: 'user-1',
            empresaId: EMPRESA_ID,
          },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
