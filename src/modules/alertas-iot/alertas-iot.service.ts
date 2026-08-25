import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import {
  AlertaIot,
  EstadoAlerta,
  TipoAlerta,
} from './entities/alerta-iot.entity';
import { Sensor } from '../sensores/entities/sensor.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { RolNombre } from '../../common/enums/rol.enum';
import { MailService } from '../../common/mail/mail.service';

interface GenerarAlertaParams {
  sensorId: string;
  tipoAlerta: TipoAlerta;
  valorLectura: number;
  umbralSuperado: number;
  timestampLectura: Date;
}

@Injectable()
export class AlertasIotService {
  private readonly logger = new Logger(AlertasIotService.name);

  constructor(
    @InjectRepository(AlertaIot)
    private readonly alertaRepository: Repository<AlertaIot>,
    @InjectRepository(Sensor)
    private readonly sensorRepository: Repository<Sensor>,
    private readonly usuariosService: UsuariosService,
    private readonly notificacionesService: NotificacionesService,
    private readonly mailService: MailService,
  ) {}

  /** Solo las alertas de sensores de la empresa del solicitante. */
  findPendientes(empresaId: string): Promise<AlertaIot[]> {
    return this.alertaRepository.find({
      where: {
        estado: EstadoAlerta.PENDIENTE,
        sensor: { finca: { empresaId } },
      },
      relations: { sensor: { finca: true } },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Genera una alerta por umbral superado, con deduplicación (HU-22).
   *
   * Un sensor que mide cada 5 minutos y queda fuera de umbral toda una noche
   * generaba ~100 alertas idénticas y otras tantas notificaciones y correos.
   * Se emite **una por sensor, tipo y ventana**; pasada la ventana, si la
   * condición persiste, se emite una nueva —que es la señal de que el problema
   * sigue—.
   *
   * Devuelve `null` cuando la alerta se suprimió por duplicada.
   */
  async generarAlerta(params: GenerarAlertaParams): Promise<AlertaIot | null> {
    const duplicada = await this.existeAlertaReciente(
      params.sensorId,
      params.tipoAlerta,
    );
    if (duplicada) {
      this.logger.debug(
        `Alerta ${params.tipoAlerta} del sensor ${params.sensorId} suprimida: ya hay una sin revisar en la ventana.`,
      );
      return null;
    }

    const alerta = this.alertaRepository.create({
      sensorId: params.sensorId,
      tipoAlerta: params.tipoAlerta,
      valorLectura: params.valorLectura,
      umbralSuperado: params.umbralSuperado,
      timestampLectura: params.timestampLectura,
      estado: EstadoAlerta.PENDIENTE,
    });
    const guardada = await this.alertaRepository.save(alerta);

    await this.notificarUsuarios(guardada);

    return guardada;
  }

  /**
   * ¿Hay una alerta **sin revisar** del mismo sensor y tipo dentro de la
   * ventana? Se exige que esté sin revisar a propósito: si alguien ya la
   * revisó, una nueva ocurrencia es información nueva.
   */
  private existeAlertaReciente(
    sensorId: string,
    tipoAlerta: TipoAlerta,
  ): Promise<boolean> {
    const desde = new Date(Date.now() - this.ventanaDedupMs());
    return this.alertaRepository.exists({
      where: {
        sensorId,
        tipoAlerta,
        estado: EstadoAlerta.PENDIENTE,
        createdAt: MoreThanOrEqual(desde),
      },
    });
  }

  /** Configurable por entorno, como pide HU-22. Por defecto, 1 hora. */
  private ventanaDedupMs(): number {
    const minutos = parseInt(
      process.env.ALERTAS_VENTANA_DEDUP_MINUTOS ?? '',
      10,
    );
    return (Number.isFinite(minutos) && minutos > 0 ? minutos : 60) * 60_000;
  }

  async marcarRevisada(
    id: string,
    usuarioId: string,
    empresaId: string,
  ): Promise<AlertaIot> {
    const alerta = await this.alertaRepository.findOne({
      where: { id, sensor: { finca: { empresaId } } },
      relations: { sensor: { finca: true } },
    });
    if (!alerta) {
      throw new NotFoundException('Alerta no encontrada');
    }
    alerta.estado = EstadoAlerta.REVISADA;
    alerta.revisadaPorId = usuarioId;
    alerta.revisadaAt = new Date();
    return this.alertaRepository.save(alerta);
  }

  private async notificarUsuarios(alerta: AlertaIot): Promise<void> {
    const sensor = await this.sensorRepository.findOne({
      where: { id: alerta.sensorId },
      relations: { finca: true },
    });
    if (!sensor) {
      return;
    }

    // Destinatarios de **la finca afectada** (HU-22), no de toda la empresa.
    // Quien no tenga asignación explícita recibe los avisos de todas, para que
    // el sistema no deje de notificar mientras nadie configure nada.
    const destinatarios = await this.usuariosService.findDestinatariosDeFinca(
      sensor.finca.empresaId,
      sensor.fincaId,
      [RolNombre.PROPIETARIO, RolNombre.AGRONOMO],
    );

    const tipoTexto =
      alerta.tipoAlerta === TipoAlerta.UMBRAL_MAXIMO ? 'máximo' : 'mínimo';

    const descripcion = `El sensor ${sensor.codigo} superó el umbral ${tipoTexto} (valor: ${alerta.valorLectura}, umbral: ${alerta.umbralSuperado}).`;
    const enlace = `${process.env.APP_URL ?? 'http://localhost:5173'}/sensores/${sensor.id}/telemetria`;

    for (const destinatario of destinatarios) {
      await this.notificacionesService.crear({
        usuarioId: destinatario.id,
        tipo: 'alerta_iot',
        titulo: `Alerta en sensor ${sensor.codigo}`,
        descripcion,
        urlAccion: `/sensores/${sensor.id}/alertas`,
      });
    }

    if (destinatarios.length === 0) return;

    // Un solo correo a todos: el asunto y el cuerpo son idénticos, y mandar N
    // mensajes iguales multiplica el riesgo de que el SMTP nos marque spam.
    await this.mailService.enviar(
      {
        para: destinatarios.map((d) => d.email),
        asunto: `[ALERTA] Sensor ${sensor.codigo} - ${sensor.finca.nombre}`,
        texto: [
          descripcion,
          '',
          `Finca: ${sensor.finca.nombre}`,
          `Tipo de sensor: ${sensor.tipo}`,
          `Momento de la lectura: ${alerta.timestampLectura.toISOString()}`,
          '',
          `Ver la telemetría del sensor: ${enlace}`,
        ].join('\n'),
      },
      sensor.finca.empresaId,
    );
  }
}
