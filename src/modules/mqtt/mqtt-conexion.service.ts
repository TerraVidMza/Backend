import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { connect, type MqttClient } from 'mqtt';

type Manejador = (topico: string, payload: Buffer) => void | Promise<void>;

/**
 * Conexión de la API al broker MQTT (D-026).
 *
 * Es opcional: sin `MQTT_URL` queda apagada y la telemetría entra solo por
 * `POST /api/lecturas-iot`. Así el desarrollo local, los tests y el CI no
 * necesitan un broker.
 *
 * Las suscripciones se registran una vez y se rehacen en cada reconexión: si
 * el broker se reinicia, la ingesta vuelve sola.
 */
@Injectable()
export class MqttConexionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttConexionService.name);
  private cliente: MqttClient | null = null;
  private readonly suscripciones = new Map<string, Manejador>();
  private readonly alConectarse: Array<() => void> = [];

  constructor(private readonly config: ConfigService) {}

  get habilitada(): boolean {
    return Boolean(this.config.get<string>('MQTT_URL'));
  }

  get usuario(): string | undefined {
    return this.config.get<string>('MQTT_USUARIO');
  }

  onModuleInit(): void {
    const url = this.config.get<string>('MQTT_URL');
    if (!url) {
      this.logger.log('MQTT_URL no definida: ingesta MQTT apagada.');
      return;
    }

    this.cliente = connect(url, {
      username: this.usuario,
      password: this.config.get<string>('MQTT_PASSWORD'),
      clientId: `terravid-api-${crypto.randomUUID().slice(0, 8)}`,
      reconnectPeriod: 5_000,
      connectTimeout: 10_000,
    });

    this.cliente.on('connect', () => {
      this.logger.log(`Conectado al broker MQTT (${url}).`);
      const filtros = [...this.suscripciones.keys()];
      const suscribir = filtros.length
        ? this.cliente!.subscribeAsync(filtros, { qos: 1 })
        : Promise.resolve();
      // Los oyentes corren con las suscripciones ya activas: si no, la
      // respuesta a un comando podría llegar antes de estar escuchándola.
      void suscribir
        .then(() => this.alConectarse.forEach((cb) => cb()))
        .catch((error: Error) =>
          this.logger.warn(`No se pudo suscribir: ${error.message}`),
        );
    });
    this.cliente.on('error', (error) =>
      this.logger.warn(`Error de MQTT: ${error.message}`),
    );
    this.cliente.on('message', (topico, payload) => {
      for (const [filtro, manejador] of this.suscripciones) {
        if (coincide(filtro, topico)) {
          void Promise.resolve(manejador(topico, payload)).catch(
            (error: Error) =>
              this.logger.error(
                `Falló el manejo de ${topico}: ${error.message}`,
              ),
          );
        }
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.cliente?.endAsync();
  }

  /** Se llama en cada conexión (también las reconexiones), ya suscripto. */
  alConectar(cb: () => void): void {
    this.alConectarse.push(cb);
  }

  suscribir(filtro: string, manejador: Manejador): void {
    this.suscripciones.set(filtro, manejador);
    if (this.cliente?.connected) {
      this.cliente.subscribe(filtro, { qos: 1 });
    }
  }

  dejarDeSuscribir(filtro: string): void {
    this.suscripciones.delete(filtro);
    this.cliente?.unsubscribe(filtro);
  }

  async publicar(topico: string, payload: string): Promise<void> {
    if (!this.cliente) {
      throw new Error('MQTT no está habilitado');
    }
    await this.cliente.publishAsync(topico, payload, { qos: 1 });
  }
}

/** Coincidencia de un filtro MQTT (`+` y `#`) contra un tópico concreto. */
export function coincide(filtro: string, topico: string): boolean {
  const f = filtro.split('/');
  const t = topico.split('/');
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '#') return true;
    if (i >= t.length) return false;
    if (f[i] !== '+' && f[i] !== t[i]) return false;
  }
  return f.length === t.length;
}
