/**
 * Resolución de las credenciales de Firebase desde variables de entorno.
 *
 * Vive aparte de `PushService` para que el diagnóstico (`npm run
 * push:diagnostico`) valide **exactamente lo mismo** que usa la aplicación. Si
 * cada uno leyera las variables por su cuenta, el diagnóstico podría dar verde
 * sobre una configuración que la app no acepta, que es la peor clase de
 * herramienta de verificación.
 *
 * Hay dos formas de autenticarse (D-033):
 *
 * - **Sin clave** (producción): solo `FIREBASE_PROJECT_ID`. El SDK usa las
 *   credenciales por defecto del entorno, que en la VM son las de su cuenta de
 *   servicio, servidas por el servidor de metadatos. La organización del
 *   proyecto `terravid` prohíbe crear claves de cuentas de servicio.
 * - **Con clave**: además `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`,
 *   sacadas del JSON de una cuenta de servicio. Sirve fuera de Google Cloud.
 */

import { applicationDefault, cert, Credential } from 'firebase-admin/app';

export type CredencialesFirebase =
  | {
      modo: 'clave';
      projectId: string;
      clientEmail: string;
      privateKey: string;
    }
  | { modo: 'adc'; projectId: string };

export interface ProblemaCredenciales {
  /**
   * Variables sin valor. `FIREBASE_PROJECT_ID` siempre; de la clave, solo si
   * vino una de las dos: con una sola no hay forma de saber qué se quiso.
   */
  faltantes: string[];
  /** Cómo se va a autenticar si no falta nada. */
  modo: 'clave' | 'adc';
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
 * Lee las variables y normaliza la clave privada.
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

  if (!projectId) {
    return null;
  }
  if (!clientEmail && !privateKey) {
    return { modo: 'adc', projectId };
  }
  if (!clientEmail || !privateKey) {
    return null;
  }
  return { modo: 'clave', projectId, clientEmail, privateKey };
}

/** La credencial que recibe `initializeApp` para cada modo. */
export function credencialDe(credenciales: CredencialesFirebase): Credential {
  return credenciales.modo === 'clave'
    ? cert(credenciales)
    : applicationDefault();
}

/** Qué falta o qué está mal, para poder decirlo con precisión. */
export function diagnosticarCredenciales(): ProblemaCredenciales {
  const conClave =
    !!process.env.FIREBASE_CLIENT_EMAIL || !!process.env.FIREBASE_PRIVATE_KEY;
  const faltantes = (
    conClave ? VARIABLES_FIREBASE : (['FIREBASE_PROJECT_ID'] as const)
  ).filter((clave) => !process.env[clave]);

  const clave = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') ?? '';
  // Una clave PEM bien formada abre y cierra con sus marcadores y tiene saltos
  // de línea reales en el medio. Sin saltos, el valor se cortó al copiarlo.
  const claveMalFormada =
    clave.length > 0 &&
    (!clave.includes('-----BEGIN') ||
      !clave.includes('-----END') ||
      !clave.includes('\n'));

  return {
    faltantes: [...faltantes],
    modo: conClave ? 'clave' : 'adc',
    claveMalFormada,
  };
}

/** Nombres de las variables, para no repetirlos en los mensajes. */
export const VARIABLES_FIREBASE = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
] as const;
