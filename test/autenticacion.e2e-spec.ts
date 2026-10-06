/**
 * Autenticación (HU-01 a HU-04) y sesiones con refresh token (D-023) contra
 * PostgreSQL real.
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
        familiaId: null,
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
        familiaId: null,
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

  describe('sesiones con refresh token (D-023)', () => {
    const familiaDe = (accessToken: string) =>
      jwt.verify<{ fam: string; jti: string; exp: number; iat: number }>(
        accessToken,
      );

    const refreshEnBase = async (familia: string) =>
      dataSource.query<
        {
          token_hash: string;
          revocado_at: Date | null;
          reemplazado_por_id: string | null;
        }[]
      >(
        'SELECT token_hash, revocado_at, reemplazado_por_id FROM refresh_token WHERE familia_id = $1 ORDER BY created_at',
        [familia],
      );

    it('el login entrega un refresh token opaco que no se guarda en claro', async () => {
      const sesion = await entrar();

      expect(sesion.refreshToken).toMatch(/^[\w-]{43}$/);
      expect(sesion.expiresIn).toBe(15 * 60);
      expect(new Date(sesion.refreshExpiresAt).getTime()).toBeGreaterThan(
        Date.now() + 6 * 24 * 3600 * 1000,
      );

      const filas = await refreshEnBase(familiaDe(sesion.accessToken).fam);
      expect(filas).toHaveLength(1);
      expect(filas[0].token_hash).not.toBe(sesion.refreshToken);
      expect(filas[0].token_hash).toHaveLength(64);
    });

    it('renovar rota el token: el viejo queda revocado y enlazado al nuevo', async () => {
      const sesion = await entrar();
      const renovada = await auth.refresh(sesion.refreshToken);

      expect(renovada.refreshToken).not.toBe(sesion.refreshToken);
      expect(familiaDe(renovada.accessToken).fam).toBe(
        familiaDe(sesion.accessToken).fam,
      );

      const filas = await refreshEnBase(familiaDe(sesion.accessToken).fam);
      expect(filas).toHaveLength(2);
      expect(filas[0].revocado_at).not.toBeNull();
      expect(filas[0].reemplazado_por_id).not.toBeNull();
      expect(filas[1].revocado_at).toBeNull();
    });

    it('reusar un token rotado dentro de la gracia falla sin cortar la sesión', async () => {
      const sesion = await entrar();
      const renovada = await auth.refresh(sesion.refreshToken);

      await expect(auth.refresh(sesion.refreshToken)).rejects.toThrow(
        /ya no es válida/,
      );
      // La sesión legítima sigue: dos pestañas renovando a la vez no se castigan.
      await expect(auth.refresh(renovada.refreshToken)).resolves.toBeDefined();
    });

    it('reusar un token rotado fuera de la gracia revoca la familia completa', async () => {
      const sesion = await entrar();
      const renovada = await auth.refresh(sesion.refreshToken);
      // Se simula que la rotación ocurrió hace un minuto.
      await dataSource.query(
        `UPDATE refresh_token SET revocado_at = now() - interval '1 minute'
          WHERE familia_id = $1 AND reemplazado_por_id IS NOT NULL`,
        [familiaDe(sesion.accessToken).fam],
      );

      await expect(auth.refresh(sesion.refreshToken)).rejects.toThrow();
      // El token vigente también murió: alguien más tenía una copia.
      await expect(auth.refresh(renovada.refreshToken)).rejects.toThrow();
    });

    it('un token inventado o vencido no renueva', async () => {
      await expect(auth.refresh('x'.repeat(43))).rejects.toThrow(
        'Sesión inválida',
      );

      const sesion = await entrar();
      await dataSource.query(
        `UPDATE refresh_token SET expires_at = now() - interval '1 second' WHERE familia_id = $1`,
        [familiaDe(sesion.accessToken).fam],
      );
      await expect(auth.refresh(sesion.refreshToken)).rejects.toThrow(/expiró/);
    });

    it('un usuario desactivado no renueva', async () => {
      const sesion = await entrar();
      await dataSource.query(
        'UPDATE usuarios SET activo = false WHERE id = $1',
        [usuario.id],
      );
      await expect(auth.refresh(sesion.refreshToken)).rejects.toThrow(
        /inactivo/,
      );
    });

    it('el logout corta también el refresh token', async () => {
      const sesion = await entrar();
      const payload = familiaDe(sesion.accessToken);

      await auth.logout({
        id: usuario.id,
        jti: payload.jti,
        expiraEn: new Date(payload.exp * 1000),
        familiaId: payload.fam,
      });

      await expect(auth.refresh(sesion.refreshToken)).rejects.toThrow();
    });

    it('cambiar la contraseña cierra las otras sesiones y conserva la actual', async () => {
      const actual = await entrar();
      const otra = await entrar();

      await auth.changePassword(
        usuario.id,
        PASSWORD_DE_PRUEBA,
        'NuevaClave456!',
        familiaDe(actual.accessToken).fam,
      );

      await expect(auth.refresh(otra.refreshToken)).rejects.toThrow();
      await expect(auth.refresh(actual.refreshToken)).resolves.toBeDefined();
    });

    it('restablecer la contraseña cierra todas las sesiones', async () => {
      const sesion = await entrar();
      const token = await auth.forgotPassword(usuario.email);

      await auth.resetPassword(token as string, 'NuevaClave456!');

      await expect(auth.refresh(sesion.refreshToken)).rejects.toThrow();
    });

    it('usa las duraciones configuradas por la empresa', async () => {
      const empresa = await dataSource.query<{ empresa_id: string }[]>(
        'SELECT empresa_id FROM usuarios WHERE id = $1',
        [usuario.id],
      );
      const empresaId = empresa[0].empresa_id;
      // La empresa es la del seed y la comparten otros archivos que corren en
      // paralelo: solo se toca dentro de este test y se restaura al final.
      const previas = await dataSource.query<
        { clave: string; valor: string }[]
      >(
        `SELECT clave, valor FROM configuracion WHERE empresa_id = $1 AND clave LIKE 'sesion_%'`,
        [empresaId],
      );
      await dataSource.query(
        `DELETE FROM configuracion WHERE empresa_id = $1 AND clave LIKE 'sesion_%'`,
        [empresaId],
      );
      await dataSource.query(
        `INSERT INTO configuracion (clave, valor, empresa_id)
         VALUES ('sesion_access_minutos', '30', $1), ('sesion_refresh_dias', '2', $1)`,
        [empresaId],
      );
      try {
        const sesion = await entrar();
        const payload = familiaDe(sesion.accessToken);

        expect(sesion.expiresIn).toBe(30 * 60);
        expect(payload.exp - payload.iat).toBe(30 * 60);
        const dias =
          (new Date(sesion.refreshExpiresAt).getTime() - Date.now()) /
          (24 * 3600 * 1000);
        expect(dias).toBeCloseTo(2, 1);
      } finally {
        await dataSource.query(
          `DELETE FROM configuracion WHERE empresa_id = $1 AND clave LIKE 'sesion_%'`,
          [empresaId],
        );
        for (const p of previas) {
          await dataSource.query(
            'INSERT INTO configuracion (clave, valor, empresa_id) VALUES ($1, $2, $3)',
            [p.clave, p.valor, empresaId],
          );
        }
      }
    });
  });

  describe('permisos (D-024)', () => {
    it('el login devuelve los permisos del rol', async () => {
      const sesion = await entrar();
      expect(sesion.user.permisos).toContain('usuarios');
      expect(sesion.user.permisos).toContain('appMovil');
    });

    it('el Auditor no puede iniciar sesión desde la app móvil, pero sí desde la web', async () => {
      const auditor = await crearUsuario(
        dataSource,
        'auditor-movil',
        'Auditor',
      );
      try {
        await expect(
          auth.login({
            email: auditor.email,
            password: PASSWORD_DE_PRUEBA,
            cliente: 'movil',
          }),
        ).rejects.toThrow(/app móvil/);

        const web = await auth.login({
          email: auditor.email,
          password: PASSWORD_DE_PRUEBA,
          cliente: 'web',
        });
        expect(web.user.permisos).toContain('logAuditoria');
        expect(web.user.permisos).not.toContain('appMovil');
      } finally {
        await limpiarUsuario(dataSource, auditor);
      }
    });

    it('el Capataz entra a la app móvil', async () => {
      const capataz = await crearUsuario(
        dataSource,
        'capataz-movil',
        'Capataz',
      );
      try {
        const sesion = await auth.login({
          email: capataz.email,
          password: PASSWORD_DE_PRUEBA,
          cliente: 'movil',
        });
        expect(sesion.user.permisos).toEqual(
          expect.arrayContaining([
            'laboresRegistro',
            'pesajesRegistro',
            'appMovil',
          ]),
        );
      } finally {
        await limpiarUsuario(dataSource, capataz);
      }
    });

    it('con la contraseña incorrecta no revela que el rol no tiene acceso móvil', async () => {
      const auditor = await crearUsuario(dataSource, 'auditor-mal', 'Auditor');
      try {
        await expect(
          auth.login({
            email: auditor.email,
            password: 'Incorrecta123!',
            cliente: 'movil',
          }),
        ).rejects.toThrow('Email o contraseña incorrectos');
      } finally {
        await limpiarUsuario(dataSource, auditor);
      }
    });
  });
});
