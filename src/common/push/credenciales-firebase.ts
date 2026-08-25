/**
 * Resolución de las credenciales de Firebase desde variables de entorno.
 *
 * Vive aparte de `PushService` para que el diagnóstico (`npm run
 * push:diagnostico`) valide **exactamente lo mismo** que usa la aplicación. Si
 * cada uno leyera las variables por su cuenta, el diagnóstico podría dar verde
 * sobre una configuración que la app no acepta, que es la peor clase de
 * herramienta de verificación.
 */

export interface CredencialesFirebase {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export interface ProblemaCredenciales {
  /** Variables sin valor. */
  faltantes: string[];
  /**
   * La clave está presente pero no parece una clave PEM.
   *
   * Es el error clásico: al copiar `private_key` del JSON del service account,
   * los `\n` se pierden o se pegan como saltos de línea reales sin comillas, y
   * dotenv corta el valor en el primer salto. El resultado es una clave
   * truncada que solo falla al intentar firmar, con un mensaje críptico.
   */
  claveMalFormada: boolean;
}

/** `true` si el push tiene que salir de verdad; `false` si va a consola. */
export function modoFcm(): boolean {
  return (process.env.PUSH_TRANSPORT ?? 'log') === 'fcm';
}

/**
 * Lee las tres variables y normaliza la clave privada.
 *
 * La clave viaja en una sola línea con `\n` escapados, que es como sobrevive a
 * un `.env` y a la mayoría de los gestores de secretos. Si vino con comillas
 * dobles, dotenv ya la expandió y este `replace` no encuentra nada que hacer:
 * las dos formas funcionan.
 */
export function resolverCredenciales(): CredencialesFirebase | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }
  return { projectId, clientEmail, privateKey };
}

/** Qué falta o qué está mal, para poder decirlo con precisión. */
export function diagnosticarCredenciales(): ProblemaCredenciales {
  const faltantes = (
    [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PRIVATE_KEY',
    ] as const
  ).filter((clave) => !process.env[clave]);

  const clave = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') ?? '';
  // Una clave PEM bien formada abre y cierra con sus marcadores y tiene saltos
  // de línea reales en el medio. Sin saltos, el valor se cortó al copiarlo.
  const claveMalFormada =
    clave.length > 0 &&
    (!clave.includes('-----BEGIN') ||
      !clave.includes('-----END') ||
      !clave.includes('\n'));

  return { faltantes: [...faltantes], claveMalFormada };
}

/** Nombres de las variables, para no repetirlos en los mensajes. */
export const VARIABLES_FIREBASE = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
] as const;
