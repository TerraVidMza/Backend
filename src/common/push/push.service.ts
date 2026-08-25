import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
// firebase-admin v14 expone la API modular: el namespace `admin.*` de las
// versiones viejas ya no existe.
import { App, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, SendResponse } from 'firebase-admin/messaging';
import { DeviceToken } from '../../modules/notificaciones/entities/device-token.entity';

export interface MensajePush {
  usuarioId: string;
  titulo: string;
  descripcion: string;
  /** Ruta a la que navega la app al tocar la notificación. */
  urlAccion?: string | null;
  tipo: string;
}

/**
 * Push a los dispositivos del usuario vía Firebase Cloud Messaging (HU-35).
 *
 * Sigue el mismo patrón que `MailService`: `PUSH_TRANSPORT=log` escribe el envío
 * en consola en vez de mandarlo, para poder probar el flujo sin credenciales de
 * Firebase. `PUSH_TRANSPORT=fcm` usa el service account real.
 *
 * **Nunca lanza.** Un fallo de push no puede tumbar la operación que lo disparó
 * —crear una alerta, rechazar un remito—: la notificación in-app ya quedó
 * persistida y es la fuente de verdad. El push es un aviso oportunista.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private app: App | null = null;

  constructor(
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
  ) {}

  onModuleInit(): void {
    if (this.modoLog()) {
      this.logger.log('PUSH_TRANSPORT=log: los envíos se escriben en consola.');
      return;
    }
    this.inicializarFirebase();
  }

  private modoLog(): boolean {
    return (process.env.PUSH_TRANSPORT ?? 'log') !== 'fcm';
  }

  /**
   * Inicializa el SDK una sola vez. Las credenciales salen de variables de
   * entorno y no de un archivo JSON en el repo: el service account es un
   * secreto, y un `firebase-key.json` commiteado es el accidente clásico.
   */
  private inicializarFirebase(): void {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    // La clave privada viaja en una sola línea con `\n` escapados, que es como
    // sobrevive a un `.env` y a la mayoría de los gestores de secretos.
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'PUSH_TRANSPORT=fcm pero faltan FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY: el push queda deshabilitado.',
      );
      return;
    }

    try {
      this.app = getApps().length
        ? getApp()
        : initializeApp({
            credential: cert({
              projectId,
              clientEmail,
              privateKey,
            }),
          });
      this.logger.log(`Firebase Cloud Messaging inicializado (${projectId}).`);
    } catch (error) {
      this.logger.error(
        `No se pudo inicializar Firebase: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Envía a todos los dispositivos activos del usuario.
   *
   * Devuelve cuántos envíos salieron bien, para que el llamador pueda
   * registrarlo. Un usuario sin dispositivos registrados devuelve 0 y no es un
   * error: la mayoría de los usuarios de escritorio nunca van a tener uno.
   */
  async enviar(mensaje: MensajePush): Promise<number> {
    try {
      const dispositivos = await this.deviceTokenRepository.find({
        where: { usuarioId: mensaje.usuarioId, activo: true },
      });
      if (dispositivos.length === 0) return 0;

      if (this.modoLog()) {
        this.logger.log(
          `[PUSH:log] usuario=${mensaje.usuarioId} dispositivos=${dispositivos.length} "${mensaje.titulo}" — ${mensaje.descripcion}`,
        );
        return dispositivos.length;
      }
      if (!this.app) return 0;

      const respuesta = await getMessaging(this.app).sendEachForMulticast({
        tokens: dispositivos.map((d) => d.token),
        notification: {
          title: mensaje.titulo,
          body: mensaje.descripcion,
        },
        // `data` viaja como strings: FCM rechaza cualquier otro tipo.
        data: {
          tipo: mensaje.tipo,
          urlAccion: mensaje.urlAccion ?? '',
        },
      });

      await this.desactivarTokensMuertos(dispositivos, respuesta.responses);
      await this.marcarUso(
        dispositivos
          .filter((_, i) => respuesta.responses[i]?.success)
          .map((d) => d.id),
      );
      return respuesta.successCount;
    } catch (error) {
      this.logger.error(
        `Fallo el envío push a ${mensaje.usuarioId}: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  /**
   * Apaga los tokens que FCM rechazó por inválidos o no registrados.
   *
   * Solo esos dos códigos: un fallo de red o una cuota agotada son transitorios
   * y desactivar el dispositivo por eso lo dejaría sin push para siempre.
   */
  private async desactivarTokensMuertos(
    dispositivos: DeviceToken[],
    respuestas: SendResponse[],
  ): Promise<void> {
    const muertos = dispositivos
      .filter((_, i) => {
        const codigo = respuestas[i]?.error?.code;
        return (
          codigo === 'messaging/registration-token-not-registered' ||
          codigo === 'messaging/invalid-registration-token'
        );
      })
      .map((d) => d.id);

    if (muertos.length > 0) {
      await this.deviceTokenRepository.update(
        { id: In(muertos) },
        { activo: false },
      );
      this.logger.log(
        `${muertos.length} token(s) de dispositivo desactivados.`,
      );
    }
  }

  private async marcarUso(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.deviceTokenRepository.update(
      { id: In(ids) },
      { ultimoUso: new Date() },
    );
  }
}
