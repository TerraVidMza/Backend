import { interpretar } from './diagnostico-push';
import {
  diagnosticarCredenciales,
  modoFcm,
  resolverCredenciales,
} from './credenciales-firebase';

/**
 * El valor del diagnóstico está en **distinguir un error de credenciales de uno
 * de token**. Esa distinción es lo único que se puede saber sobre la
 * configuración de Firebase mientras no exista la app móvil.
 *
 * El camino que va a recorrer quien configure esto —credenciales buenas, token
 * de relleno rechazado— no se puede probar en vivo sin un service account real,
 * así que se prueba acá con los errores que devuelve Firebase en cada caso.
 */
const errorFirebase = (code: string, message = 'mensaje de Firebase') =>
  Object.assign(new Error(message), { code });

describe('diagnóstico de push — interpretación del error', () => {
  describe('el token es el problema, no las credenciales', () => {
    // Éste es el resultado esperado al diagnosticar sin dispositivo: si
    // Firebase llegó a mirar el token, ya autenticó la petición.
    it.each([
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
      'messaging/invalid-argument',
    ])('%s con token de relleno confirma las credenciales', (codigo) => {
      const v = interpretar(errorFirebase(codigo), false);
      expect(v.credencialesOk).toBe(true);
      expect(v.entregado).toBe(false);
      expect(v.detalle).toMatch(/autenticó/i);
    });

    it('reconoce el rechazo aunque el código sea desconocido', () => {
      const v = interpretar(
        errorFirebase(
          'messaging/algo-nuevo',
          'The registration token is not valid',
        ),
        false,
      );
      expect(v.credencialesOk).toBe(true);
    });

    it('con un token real, el rechazo se explica como problema del token', () => {
      const v = interpretar(
        errorFirebase('messaging/registration-token-not-registered'),
        true,
      );
      expect(v.credencialesOk).toBe(true);
      expect(v.entregado).toBe(false);
      expect(v.sugerencia).toMatch(/venció|otro proyecto|incompleto/i);
    });

    it('un token de otro proyecto no invalida las credenciales', () => {
      const v = interpretar(
        errorFirebase('messaging/mismatched-credential'),
        true,
      );
      expect(v.credencialesOk).toBe(true);
      expect(v.detalle).toMatch(/OTRO proyecto/);
    });
  });

  describe('las credenciales son el problema', () => {
    it.each([
      ['app/invalid-credential', 'credencial inválida'],
      ['messaging/authentication-error', 'no autenticado'],
      ['algo/otro', 'invalid_grant: account not found'],
      ['algo/otro', 'error:1E08010C:DECODER routines::unsupported'],
    ])('%s / %s se reporta como fallo de credenciales', (codigo, mensaje) => {
      const v = interpretar(errorFirebase(codigo, mensaje), false);
      expect(v.credencialesOk).toBe(false);
      expect(v.detalle).toMatch(/rechazó las credenciales/i);
    });

    it('la API de FCM deshabilitada se distingue de una credencial mala', () => {
      const v = interpretar(
        errorFirebase(
          'messaging/unknown-error',
          'Firebase Cloud Messaging API has not been used in project 123 before',
        ),
        false,
      );
      expect(v.credencialesOk).toBe(false);
      expect(v.sugerencia).toMatch(/habilitar/i);
    });

    it('la falta del rol de envío se distingue de la API apagada', () => {
      const v = interpretar(
        errorFirebase(
          'messaging/unknown-error',
          "Permission 'cloudmessaging.messages.create' denied on resource '//cloudresourcemanager.googleapis.com/projects/terravid' (or it may not exist).",
        ),
        false,
      );
      expect(v.credencialesOk).toBe(false);
      expect(v.sugerencia).toMatch(/firebasecloudmessaging\.admin/);
    });

    it('un problema de red no se confunde con configuración', () => {
      const v = interpretar(
        errorFirebase('', 'getaddrinfo ENOTFOUND fcm.googleapis.com'),
        false,
      );
      expect(v.credencialesOk).toBe(false);
      expect(v.detalle).toMatch(/alcanzar Firebase/i);
    });

    /** Ante la duda, nunca dar por buena la configuración. */
    it('un error desconocido no se da por bueno', () => {
      const v = interpretar(errorFirebase('vaya/sorpresa', 'algo raro'), false);
      expect(v.credencialesOk).toBe(false);
      expect(v.detalle).toContain('vaya/sorpresa');
    });
  });
});

describe('detección de la clave privada mal copiada', () => {
  const original = process.env.FIREBASE_PRIVATE_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.FIREBASE_PRIVATE_KEY;
    else process.env.FIREBASE_PRIVATE_KEY = original;
  });

  const CLAVE_OK =
    '-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkq\\nhkiG9w0B\\n-----END PRIVATE KEY-----\\n';

  it('acepta la clave en una línea con los \\n del JSON', () => {
    process.env.FIREBASE_PRIVATE_KEY = CLAVE_OK;
    expect(diagnosticarCredenciales().claveMalFormada).toBe(false);
  });

  it('acepta la clave ya expandida a saltos reales', () => {
    process.env.FIREBASE_PRIVATE_KEY = CLAVE_OK.replace(/\\n/g, '\n');
    expect(diagnosticarCredenciales().claveMalFormada).toBe(false);
  });

  // El error clásico: pegarla sin comillas corta el valor en el primer salto.
  it('rechaza la clave truncada en la primera línea', () => {
    process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----';
    expect(diagnosticarCredenciales().claveMalFormada).toBe(true);
  });

  it('rechaza una clave sin saltos de línea', () => {
    process.env.FIREBASE_PRIVATE_KEY =
      '-----BEGIN PRIVATE KEY-----MIIEvQIBADANBgkq-----END PRIVATE KEY-----';
    expect(diagnosticarCredenciales().claveMalFormada).toBe(true);
  });
});

describe('credenciales con y sin clave', () => {
  const VARIABLES = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
  ] as const;
  const originales = VARIABLES.map((v) => process.env[v]);
  const poner = (
    valores: Partial<Record<(typeof VARIABLES)[number], string>>,
  ) =>
    VARIABLES.forEach((v) => {
      if (valores[v] === undefined) delete process.env[v];
      else process.env[v] = valores[v];
    });
  afterEach(() =>
    VARIABLES.forEach((v, i) => {
      if (originales[i] === undefined) delete process.env[v];
      else process.env[v] = originales[i];
    }),
  );

  const CLAVE =
    '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n';

  it('solo con el proyecto usa la cuenta de servicio del entorno', () => {
    poner({ FIREBASE_PROJECT_ID: 'terravid' });
    expect(resolverCredenciales()).toEqual({
      modo: 'adc',
      projectId: 'terravid',
    });
    expect(diagnosticarCredenciales()).toMatchObject({
      faltantes: [],
      modo: 'adc',
    });
  });

  it('con las tres variables usa la clave', () => {
    poner({
      FIREBASE_PROJECT_ID: 'terravid',
      FIREBASE_CLIENT_EMAIL: 'cuenta@terravid.iam.gserviceaccount.com',
      FIREBASE_PRIVATE_KEY: CLAVE,
    });
    expect(resolverCredenciales()).toMatchObject({ modo: 'clave' });
    expect(diagnosticarCredenciales().modo).toBe('clave');
  });

  /** Media clave es un error de configuración, no un pedido de ir sin clave. */
  it('con solo una de las dos variables de la clave no inicializa', () => {
    poner({ FIREBASE_PROJECT_ID: 'terravid', FIREBASE_PRIVATE_KEY: CLAVE });
    expect(resolverCredenciales()).toBeNull();
    expect(diagnosticarCredenciales().faltantes).toEqual([
      'FIREBASE_CLIENT_EMAIL',
    ]);
  });

  it('sin el proyecto no inicializa en ningún modo', () => {
    poner({});
    expect(resolverCredenciales()).toBeNull();
    expect(diagnosticarCredenciales().faltantes).toEqual([
      'FIREBASE_PROJECT_ID',
    ]);
  });
});

describe('modo de transporte', () => {
  const original = process.env.PUSH_TRANSPORT;
  afterEach(() => {
    if (original === undefined) delete process.env.PUSH_TRANSPORT;
    else process.env.PUSH_TRANSPORT = original;
  });

  it('solo "fcm" envía de verdad', () => {
    process.env.PUSH_TRANSPORT = 'fcm';
    expect(modoFcm()).toBe(true);
  });

  /** Sin la variable, el default es no mandar nada afuera. */
  it.each(['log', '', 'FCM', undefined])('%s no envía', (valor) => {
    if (valor === undefined) delete process.env.PUSH_TRANSPORT;
    else process.env.PUSH_TRANSPORT = valor;
    expect(modoFcm()).toBe(false);
  });
});
