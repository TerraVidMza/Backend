import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
// firebase-admin v14 expone la API modular: el namespace `admin.*` de las
// versiones viejas ya no existe.
import { App, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, SendResponse } from 'firebase-admin/messaging';
import { DeviceToken } from '../../modules/notificaciones/entities/device-token.entity';
import {
  modoFcm,
  resolverCredenciales,
  VARIABLES_FIREBASE,
} from './credenciales-firebase';
import { esTokenMuerto } from './token-rechazado';

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
  /** Para no repetir el aviso de "push deshabilitado" en cada envío. */
  private avisoDeshabilitado = false;

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
    return !modoFcm();
  }

  /**
   * Inicializa el SDK una sola vez. Las credenciales salen de variables de
   * entorno y no de un archivo JSON en el repo: el service account es un
   * secreto, y un `firebase-key.json` commiteado es el accidente clásico.
   *
   * **No lanza si las credenciales faltan o están mal.** Un problema de push no
   * puede impedir que la API levante; queda deshabilitado y avisado en el log.
   * `npm run push:diagnostico` existe justamente porque este warning es fácil
   * de pasar por alto en un arranque.
   */
  private inicializarFirebase(): void {
    const credenciales = resolverCredenciales();
    if (!credenciales) {
      this.logger.warn(
        `PUSH_TRANSPORT=fcm pero faltan ${VARIABLES_FIREBASE.join(', ')}: el push queda deshabilitado.`,
      );
      return;
    }

    try {
      this.app = getApps().length
        ? getApp()
        : initializeApp({ credential: cert(credenciales) });
      this.logger.log(
        `Firebase Cloud Messaging inicializado (${credenciales.projectId}).`,
      );
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
      if (!this.app) {
        // Una sola vez: si el push quedó deshabilitado, cada alerta y cada
        // remito pasan por acá, y repetir el aviso solo llenaría el disco de
        // la VM. El detalle de por qué está en el warning de `onModuleInit`.
        if (!this.avisoDeshabilitado) {
          this.avisoDeshabilitado = true;
          this.logger.warn(
            `Push deshabilitado: no se envía "${mensaje.titulo}" a ${mensaje.usuarioId}, ni lo que siga.`,
          );
        }
        return 0;
      }

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

      this.logger.log(
        `Push "${mensaje.titulo}" a ${mensaje.usuarioId}: ` +
          `${respuesta.successCount}/${dispositivos.length} entregados.`,
      );

      // Los fallos que no son tokens muertos —credenciales de otro proyecto,
      // cuota agotada, payload inválido— no dejan rastro en ningún otro lado:
      // `enviar` devuelve un número que el llamador registra como éxito
      // parcial. Los códigos van deduplicados porque un problema de
      // configuración falla igual en todos los dispositivos a la vez.
      if (respuesta.failureCount > 0) {
        const motivos = [
          ...new Set(
            respuesta.responses
              .filter((r) => !r.success)
              .map((r) => r.error?.code ?? 'sin código'),
          ),
        ];
        this.logger.warn(
          `${respuesta.failureCount} envío(s) push fallaron: ${motivos.join(', ')}`,
        );
      }

      return respuesta.successCount;
    } catch (error) {
      this.logger.error(
        `Fallo el envío push a ${mensaje.usuarioId}: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  /**
   * Apaga los tokens que FCM rechazó como inválidos o no registrados.
   *
   * El criterio vive en `esTokenMuerto` porque no es obvio: FCM devuelve
   * `messaging/invalid-argument` tanto para un token mal formado como para un
   * mensaje mal armado, y desactivar en el segundo caso apagaría todos los
   * dispositivos de la base por un bug de payload.
   */
  private async desactivarTokensMuertos(
    dispositivos: DeviceToken[],
    respuestas: SendResponse[],
  ): Promise<void> {
    const muertos = dispositivos
      .filter((_, i) => esTokenMuerto(respuestas[i]?.error))
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
