import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertaIot, EstadoAlerta, TipoAlerta } from './entities/alerta-iot.entity';
import { Sensor } from '../sensores/entities/sensor.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { RolNombre } from '../../common/enums/rol.enum';

interface GenerarAlertaParams {
  sensorId: string;
  tipoAlerta: TipoAlerta;
  valorLectura: number;
  umbralSuperado: number;
  timestampLectura: Date;
}

@Injectable()
export class AlertasIotService {
  constructor(
    @InjectRepository(AlertaIot)
    private readonly alertaRepository: Repository<AlertaIot>,
    @InjectRepository(Sensor)
    private readonly sensorRepository: Repository<Sensor>,
    private readonly usuariosService: UsuariosService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  findPendientes(): Promise<AlertaIot[]> {
    return this.alertaRepository.find({
      where: { estado: EstadoAlerta.PENDIENTE },
      relations: { sensor: true },
      order: { createdAt: 'DESC' },
    });
  }

  async generarAlerta(params: GenerarAlertaParams): Promise<AlertaIot> {
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

  async marcarRevisada(id: string, usuarioId: string): Promise<AlertaIot> {
    const alerta = await this.alertaRepository.findOne({ where: { id } });
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

    const destinatarios = await this.usuariosService.findByRolesInEmpresa(sensor.finca.empresaId, [
      RolNombre.PROPIETARIO,
      RolNombre.AGRONOMO,
    ]);

    const tipoTexto = alerta.tipoAlerta === TipoAlerta.UMBRAL_MAXIMO ? 'máximo' : 'mínimo';

    for (const destinatario of destinatarios) {
      await this.notificacionesService.crear({
        usuarioId: destinatario.id,
        tipo: 'alerta_iot',
        titulo: `Alerta en sensor ${sensor.codigo}`,
        descripcion: `El sensor ${sensor.codigo} superó el umbral ${tipoTexto} (valor: ${alerta.valorLectura}, umbral: ${alerta.umbralSuperado}).`,
        urlAccion: `/sensores/${sensor.id}/alertas`,
      });
    }
  }
}
