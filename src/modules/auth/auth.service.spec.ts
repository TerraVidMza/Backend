import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { TokenRecuperacionService } from '../token-recuperacion/token-recuperacion.service';
import { LogAuditoriaService } from '../log-auditoria/log-auditoria.service';
import { MailService } from '../../common/mail/mail.service';
import { TokenRevocadoService } from './token-revocado.service';

describe('AuthService', () => {
  let service: AuthService;
  let usuariosService: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    setPasswordHash: jest.Mock;
  };
  let tokenRecuperacionService: {
    generar: jest.Mock;
    validarYConsumir: jest.Mock;
  };
  let logAuditoriaService: { registrar: jest.Mock };
  let mailService: { enviar: jest.Mock };
  let tokenRevocadoService: { revocar: jest.Mock };
  let refreshTokenService: {
    emitir: jest.Mock;
    revocarFamilia: jest.Mock;
    revocarDeUsuario: jest.Mock;
  };

  beforeEach(async () => {
    usuariosService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      setPasswordHash: jest.fn(),
    };
    tokenRecuperacionService = {
      generar: jest.fn(() => Promise.resolve('token-generado')),
      validarYConsumir: jest.fn(),
    };
    logAuditoriaService = { registrar: jest.fn(() => Promise.resolve()) };
    mailService = { enviar: jest.fn(() => Promise.resolve(true)) };
    tokenRevocadoService = { revocar: jest.fn(() => Promise.resolve()) };
    refreshTokenService = {
      emitir: jest.fn(() =>
        Promise.resolve({
          id: 'rt-1',
          token: 'refresh-opaco',
          familiaId: 'fam-1',
          expiraEn: new Date('2026-01-08T00:00:00.000Z'),
        }),
      ),
      revocarFamilia: jest.fn(() => Promise.resolve()),
      revocarDeUsuario: jest.fn(() => Promise.resolve()),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsuariosService, useValue: usuariosService },
        {
          provide: TokenRecuperacionService,
          useValue: tokenRecuperacionService,
        },
        { provide: LogAuditoriaService, useValue: logAuditoriaService },
        {
          provide: JwtService,
          useValue: { sign: jest.fn(() => 'jwt-firmado') },
        },
        { provide: MailService, useValue: mailService },
        { provide: TokenRevocadoService, useValue: tokenRevocadoService },
        { provide: RefreshTokenService, useValue: refreshTokenService },
        {
          provide: ConfiguracionService,
          useValue: {
            getDuracionesSesion: jest.fn(() =>
              Promise.resolve({ accessMinutos: 15, refreshDias: 7 }),
            ),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('logout (HU-02)', () => {
    it('revoca el jti del token con la fecha de expiración informada', async () => {
      const expiraEn = new Date('2026-01-01T00:00:00.000Z');
      await service.logout({ id: 'user-1', jti: 'jti-1', expiraEn });

      expect(tokenRevocadoService.revocar).toHaveBeenCalledWith(
        'jti-1',
        'user-1',
        expiraEn,
      );
    });

    it('registra LOGOUT en la auditoría', async () => {
      await service.logout({
        id: 'user-1',
        jti: 'jti-1',
        expiraEn: new Date(),
      });

      expect(logAuditoriaService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 'user-1', accion: 'LOGOUT' }),
      );
    });

    it('sin jti no intenta revocar nada, pero igual audita', async () => {
      await service.logout({ id: 'user-1', jti: '', expiraEn: null });

      expect(tokenRevocadoService.revocar).not.toHaveBeenCalled();
      expect(logAuditoriaService.registrar).toHaveBeenCalled();
    });
  });

  describe('forgotPassword (HU-03)', () => {
    it('no revela si el email existe: devuelve null en silencio', async () => {
      usuariosService.findByEmail.mockResolvedValueOnce(null);

      await expect(service.forgotPassword('nadie@x.com')).resolves.toBeNull();
      expect(mailService.enviar).not.toHaveBeenCalled();
    });

    it('genera el token, lo manda por mail y no lo devuelve en producción', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      usuariosService.findByEmail.mockResolvedValueOnce({
        id: 'user-1',
        email: 'paula@x.com',
        nombre: 'Paula',
        empresaId: 'empresa-1',
      });

      const resultado = await service.forgotPassword('paula@x.com');

      expect(tokenRecuperacionService.generar).toHaveBeenCalledWith('user-1');
      expect(mailService.enviar).toHaveBeenCalled();
      expect(resultado).toBeNull();

      process.env.NODE_ENV = originalEnv;
    });

    it('fuera de producción devuelve el token, para poder probar sin SMTP', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      usuariosService.findByEmail.mockResolvedValueOnce({
        id: 'user-1',
        email: 'paula@x.com',
        nombre: 'Paula',
        empresaId: 'empresa-1',
      });

      await expect(service.forgotPassword('paula@x.com')).resolves.toBe(
        'token-generado',
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('resetPassword (HU-03)', () => {
    it('rechaza un token vencido o ya usado', async () => {
      tokenRecuperacionService.validarYConsumir.mockResolvedValueOnce(null);

      await expect(
        service.resetPassword('token-invalido', 'NuevaPass123!'),
      ).rejects.toThrow('El enlace expiró o ya fue utilizado');
    });

    it('con un token válido, fija el hash nuevo y audita RESET_PASSWORD', async () => {
      tokenRecuperacionService.validarYConsumir.mockResolvedValueOnce('user-1');

      await service.resetPassword('token-valido', 'NuevaPass123!');

      expect(usuariosService.setPasswordHash).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
      );
      expect(logAuditoriaService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'user-1',
          accion: 'RESET_PASSWORD',
        }),
      );
    });
  });

  describe('login', () => {
    it('rechaza credenciales de un email que no existe sin filtrar el motivo', async () => {
      usuariosService.findByEmail.mockResolvedValueOnce(null);

      await expect(
        service.login({ email: 'nadie@x.com', password: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rechaza una cuenta desactivada, incluso con password correcta', async () => {
      const hash = await bcrypt.hash('CorrectaPass1!', 4);
      usuariosService.findByEmail.mockResolvedValueOnce({
        id: 'user-1',
        email: 'x@x.com',
        passwordHash: hash,
        activo: false,
        bloqueadoHasta: null,
        rol: { nombreRol: 'PROPIETARIO' },
        empresaId: 'empresa-1',
      });

      await expect(
        service.login({ email: 'x@x.com', password: 'CorrectaPass1!' }),
      ).rejects.toThrow('Tu cuenta está desactivada');
    });
  });

  describe('sesiones (D-023)', () => {
    it('el logout revoca la familia del refresh token', async () => {
      await service.logout({
        id: 'user-1',
        jti: 'jti-1',
        expiraEn: null,
        familiaId: 'fam-1',
      });
      expect(refreshTokenService.revocarFamilia).toHaveBeenCalledWith('fam-1');
    });

    it('un token sin familia (emitido antes de D-023) no intenta revocarla', async () => {
      await service.logout({ id: 'user-1', jti: 'jti-1', expiraEn: null });
      expect(refreshTokenService.revocarFamilia).not.toHaveBeenCalled();
    });
  });
});
