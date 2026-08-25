import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { UsuariosService } from './usuarios.service';
import { Usuario } from './entities/usuario.entity';
import { UsuarioFinca } from './entities/usuario-finca.entity';
import { Finca } from '../fincas/entities/finca.entity';
import { Rol } from '../roles/entities/rol.entity';
import { TokenRecuperacionService } from '../token-recuperacion/token-recuperacion.service';
import { MailService } from '../../common/mail/mail.service';

const USUARIO_ID = '11111111-1111-1111-1111-111111111111';
const MINUTO = 60_000;

/**
 * Bloqueo por intentos fallidos y su expiración (HU-01, F1-11).
 *
 * El bug que cierra F1-11 solo se ve al **encadenar** un bloqueo vencido con un
 * fallo posterior: el contador no se reseteaba, así que pasados los 15 minutos
 * el siguiente fallo evaluaba `6 >= 5` y volvía a bloquear. La cuenta quedaba
 * inutilizable hasta un login exitoso, que es justo lo que no se podía hacer.
 */
describe('UsuariosService.registrarIntentoFallido', () => {
  let service: UsuariosService;
  let actualizaciones: Array<{
    intentosFallidos: number;
    bloqueadoHasta: Date | null;
  }>;

  const usuarioCon = (
    intentosFallidos: number,
    bloqueadoHasta: Date | null,
  ): Usuario =>
    ({ id: USUARIO_ID, intentosFallidos, bloqueadoHasta }) as Usuario;

  beforeEach(async () => {
    actualizaciones = [];
    const usuarioRepo = {
      update: jest.fn(
        (_id: string, datos: (typeof actualizaciones)[number]) => {
          actualizaciones.push(datos);
          return Promise.resolve({ affected: 1 });
        },
      ),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: getRepositoryToken(Usuario), useValue: usuarioRepo },
        { provide: getRepositoryToken(UsuarioFinca), useValue: {} },
        { provide: getRepositoryToken(Finca), useValue: {} },
        { provide: getRepositoryToken(Rol), useValue: {} },
        { provide: TokenRecuperacionService, useValue: {} },
        { provide: MailService, useValue: { enviar: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(UsuariosService);
  });

  const ultima = () => actualizaciones[actualizaciones.length - 1];

  it('suma intentos sin bloquear mientras no llegue al máximo', async () => {
    await service.registrarIntentoFallido(usuarioCon(0, null));
    expect(ultima()).toEqual({ intentosFallidos: 1, bloqueadoHasta: null });

    await service.registrarIntentoFallido(usuarioCon(3, null));
    expect(ultima()).toEqual({ intentosFallidos: 4, bloqueadoHasta: null });
  });

  it('bloquea al alcanzar el quinto intento', async () => {
    await service.registrarIntentoFallido(usuarioCon(4, null));
    expect(ultima().intentosFallidos).toBe(5);
    expect(ultima().bloqueadoHasta).toBeInstanceOf(Date);
  });

  it('la ventana de bloqueo dura 15 minutos', async () => {
    const antes = Date.now();
    await service.registrarIntentoFallido(usuarioCon(4, null));
    const hasta = ultima().bloqueadoHasta!.getTime();
    expect(hasta - antes).toBeGreaterThanOrEqual(14 * MINUTO);
    expect(hasta - antes).toBeLessThanOrEqual(16 * MINUTO);
  });

  /**
   * El caso de F1-11: con el bloqueo ya vencido, el contador arranca de cero en
   * vez de seguir desde 5. Sin esto la cuenta quedaba bloqueada para siempre.
   */
  it('al vencer la ventana el contador se reinicia y NO vuelve a bloquear', async () => {
    const vencido = new Date(Date.now() - MINUTO);
    await service.registrarIntentoFallido(usuarioCon(5, vencido));

    expect(ultima().intentosFallidos).toBe(1);
    expect(ultima().bloqueadoHasta).toBeNull();
  });

  it('un bloqueo todavía vigente sigue acumulando, no se reinicia', async () => {
    const vigente = new Date(Date.now() + 5 * MINUTO);
    await service.registrarIntentoFallido(usuarioCon(5, vigente));

    expect(ultima().intentosFallidos).toBe(6);
    expect(ultima().bloqueadoHasta).toBeInstanceOf(Date);
  });

  it('tras el reinicio hacen falta otros 5 fallos para volver a bloquear', async () => {
    const vencido = new Date(Date.now() - MINUTO);
    // Primer fallo después del desbloqueo: reinicia a 1.
    await service.registrarIntentoFallido(usuarioCon(5, vencido));
    expect(ultima().bloqueadoHasta).toBeNull();

    // Del 2° al 4° sigue sin bloquear.
    for (const intentos of [1, 2, 3]) {
      await service.registrarIntentoFallido(usuarioCon(intentos, null));
      expect(ultima().bloqueadoHasta).toBeNull();
    }

    // El quinto sí.
    await service.registrarIntentoFallido(usuarioCon(4, null));
    expect(ultima().bloqueadoHasta).toBeInstanceOf(Date);
  });
});
