import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** Respuesta de `GET /api/salud`. */
export interface EstadoDeSalud {
  /** `ok` si todas las dependencias responden; `degradado` si alguna no. */
  estado: 'ok' | 'degradado';
  /** Estado de la conexión a PostgreSQL, verificado con un `SELECT 1`. */
  base: 'ok' | 'caida';
  /** Segundos desde que arrancó el proceso. */
  tiempoActivo: number;
  /** Momento de la consulta, en ISO 8601. */
  timestamp: string;
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Prueba de vida para el despliegue y para cualquier monitor externo.
   *
   * Consulta la base de verdad en lugar de responder un literal. La diferencia
   * no es teórica: `deploy/actualizar.sh` daba el despliegue por bueno cuando la
   * API devolvía 401, y ese 401 lo produce el guard antes de tocar nada. Una API
   * que arrancó y perdió después la base —o que nunca pudo reconectar— pasaba la
   * verificación igual.
   */
  async salud(): Promise<EstadoDeSalud> {
    let base: 'ok' | 'caida' = 'caida';

    try {
      await this.dataSource.query('SELECT 1');
      base = 'ok';
    } catch (error) {
      // Se registra pero no se propaga: el endpoint tiene que contestar qué
      // está mal, no caerse por lo mismo que está reportando.
      this.logger.error(
        `La verificación de salud no pudo consultar la base: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return {
      estado: base === 'ok' ? 'ok' : 'degradado',
      base,
      tiempoActivo: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
