import { esTokenMuerto } from './token-rechazado';

/**
 * Regresión encontrada probando contra Firebase real (HU-35, D-015).
 *
 * El código original solo miraba `registration-token-not-registered` e
 * `invalid-registration-token`. Pero para un token mal formado **FCM devuelve
 * `messaging/invalid-argument`**, así que esos tokens nunca se desactivaban: se
 * acumulaban en la base y cada notificación gastaba una llamada por dispositivo
 * fantasma. Solo se vio enviando de verdad; en modo `log` no hay respuesta que
 * interpretar.
 */
describe('esTokenMuerto', () => {
  it('reconoce el token no registrado', () => {
    expect(
      esTokenMuerto({ code: 'messaging/registration-token-not-registered' }),
    ).toBe(true);
  });

  it('reconoce el token con formato inválido', () => {
    expect(
      esTokenMuerto({ code: 'messaging/invalid-registration-token' }),
    ).toBe(true);
  });

  // El mensaje exacto que devolvió Firebase en la verificación real.
  it('reconoce invalid-argument cuando el error apunta al token', () => {
    expect(
      esTokenMuerto({
        code: 'messaging/invalid-argument',
        message: 'The registration token is not a valid FCM registration token',
      }),
    ).toBe(true);
  });

  /**
   * El caso que obliga a leer el mensaje y no solo el código: `invalid-argument`
   * también aparece cuando el payload está mal. Desactivar acá apagaría **todos**
   * los dispositivos válidos de la base por un bug de una sola línea.
   */
  it('NO desactiva por invalid-argument de payload', () => {
    expect(
      esTokenMuerto({
        code: 'messaging/invalid-argument',
        message: 'data must only contain string values',
      }),
    ).toBe(false);
  });

  it('NO desactiva por invalid-argument sin mensaje', () => {
    expect(esTokenMuerto({ code: 'messaging/invalid-argument' })).toBe(false);
  });

  // Transitorios: desactivar dejaría al dispositivo sin push para siempre.
  it.each([
    'messaging/server-unavailable',
    'messaging/internal-error',
    'messaging/quota-exceeded',
    'messaging/authentication-error',
    'messaging/mismatched-credential',
  ])('NO desactiva por %s', (code) => {
    expect(esTokenMuerto({ code })).toBe(false);
  });

  it('un envío sin error no desactiva nada', () => {
    expect(esTokenMuerto(undefined)).toBe(false);
    expect(esTokenMuerto({})).toBe(false);
  });
});
