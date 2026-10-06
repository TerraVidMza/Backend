import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sensor } from './entities/sensor.entity';
import { CreateSensorDto } from './dto/create-sensor.dto';
import { UpdateSensorDto } from './dto/update-sensor.dto';
import { DynsecService, topicoDeLecturas } from '../mqtt/dynsec.service';

@Injectable()
export class SensoresService {
  private readonly logger = new Logger(SensoresService.name);

  constructor(
    @InjectRepository(Sensor)
    private readonly sensorRepository: Repository<Sensor>,
    private readonly dynsec: DynsecService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Sensores de la finca **con su última lectura** (HU-18).
   *
   * La última lectura es el dato central de la pantalla —es lo que dice si el
   * sensor está vivo y qué está midiendo—. Sin esto el cliente tenía que pedir
   * el historial de cada sensor por separado: un N+1 en el front sobre la tabla
   * más grande del sistema.
   *
   * Se resuelve con un `DISTINCT ON` que aprovecha el índice
   * `(sensor_id, sensor_timestamp)`, en una sola consulta para todos.
   */
  async findByFinca(fincaId: string): Promise<
    Array<
      Sensor & {
        ultimaLectura: {
          valor: number;
          unidad: string;
          sensorTimestamp: Date;
        } | null;
      }
    >
  > {
    const sensores = await this.sensorRepository.find({
      where: { fincaId },
      order: { codigo: 'ASC' },
    });
    if (sensores.length === 0) return [];

    const ultimas = await this.sensorRepository.query<
      Array<{
        sensor_id: string;
        valor: string;
        unidad: string;
        sensor_timestamp: Date;
      }>
    >(
      `SELECT DISTINCT ON (l.sensor_id)
              l.sensor_id, l.valor, l.unidad, l.sensor_timestamp
         FROM lecturas_iot l
        WHERE l.sensor_id = ANY($1::uuid[])
        ORDER BY l.sensor_id, l.sensor_timestamp DESC`,
      [sensores.map((s) => s.id)],
    );

    const porSensor = new Map(ultimas.map((u) => [u.sensor_id, u]));

    return sensores.map((sensor) => {
      const ultima = porSensor.get(sensor.id);
      return Object.assign(sensor, {
        ultimaLectura: ultima
          ? {
              valor: Number(ultima.valor),
              unidad: ultima.unidad,
              sensorTimestamp: ultima.sensor_timestamp,
            }
          : null,
      });
    });
  }

  async findById(id: string): Promise<Sensor> {
    const sensor = await this.sensorRepository.findOne({ where: { id } });
    if (!sensor) {
      throw new NotFoundException('Sensor no encontrado');
    }
    return sensor;
  }

  /** Búsqueda por la etiqueta física del sensor, que es lo que manda el nodo. */
  async findByCodigo(codigo: string): Promise<Sensor> {
    const sensor = await this.sensorRepository.findOne({ where: { codigo } });
    if (!sensor) {
      throw new NotFoundException(`No existe un sensor con código ${codigo}`);
    }
    return sensor;
  }

  async create(dto: CreateSensorDto): Promise<Sensor> {
    await this.verificarCodigoLibre(dto.codigo);
    const sensor = this.sensorRepository.create({ ...dto, activo: true });
    return this.sensorRepository.save(sensor);
  }

  async update(id: string, dto: UpdateSensorDto): Promise<Sensor> {
    const sensor = await this.findById(id);
    const codigoAnterior = sensor.codigo;
    // El `update` no revalidaba la unicidad: se podía renombrar un sensor al
    // código de otro y romper la ingesta por código de HU-19.
    if (dto.codigo && dto.codigo !== sensor.codigo) {
      await this.verificarCodigoLibre(dto.codigo);
    }
    Object.assign(sensor, dto);
    const guardado = await this.sensorRepository.save(sensor);
    // La credencial MQTT es el código: renombrar deja la vieja sin uso y hay
    // que generar una nueva (D-026).
    if (codigoAnterior !== guardado.codigo) {
      await this.alBroker((d) => d.eliminar(codigoAnterior));
    }
    return guardado;
  }

  /**
   * Genera (o regenera) la credencial MQTT del sensor (D-026). La contraseña
   * se devuelve una sola vez, para cargarla en el dispositivo.
   */
  async credencialMqtt(id: string): Promise<{
    broker: string | null;
    usuario: string;
    password: string;
    topico: string;
  }> {
    const sensor = await this.findById(id);
    if (!sensor.activo) {
      throw new ConflictException(
        `El sensor ${sensor.codigo} está dado de baja: no se le generan credenciales.`,
      );
    }
    const password = await this.dynsec.crearCredencial(sensor.codigo);
    return {
      broker: this.config.get<string>('MQTT_URL_PUBLICA') ?? null,
      usuario: sensor.codigo,
      password,
      topico: topicoDeLecturas(sensor.codigo),
    };
  }

  /**
   * Cambios en el broker que no pueden frenar la operación principal: si el
   * broker no está o no responde, se registra y el ABM sigue.
   */
  private async alBroker(
    accion: (dynsec: DynsecService) => Promise<void>,
  ): Promise<void> {
    if (!this.dynsec.habilitado) return;
    try {
      await accion(this.dynsec);
    } catch (error) {
      this.logger.warn(
        `No se pudo actualizar el broker MQTT: ${(error as Error).message}`,
      );
    }
  }

  /** 409 y no 400: el código es válido, lo que falla es que ya está tomado. */
  private async verificarCodigoLibre(codigo: string): Promise<void> {
    const existente = await this.sensorRepository.exists({ where: { codigo } });
    if (existente) {
      throw new ConflictException(
        `Ya existe un sensor con el código ${codigo}`,
      );
    }
  }

  async desactivar(id: string): Promise<Sensor> {
    const sensor = await this.findById(id);
    sensor.activo = false;
    const guardado = await this.sensorRepository.save(sensor);
    // Un sensor dado de baja deja de poder conectarse al broker (D-026).
    await this.alBroker((d) => d.deshabilitar(sensor.codigo));
    return guardado;
  }
}
