import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificacionesService } from '../../modules/notificaciones/notificaciones.service';
import { TokenRecuperacionService } from '../../modules/token-recuperacion/token-recuperacion.service';
import { LecturasIotService } from '../../modules/lecturas-iot/lecturas-iot.service';
import { TokenRevocadoService } from '../../modules/auth/token-revocado.service';
import { RefreshTokenService } from '../../modules/auth/refresh-token.service';

/**
 * Tareas de mantenimiento nocturnas.
 *
 * Corren in-process con `@nestjs/schedule`, que es la alternativa sin Redis
 * documentada en `D-g`. Implicancia a tener presente al escalar: **con más de
 * una instancia, cada una ejecuta su propia copia del cron**. Las tres tareas
 * son idempotentes (borran por rango de fechas), así que el peor caso hoy es
 * trabajo duplicado y no datos corruptos; cuando haya varias instancias hay que
 * pasarlas a una cola con lock distribuido.
 *
 * Ninguna propaga excepciones: un error de mantenimiento no puede dejar el
 * scheduler caído para las corridas siguientes.
 */
@Injectable()
export class TareasProgramadasService {
  private readonly logger = new Logger(TareasProgramadasService.name);

  constructor(
    private readonly notificacionesService: NotificacionesService,
    private readonly tokenRecuperacionService: TokenRecuperacionService,
    private readonly lecturasIotService: LecturasIotService,
    private readonly tokenRevocadoService: TokenRevocadoService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  /** HU-35: las notificaciones se conservan 30 días. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'purga-notificaciones' })
  async purgarNotificaciones(): Promise<void> {
    try {
      const dias = this.leerEntero('NOTIFICACIONES_RETENCION_DIAS', 30);
      const borradas = await this.notificacionesService.purgarAntiguas(dias);
      if (borradas > 0) {
        this.logger.log(
          `Purga de notificaciones: ${borradas} eliminadas (retención ${dias} días).`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Falló la purga de notificaciones: ${(error as Error).message}`,
      );
    }
  }

  /**
   * HU-02 y HU-03: se descartan los tokens de recuperación ya vencidos o usados
   * y las revocaciones de sesión cuyo JWT venció por su cuenta —a partir de ahí
   * el token se rechaza por `exp` y recordar el bloqueo no aporta nada—, y
   * los refresh tokens vencidos (D-023).
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'purga-tokens' })
  async purgarTokens(): Promise<void> {
    try {
      const [recuperacion, revocados, refresh] = await Promise.all([
        this.tokenRecuperacionService.purgarVencidos(),
        this.tokenRevocadoService.purgarVencidos(),
        this.refreshTokenService.purgarVencidos(),
      ]);
      if (recuperacion > 0 || revocados > 0 || refresh > 0) {
        this.logger.log(
          `Purga de tokens: ${recuperacion} de recuperación, ${revocados} revocaciones, ${refresh} refresh.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Falló la purga de tokens: ${(error as Error).message}`,
      );
    }
  }

  /** HU-19: las lecturas crudas viejas se consolidan en promedios horarios. */
  @Cron(CronExpression.EVERY_DAY_AT_4AM, { name: 'consolidacion-lecturas' })
  async consolidarLecturas(): Promise<void> {
    try {
      const dias = this.leerEntero('LECTURAS_RETENCION_DIAS', 30);
      const { filasConsolidadas, filasBorradas } =
        await this.lecturasIotService.consolidarHistorico(dias);
      if (filasBorradas > 0) {
        this.logger.log(
          `Consolidación IoT: ${filasBorradas} lecturas crudas → ${filasConsolidadas} promedios horarios.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Falló la consolidación de lecturas: ${(error as Error).message}`,
      );
    }
  }

  private leerEntero(variable: string, porDefecto: number): number {
    const valor = parseInt(process.env[variable] ?? '', 10);
    return Number.isFinite(valor) && valor > 0 ? valor : porDefecto;
  }
}
