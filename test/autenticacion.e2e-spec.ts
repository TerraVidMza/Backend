/**
 * Autenticación (HU-01 a HU-04) contra PostgreSQL real.
 *
 * `auth.service.ts` son 245 líneas sin un solo test. Lo que se verifica acá no
 * es que bcrypt compare —eso lo prueba bcrypt— sino las decisiones de seguridad
 * que el servicio toma alrededor: qué se le cuenta a quien no tiene
 * credenciales, cuándo se bloquea una cuenta, y si cerrar sesión invalida algo
 * de verdad.
 *
 * Contra la base real porque el bloqueo, la revocación y los tokens de
 * recuperación **son estado persistido**: un mock del repositorio devolvería el
 * contador que el test le ponga, que es justo lo que hay que comprobar.
 *
 * Cada archivo trabaja con un usuario propio y no con el del seed: estos tests
 * bloquean cuentas y les cambian la contraseña a propósito, y Jest corre los
 * archivos en paralelo.
 *
 *     docker compose up -d && npm run migration:run && npm run seed
 *     npm run test:e2e
 */
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { AuthService } from './../src/modules/auth/auth.service';
import {
  crearUsuario,
  limpiarUsuario,
  PASSWORD_DE_PRUEBA,
  UsuarioDePrueba,
} from './fixtures';

describe('Autenticación (integración)', () => {
  let modulo: TestingModule;
  let dataSource: DataSource;
  let auth: AuthService;
  let jwt: JwtService;
  let usuario: UsuarioDePrueba;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await modulo.init();
    dataSource = modulo.get(DataSource);
    auth = modulo.get(AuthService);
    jwt = modulo.get(JwtService);
  });

  afterAll(async () => {
    await modulo?.close();
  });

  beforeEach(async () => {
    usuario = await crearUsuario(dataSource, 'auth');
  });

  afterEach(async () => {
    await limpiarUsuario(dataSource, usuario);
  });

  // Sin anotar el tipo de retorno: `AuthService.login` ya lo declara, y
  // repetirlo acá solo crearía una segunda version que puede quedar desfasada.
  const entrar = (password = PASSWORD_DE_PRUEBA) =>
    auth.login({ email: usuario.email, password });

  const contadorDeFallos = async (): Promise<number> => {
    const filas = await dataSource.query<{ intentos_fallidos: number }[]>(
      'SELECT intentos_fallidos FROM usuarios WHERE id = $1',
      [usuario.id],
    );
    return filas[0].intentos_fallidos;
  };

  describe('login (HU-01)', () => {
    it('devuelve un token firmado, con el rol y la empresa adentro', async () => {
      const respuesta = await entrar();

      const payload = jwt.verify<{
        sub: string;
        rol: string;
        empresaId: string;
        jti: string;
      }>(respuesta.accessToken);

      expect(payload.sub).toBe(usuario.id);
      expect(payload.rol).toBe('Propietario');
      expect(payload.empresaId).toEqual(expect.any(String));
      // El `jti` es lo que hace revocable la sesión: sin él, el logout no
      // tendría qué anotar.
      expect(payload.jti).toEqual(expect.any(String));
    });

    it('no distingue entre email inexistente y contraseña incorrecta', async () => {
      // Si los mensajes difirieran, servirían para enumerar cuentas válidas.
      //
      // Se esperan de a una: creando las dos promesas antes de asertar, la
      // segunda queda rechazada sin handler el tiempo suficiente para que Jest
      // la cuente como unhandled rejection y falle el test por eso.
      await expect(
        auth.login({
          email: `no-existe-${Date.now()}@terravid.test`,
          password: PASSWORD_DE_PRUEBA,
        }),
      ).rejects.toThrow('Email o contraseña incorrectos');

      await expect(entrar('Incorrecta123!')).rejects.toThrow(
        'Email o contraseña incorrectos',
      );
    });

    it('un login exitoso deja el contador de fallos en cero', async () => {
      await entrar('Incorrecta123!').catch(() => undefined);
      expect(await contadorDeFallos()).toBe(1);

      await entrar();

      expect(await contadorDeFallos()).toBe(0);
    });

    it('a los cinco fallos la cuenta se bloquea, y el sexto intento no compara la contraseña', async () => {
      for (let i = 0; i < 5; i++) {
        await entrar('Incorrecta123!').catch(() => undefined);
      }

      // Con la contraseña **correcta**: si el bloqueo no se evaluara antes de
      // comparar, esto entraría y el bloqueo no serviría de nada.
      await expect(entrar()).rejects.toThrow(/bloqueada/i);

      const filas = await dataSource.query<{ bloqueado_hasta: Date | null }[]>(
        'SELECT bloqueado_hasta FROM usuarios WHERE id = $1',
        [usuario.id],
      );
      expect(filas[0].bloqueado_hasta).toBeTruthy();
    });

    it('una cuenta desactivada no entra, aun con la contraseña correcta', async () => {
      await dataSource.query(
        'UPDATE usuarios SET activo = false WHERE id = $1',
        [usuario.id],
      );

      await expect(entrar()).rejects.toThrow(/desactivada/i);
    });

    it('el mensaje de cuenta desactivada solo aparece con la contraseña correcta', async () => {
      // El orden importa: avisar "está desactivada" antes de validar la
      // contraseña le confirma a un atacante sin credenciales que la cuenta
      // existe.
      await dataSource.query(
        'UPDATE usuarios SET activo = false WHERE id = $1',
        [usuario.id],
      );

      await expect(entrar('Incorrecta123!')).rejects.toThrow(
        'Email o contraseña incorrectos',
      );
    });
  });

  describe('logout (HU-02)', () => {
    it('anota el token como revocado', async () => {
      const respuesta = await entrar();
      const payload = jwt.verify<{ jti: string; exp: number }>(
        respuesta.accessToken,
      );

      await auth.logout({
        id: usuario.id,
        jti: payload.jti,
        expiraEn: new Date(payload.exp * 1000),
      });

      const filas = await dataSource.query<{ n: number }[]>(
        'SELECT count(*)::int AS n FROM token_revocado WHERE jti = $1',
        [payload.jti],
      );
      // Sin esta fila, "cerrar sesión" no protegería contra un token ya robado:
      // el JWT seguiría siendo válido las ocho horas completas.
      expect(filas[0].n).toBe(1);
    });

    it('guarda el vencimiento, que es lo que permite purgarlo después', async () => {
      const respuesta = await entrar();
      const payload = jwt.verify<{ jti: string; exp: number }>(
        respuesta.accessToken,
      );

      await auth.logout({
        id: usuario.id,
        jti: payload.jti,
        expiraEn: new Date(payload.exp * 1000),
      });

      const filas = await dataSource.query<{ expires_at: Date }[]>(
        'SELECT expires_at FROM token_revocado WHERE jti = $1',
        [payload.jti],
      );
      expect(filas[0].expires_at.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('recuperación de contraseña (HU-03)', () => {
    it('el token no se guarda en claro', async () => {
      const token = await auth.forgotPassword(usuario.email);
      expect(token).toBeTruthy();

      const filas = await dataSource.query<{ token_hash: string }[]>(
        'SELECT token_hash FROM token_recuperacion WHERE usuario_id = $1',
        [usuario.id],
      );
      // Con el token en claro, cualquiera con lectura sobre la tabla podría
      // tomar una cuenta sin pasar por el correo.
      expect(filas[0].token_hash).not.toBe(token);
    });

    it('un email inexistente no revela que no existe', async () => {
      // Devuelve null en lugar de fallar: la respuesta del endpoint tiene que
      // ser la misma exista o no la cuenta.
      await expect(
        auth.forgotPassword(`no-existe-${Date.now()}@terravid.test`),
      ).resolves.toBeNull();
    });

    it('el token sirve una sola vez', async () => {
      const token = await auth.forgotPassword(usuario.email);
      const nueva = 'NuevaClave456!';

      await auth.resetPassword(token as string, nueva);
      await expect(
        auth.resetPassword(token as string, 'OtraMas789!'),
      ).rejects.toThrow();

      // Y la primera sí cambió la contraseña.
      await expect(entrar(nueva)).resolves.toBeDefined();
    });

    it('un token inventado no cambia nada', async () => {
      await expect(
        auth.resetPassword('token-que-nunca-existio', 'NuevaClave456!'),
      ).rejects.toThrow();

      await expect(entrar()).resolves.toBeDefined();
    });
  });

  describe('cambio de contraseña (HU-04)', () => {
    it('exige la contraseña actual', async () => {
      await expect(
        auth.changePassword(usuario.id, 'NoEsLaActual1!', 'NuevaClave456!'),
      ).rejects.toThrow(/actual/i);

      // Y la vieja sigue sirviendo.
      await expect(entrar()).resolves.toBeDefined();
    });

    it('con la actual correcta, la reemplaza', async () => {
      const nueva = 'NuevaClave456!';

      await auth.changePassword(usuario.id, PASSWORD_DE_PRUEBA, nueva);

      await expect(entrar(nueva)).resolves.toBeDefined();
      await expect(entrar()).rejects.toThrow();
    });
  });
});
