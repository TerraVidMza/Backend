import { validarEntorno } from './validar-entorno';

/**
 * Lo que se prueba acá no es que la función valide, sino **qué deja pasar en
 * producción**: cada caso de abajo corresponde a un despliegue que hoy
 * arrancaría "bien" y estaría roto o abierto.
 */
describe('validarEntorno', () => {
  const minimo = {
    DB_HOST: 'localhost',
    DB_USERNAME: 'postgres',
    DB_PASSWORD: 'postgres',
    DB_DATABASE: 'terravid',
    JWT_SECRET: 'un-secreto-de-desarrollo',
    IOT_API_KEY: 'clave-iot',
  };

  const produccion = {
    ...minimo,
    NODE_ENV: 'production',
    JWT_SECRET: 'x'.repeat(48),
    CORS_ORIGIN: 'https://terravid.example',
  };

  it('acepta el mínimo de desarrollo', () => {
    expect(() => validarEntorno(minimo)).not.toThrow();
  });

  it('acepta una configuración de producción completa', () => {
    expect(() => validarEntorno(produccion)).not.toThrow();
  });

  describe('lo que no puede faltar', () => {
    it.each(Object.keys(minimo))('falla si falta %s', (clave) => {
      const entorno = { ...minimo, [clave]: undefined };
      expect(() => validarEntorno(entorno)).toThrow(clave);
    });

    it('trata una variable vacía como ausente', () => {
      expect(() => validarEntorno({ ...minimo, JWT_SECRET: '   ' })).toThrow(
        'JWT_SECRET',
      );
    });

    it('el mensaje nombra todas las que faltan, no solo la primera', () => {
      const entorno = { ...minimo, DB_HOST: undefined, JWT_SECRET: undefined };
      expect(() => validarEntorno(entorno)).toThrow(/DB_HOST.*JWT_SECRET/s);
    });
  });

  describe('reglas que solo aplican en producción', () => {
    it('rechaza DB_SYNCHRONIZE=true', () => {
      // Un renombre de columna se traduce a DROP + ADD y borra los datos sin
      // avisar (D-007).
      expect(() =>
        validarEntorno({ ...produccion, DB_SYNCHRONIZE: 'true' }),
      ).toThrow('DB_SYNCHRONIZE');
    });

    it('lo permite fuera de producción, que es para lo que existe', () => {
      expect(() =>
        validarEntorno({ ...minimo, DB_SYNCHRONIZE: 'true' }),
      ).not.toThrow();
    });

    it('rechaza un JWT_SECRET corto', () => {
      expect(() =>
        validarEntorno({ ...produccion, JWT_SECRET: 'corto' }),
      ).toThrow('JWT_SECRET');
    });

    it('avisa por CORS_ORIGIN pero NO impide arrancar', () => {
      // Exigirla tumbó un despliegue: DESPLIEGUE.md A.12 documenta que hoy no
      // está definida en producción a propósito, porque no hay frontend. La API
      // no arrancó y Caddy devolvió 502. El riesgo lo cubre main.ts, que sin la
      // variable cierra el CORS en vez de abrirlo; una variable que no hace
      // falta para servir no puede impedir arrancar.
      const avisos = jest.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        expect(() =>
          validarEntorno({ ...produccion, CORS_ORIGIN: undefined }),
        ).not.toThrow();

        expect(avisos).toHaveBeenCalledWith(
          expect.stringContaining('CORS_ORIGIN'),
        );
      } finally {
        avisos.mockRestore();
      }
    });
  });

  describe('transportes condicionales', () => {
    it('con PUSH_TRANSPORT=fcm exige las tres credenciales', () => {
      expect(() =>
        validarEntorno({ ...minimo, PUSH_TRANSPORT: 'fcm' }),
      ).toThrow(
        /FIREBASE_PROJECT_ID.*FIREBASE_CLIENT_EMAIL.*FIREBASE_PRIVATE_KEY/s,
      );
    });

    it('con PUSH_TRANSPORT=log no exige ninguna', () => {
      expect(() =>
        validarEntorno({ ...minimo, PUSH_TRANSPORT: 'log' }),
      ).not.toThrow();
    });

    it('rechaza un transporte que no existe', () => {
      expect(() =>
        validarEntorno({ ...minimo, PUSH_TRANSPORT: 'firebase' }),
      ).toThrow('PUSH_TRANSPORT');
    });

    it('con MAIL_TRANSPORT=smtp exige host, puerto y remitente', () => {
      expect(() =>
        validarEntorno({ ...minimo, MAIL_TRANSPORT: 'smtp' }),
      ).toThrow(/SMTP_HOST.*SMTP_PORT.*MAIL_FROM/s);
    });
  });

  describe('valores mal formados', () => {
    it('rechaza un DB_PORT que no es número', () => {
      expect(() => validarEntorno({ ...minimo, DB_PORT: 'cinco' })).toThrow(
        'DB_PORT',
      );
    });

    it('rechaza un BCRYPT_SALT_ROUNDS que no es número', () => {
      expect(() =>
        validarEntorno({ ...minimo, BCRYPT_SALT_ROUNDS: 'muchas' }),
      ).toThrow('BCRYPT_SALT_ROUNDS');
    });
  });

  it('devuelve el entorno intacto cuando es válido', () => {
    expect(validarEntorno(minimo)).toEqual(minimo);
  });

  describe('MQTT (D-026)', () => {
    it('sin MQTT_URL no exige nada: la ingesta queda solo por HTTP', () => {
      expect(() => validarEntorno(minimo)).not.toThrow();
    });

    it('con MQTT_URL exige el usuario y la contraseña de la API', () => {
      expect(() =>
        validarEntorno({ ...minimo, MQTT_URL: 'mqtt://mqtt:1883' }),
      ).toThrow(/MQTT_USUARIO/);
    });

    it('rechaza una URL que no es mqtt:// ni mqtts://', () => {
      expect(() =>
        validarEntorno({
          ...minimo,
          MQTT_URL: 'http://mqtt:1883',
          MQTT_USUARIO: 'api',
          MQTT_PASSWORD: 'x',
        }),
      ).toThrow(/MQTT_URL/);
    });
  });
});
