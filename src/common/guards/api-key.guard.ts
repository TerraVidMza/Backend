import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

/**
 * Autentica a los nodos IoT por API key estática en el header `X-Api-Key`.
 *
 * Los nodos ESP32 no pueden sostener una sesión JWT de usuario (expira a las
 * 8 horas y requiere credenciales de persona), así que la ingesta de telemetría
 * se autentica con una clave propia del canal de dispositivos.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const esperada = process.env.IOT_API_KEY;

    // Sin clave configurada el endpoint queda cerrado, no abierto.
    if (!esperada) {
      throw new UnauthorizedException('Ingesta IoT no configurada');
    }

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();

    const header = request.headers['x-api-key'];
    const recibida = Array.isArray(header) ? header[0] : header;

    if (!recibida || !this.esIgual(recibida, esperada)) {
      throw new UnauthorizedException('API key inválida');
    }

    return true;
  }

  /** Comparación en tiempo constante, para no filtrar la clave por timing. */
  private esIgual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    // timingSafeEqual exige longitudes iguales; comparar primero la longitud
    // filtra solo ese dato, no el contenido.
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }
}
