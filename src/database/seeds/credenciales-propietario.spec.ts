import {
  credencialesDelPropietario,
  EMAIL_DEMO,
  PASSWORD_DEMO,
} from './credenciales-propietario';

/**
 * El seed se corre **en producción** (`docs/DESPLIEGUE.md`), y hasta ahora
 * creaba ahí un Propietario con la contraseña que está escrita en el README.
 * Es la única cuenta que puede crear las demás: era la llave del sistema,
 * publicada.
 *
 * Lo que se fija acá es que esa puerta no se pueda volver a abrir por descuido,
 * y que al mismo tiempo el camino de desarrollo siga siendo un comando sin
 * configuración previa.
 */
describe('credencialesDelPropietario', () => {
  const produccion = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
    NODE_ENV: 'production',
    ...extra,
  });

  describe('fuera de producción', () => {
    it('usa el usuario demo sin pedir configuración', () => {
      // Si esto dejara de andar, `npm run seed && npm run start:dev` pasaría a
      // necesitar un paso previo, y el smoke y los e2e se quedarían sin usuario.
      const credenciales = credencialesDelPropietario({
        NODE_ENV: 'development',
      });

      expect(credenciales).toEqual({
        email: EMAIL_DEMO,
        password: PASSWORD_DEMO,
        forzarCambio: false,
      });
    });

    it('sin NODE_ENV se comporta como desarrollo', () => {
      expect(credencialesDelPropietario({})).toMatchObject({
        password: PASSWORD_DEMO,
        forzarCambio: false,
      });
    });

    it('igual acepta credenciales propias si se las dan', () => {
      const credenciales = credencialesDelPropietario({
        NODE_ENV: 'development',
        SEED_PROPIETARIO_EMAIL: 'jefe@finca.test',
        SEED_PROPIETARIO_PASSWORD: 'OtraClave2026',
      });

      expect(credenciales.email).toBe('jefe@finca.test');
      expect(credenciales.password).toBe('OtraClave2026');
    });
  });

  describe('en producción', () => {
    it('no arranca sin SEED_PROPIETARIO_PASSWORD', () => {
      // Falla el seed entero, que es lo correcto: un despliegue sin primer
      // Propietario se nota enseguida; uno con un Propietario de contraseña
      // conocida no se nota nunca.
      expect(() => credencialesDelPropietario(produccion())).toThrow(
        /SEED_PROPIETARIO_PASSWORD/,
      );
    });

    it('rechaza específicamente la contraseña de demostración', () => {
      expect(() =>
        credencialesDelPropietario(
          produccion({ SEED_PROPIETARIO_PASSWORD: PASSWORD_DEMO }),
        ),
      ).toThrow(/publicada en el README/);
    });

    it('aplica la misma política de contraseñas que la API', () => {
      // Si el seed pudiera saltearla, la puerta más importante del sistema
      // sería la más débil.
      expect(() =>
        credencialesDelPropietario(
          produccion({ SEED_PROPIETARIO_PASSWORD: 'corta1' }),
        ),
      ).toThrow(/al menos 8 caracteres/);

      expect(() =>
        credencialesDelPropietario(
          produccion({ SEED_PROPIETARIO_PASSWORD: 'solamenteletras' }),
        ),
      ).toThrow(/al menos un número/);

      expect(() =>
        credencialesDelPropietario(
          produccion({ SEED_PROPIETARIO_PASSWORD: '1234567890' }),
        ),
      ).toThrow(/al menos una letra/);

      // bcrypt trunca en silencio a 72 bytes: aceptar más largo da una falsa
      // sensación de fortaleza.
      expect(() =>
        credencialesDelPropietario(
          produccion({ SEED_PROPIETARIO_PASSWORD: 'a1'.repeat(40) }),
        ),
      ).toThrow(/72 caracteres/);
    });

    it('con una contraseña válida, obliga a cambiarla al entrar', () => {
      const credenciales = credencialesDelPropietario(
        produccion({
          SEED_PROPIETARIO_EMAIL: 'duenio@bodega.test',
          SEED_PROPIETARIO_PASSWORD: 'ClaveDeArranque2026',
        }),
      );

      expect(credenciales).toEqual({
        email: 'duenio@bodega.test',
        password: 'ClaveDeArranque2026',
        forzarCambio: true,
      });
    });

    it('no inventa un correo: si no lo dan, usa el de demostración', () => {
      // Discutible, pero explícito: el correo no es el secreto. Lo que no puede
      // faltar es la contraseña.
      expect(
        credencialesDelPropietario(
          produccion({ SEED_PROPIETARIO_PASSWORD: 'ClaveDeArranque2026' }),
        ).email,
      ).toBe(EMAIL_DEMO);
    });
  });
});
