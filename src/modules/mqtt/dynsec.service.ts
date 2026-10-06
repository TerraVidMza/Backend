import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { MqttConexionService } from './mqtt-conexion.service';

const TOPICO_CONTROL = '$CONTROL/dynamic-security/v1';
const TOPICO_RESPUESTA = `${TOPICO_CONTROL}/response`;
const ROL_INGESTA = 'terravid-ingesta';
const TIEMPO_MAXIMO_MS = 5_000;

/** Tópico en el que publica cada sensor (D-026). */
export const topicoDeLecturas = (codigo: string) =>
  `terravid/sensores/${codigo}/lecturas`;
export const FILTRO_LECTURAS = 'terravid/sensores/+/lecturas';

interface Respuesta {
  command: string;
  error?: string;
  correlationData?: string;
  data?: { client?: { roles?: Array<{ rolename: string }> } };
}

/**
 * Credenciales MQTT por sensor con el plugin **dynamic security** de
 * Mosquitto (D-026).
 *
 * El broker guarda usuarios, roles y ACL en su propio archivo y se administra
 * mandándole comandos JSON por MQTT: la API crea o deshabilita la credencial
 * de un sensor sin reiniciar el broker ni tocar archivos. Cada sensor tiene un
 * rol propio que solo le permite **publicar en su tópico**, así un dispositivo
 * comprometido no puede hacerse pasar por otro.
 */
@Injectable()
export class DynsecService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DynsecService.name);
  private readonly pendientes = new Map<
    string,
    (respuestas: Respuesta[]) => void
  >();

  constructor(private readonly mqtt: MqttConexionService) {}

  get habilitado(): boolean {
    return this.mqtt.habilitada;
  }

  onApplicationBootstrap(): void {
    if (!this.habilitado) return;
    this.mqtt.suscribir(TOPICO_RESPUESTA, (_topico, payload) =>
      this.recibir(payload),
    );
    // El usuario de la API necesita poder suscribirse a las lecturas: el
    // dynamic security niega todo por defecto. Se verifica en cada conexión
    // (es una consulta barata) por si el broker se recreó.
    this.mqtt.alConectar(() => {
      void this.asegurarRolDeIngesta().catch((error: Error) =>
        this.logger.warn(
          `No se pudo asegurar el rol de ingesta: ${error.message}`,
        ),
      );
    });
  }

  /**
   * Le da al usuario de la API permiso para suscribirse a las lecturas.
   *
   * Dynamic security **desconecta** a un cliente cuando le cambian los roles,
   * para que se vuelva a autenticar con los nuevos. Por eso primero se
   * consulta si ya lo tiene, y si no, se le agrega sin esperar la respuesta:
   * la conexión se corta, se rehace sola y retoma las suscripciones. Pasa una
   * sola vez, la primera vez que la API se conecta a un broker nuevo.
   */
  async asegurarRolDeIngesta(): Promise<void> {
    const [cliente] = await this.ejecutar([
      { command: 'getClient', username: this.mqtt.usuario },
    ]);
    const roles = cliente?.data?.client?.roles ?? [];
    if (roles.some((r) => r.rolename === ROL_INGESTA)) return;

    await this.ejecutar(
      [
        {
          command: 'createRole',
          rolename: ROL_INGESTA,
          acls: [
            {
              acltype: 'subscribePattern',
              topic: FILTRO_LECTURAS,
              allow: true,
            },
          ],
        },
      ],
      { ignorarExistentes: true },
    );
    this.logger.log(
      'Se agrega el rol de ingesta al usuario de la API; el broker reinicia su conexión.',
    );
    await this.mqtt.publicar(
      TOPICO_CONTROL,
      JSON.stringify({
        commands: [
          {
            command: 'addClientRole',
            username: this.mqtt.usuario,
            rolename: ROL_INGESTA,
          },
        ],
      }),
    );
  }

  /**
   * Crea (o regenera) la credencial del sensor y devuelve la contraseña. Es la
   * única vez que se ve: el broker guarda solo su hash.
   */
  async crearCredencial(codigo: string): Promise<string> {
    const password = crypto.randomBytes(18).toString('base64url');
    const rol = `sensor-${codigo}`;
    await this.ejecutar(
      [
        { command: 'deleteClient', username: codigo },
        { command: 'deleteRole', rolename: rol },
      ],
      { ignorarErrores: true },
    );
    await this.ejecutar([
      {
        command: 'createRole',
        rolename: rol,
        acls: [
          {
            acltype: 'publishClientSend',
            topic: topicoDeLecturas(codigo),
            allow: true,
          },
        ],
      },
      {
        command: 'createClient',
        username: codigo,
        password,
        roles: [{ rolename: rol }],
      },
    ]);
    return password;
  }

  /** Un sensor dado de baja deja de poder conectarse. */
  async deshabilitar(codigo: string): Promise<void> {
    await this.ejecutar([{ command: 'disableClient', username: codigo }], {
      ignorarErrores: true,
    });
  }

  /** Al renombrar un sensor, la credencial del código viejo deja de existir. */
  async eliminar(codigo: string): Promise<void> {
    await this.ejecutar(
      [
        { command: 'deleteClient', username: codigo },
        { command: 'deleteRole', rolename: `sensor-${codigo}` },
      ],
      { ignorarErrores: true },
    );
  }

  private async ejecutar(
    comandos: Array<Record<string, unknown>>,
    opciones: { ignorarErrores?: boolean; ignorarExistentes?: boolean } = {},
  ): Promise<Respuesta[]> {
    if (!this.habilitado) {
      throw new ServiceUnavailableException(
        'La ingesta MQTT no está habilitada en este servidor',
      );
    }
    const correlacion = crypto.randomUUID();
    const respuesta = new Promise<Respuesta[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendientes.delete(correlacion);
        reject(
          new ServiceUnavailableException(
            'El broker MQTT no respondió a tiempo',
          ),
        );
      }, TIEMPO_MAXIMO_MS);
      this.pendientes.set(correlacion, (r) => {
        clearTimeout(timer);
        resolve(r);
      });
    });

    await this.mqtt.publicar(
      TOPICO_CONTROL,
      JSON.stringify({
        commands: comandos.map((c, i) => ({
          ...c,
          correlationData: `${correlacion}:${i}`,
        })),
      }),
    );

    const respuestas = await respuesta;
    if (opciones.ignorarErrores) return respuestas;
    const errores = respuestas.filter(
      (r) =>
        r.error &&
        !(opciones.ignorarExistentes && /already exists|exist/i.test(r.error)),
    );
    if (errores.length > 0) {
      throw new ServiceUnavailableException(
        `El broker rechazó ${errores.map((e) => `${e.command}: ${e.error}`).join('; ')}`,
      );
    }
    return respuestas;
  }

  private recibir(payload: Buffer): void {
    let respuestas: Respuesta[];
    try {
      respuestas = (
        JSON.parse(payload.toString()) as { responses: Respuesta[] }
      ).responses;
    } catch {
      return;
    }
    const correlacion = respuestas[0]?.correlationData?.split(':')[0];
    const pendiente = correlacion
      ? this.pendientes.get(correlacion)
      : undefined;
    if (pendiente && correlacion) {
      this.pendientes.delete(correlacion);
      pendiente(respuestas);
    }
  }
}
