/**
 * ¿El error que devolvió FCM significa que el token está muerto?
 *
 * Separado y testeado aparte porque **equivocarse en cualquiera de los dos
 * sentidos duele**: de menos, los tokens muertos se acumulan y cada
 * notificación gasta una llamada por dispositivo fantasma; de más, un bug en el
 * payload apagaría todos los dispositivos válidos de la base.
 */

export interface ErrorEnvio {
  code?: string;
  message?: string;
}

/**
 * Los dos códigos que significan «este token ya no sirve» sin ambigüedad.
 *
 * Un fallo de red o una cuota agotada son transitorios y **no** entran acá:
 * desactivar por eso dejaría al dispositivo sin push para siempre.
 */
const CODIGOS_TOKEN_MUERTO = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/**
 * `invalid-argument` es el que exige leer el mensaje.
 *
 * FCM lo devuelve tanto para un token mal formado —«The registration token is
 * not a valid FCM registration token»— como para un mensaje mal armado. Tratar
 * los dos igual y desactivar sería catastrófico: un error de payload borraría
 * todos los dispositivos registrados de una sola pasada. Solo cuenta cuando el
 * propio error apunta al token.
 */
const CODIGO_AMBIGUO = 'messaging/invalid-argument';
const APUNTA_AL_TOKEN = /registration token/i;

export function esTokenMuerto(error: ErrorEnvio | undefined): boolean {
  if (!error?.code) return false;
  if (CODIGOS_TOKEN_MUERTO.has(error.code)) return true;
  if (error.code === CODIGO_AMBIGUO) {
    return APUNTA_AL_TOKEN.test(error.message ?? '');
  }
  return false;
}
