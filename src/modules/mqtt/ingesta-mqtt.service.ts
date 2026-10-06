import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MqttConexionService } from './mqtt-conexion.service';
import { FILTRO_LECTURAS } from './dynsec.service';
import { LecturasIotService } from '../lecturas-iot/lecturas-iot.service';
import { IngestLecturaDto } from '../lecturas-iot/dto/ingest-lectura.dto';

/**
 * Ingesta de telemetría por MQTT (D-026).
 *
 * Cada sensor publica en `terravid/sensores/{codigo}/lecturas`. El código se
 * toma **del tópico** y no del payload: el broker solo deja publicar a cada
 * sensor en su propio tópico, así que el tópico es la identidad autenticada.
 * Un `codigoSensor` en el payload se ignora.
 *
 * Después de identificar el sensor, la lectura sigue exactamente el mismo
 * camino que `POST /api/lecturas-iot`: rango físico, anómalas, umbrales y
 * alertas.
 */
@Injectable()
export class IngestaMqttService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IngestaMqttService.name);

  constructor(
    private readonly mqtt: MqttConexionService,
    private readonly lecturas: LecturasIotService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.mqtt.habilitada) return;
    this.mqtt.suscribir(FILTRO_LECTURAS, (topico, payload) =>
      this.procesar(topico, payload),
    );
  }

  async procesar(topico: string, payload: Buffer): Promise<void> {
    const codigo = topico.split('/')[2];

    let cuerpo: unknown;
    try {
      cuerpo = JSON.parse(payload.toString());
    } catch {
      this.logger.warn(
        `Lectura de ${codigo} descartada: el payload no es JSON.`,
      );
      return;
    }
    if (typeof cuerpo !== 'object' || cuerpo === null) {
      this.logger.warn(
        `Lectura de ${codigo} descartada: el payload no es un objeto.`,
      );
      return;
    }

    const dto = plainToInstance(IngestLecturaDto, {
      valor: (cuerpo as Record<string, unknown>).valor,
      unidad: (cuerpo as Record<string, unknown>).unidad,
      sensorTimestamp: (cuerpo as Record<string, unknown>).sensorTimestamp,
      codigoSensor: codigo,
    });
    const errores = await validate(dto, { whitelist: true });
    if (errores.length > 0) {
      this.logger.warn(
        `Lectura de ${codigo} descartada: ${errores
          .flatMap((e) => Object.values(e.constraints ?? {}))
          .join('; ')}`,
      );
      return;
    }

    try {
      await this.lecturas.ingest(dto);
    } catch (error) {
      // Sensor inexistente o dado de baja: el broker no debería haberlo
      // dejado publicar, pero si la credencial quedó viva se registra y sigue.
      this.logger.warn(
        `Lectura de ${codigo} rechazada: ${(error as Error).message}`,
      );
    }
  }
}
