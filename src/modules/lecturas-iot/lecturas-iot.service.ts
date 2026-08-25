import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { LecturaIot } from './entities/lectura-iot.entity';
import { LecturaAnomala } from './entities/lectura-anomala.entity';
import { IngestLecturaDto } from './dto/ingest-lectura.dto';
import {
  Granularidad,
  ListarLecturasDto,
  SerieLecturasDto,
} from './dto/listar-lecturas.dto';
import {
  armarResultado,
  calcularPaginacion,
  ResultadoPaginado,
} from '../../common/dto/pagination-query.dto';
import {
  finDelDia,
  inicioDelDia,
  rangoDeFechas,
} from '../../common/fechas/rango-fechas';
import { SensoresService } from '../sensores/sensores.service';
import { Sensor } from '../sensores/entities/sensor.entity';
import { validarRangoFisico } from './rangos-fisicos';
import { UmbralSensorService } from '../umbral-sensor/umbral-sensor.service';
import { AlertasIotService } from '../alertas-iot/alertas-iot.service';
import { TipoAlerta } from '../alertas-iot/entities/alerta-iot.entity';
import {
  EVENTO_LECTURA_INGERIDA,
  LecturaIngeridaEvent,
} from './eventos/lectura-ingerida.event';

@Injectable()
export class LecturasIotService {
  private readonly logger = new Logger(LecturasIotService.name);

  constructor(
    @InjectRepository(LecturaIot)
    private readonly lecturaRepository: Repository<LecturaIot>,
    @InjectRepository(LecturaAnomala)
    private readonly anomalaRepository: Repository<LecturaAnomala>,
    private readonly sensoresService: SensoresService,
    private readonly umbralSensorService: UmbralSensorService,
    private readonly alertasIotService: AlertasIotService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Historial paginado de un sensor, con rango de fechas opcional (HU-19). */
  async findBySensor(
    sensorId: string,
    query: ListarLecturasDto = {},
  ): Promise<ResultadoPaginado<LecturaIot>> {
    const { page, pageSize, skip, take } = calcularPaginacion(query);

    const where: FindOptionsWhere<LecturaIot> = { sensorId };
    const rango = rangoDeFechas(query.desde, query.hasta);
    if (rango) {
      where.sensorTimestamp = rango;
    }

    const resultado = await this.lecturaRepository.findAndCount({
      where,
      order: { sensorTimestamp: 'DESC' },
      skip,
      take,
    });

    return armarResultado(resultado, page, pageSize);
  }

  /**
   * Serie agregada por hora o por día para el gráfico (HU-20).
   *
   * Se agrupa con `date_trunc` en la **zona horaria de la empresa** (HU-33): en
   * UTC, un día de Mendoza arrancaría a las 21:00 del día anterior y los
   * promedios diarios mezclarían dos jornadas distintas.
   */
  async serie(
    sensorId: string,
    query: SerieLecturasDto,
    zonaHoraria: string,
  ): Promise<{
    granularidad: Granularidad;
    zonaHoraria: string;
    puntos: Array<{
      periodo: Date;
      promedio: number;
      minimo: number;
      maximo: number;
      lecturas: number;
    }>;
  }> {
    const granularidad: Granularidad = query.granularidad ?? 'hora';

    const filas = await this.lecturaRepository.query<
      Array<{
        periodo: Date;
        promedio: string;
        minimo: string;
        maximo: string;
        lecturas: string;
      }>
    >(
      `SELECT date_trunc($2, l.sensor_timestamp AT TIME ZONE $3) AS periodo,
              AVG(l.valor)   AS promedio,
              MIN(l.valor)   AS minimo,
              MAX(l.valor)   AS maximo,
              COUNT(*)       AS lecturas
         FROM lecturas_iot l
        WHERE l.sensor_id = $1
          AND ($4::timestamptz IS NULL OR l.sensor_timestamp >= $4::timestamptz)
          AND ($5::timestamptz IS NULL OR l.sensor_timestamp <= $5::timestamptz)
        GROUP BY 1
        ORDER BY 1`,
      [
        sensorId,
        granularidad === 'dia' ? 'day' : 'hour',
        zonaHoraria,
        query.desde ? inicioDelDia(query.desde) : null,
        query.hasta ? finDelDia(query.hasta) : null,
      ],
    );

    return {
      granularidad,
      zonaHoraria,
      puntos: filas.map((f) => ({
        periodo: f.periodo,
        promedio: Math.round(Number(f.promedio) * 10000) / 10000,
        minimo: Number(f.minimo),
        maximo: Number(f.maximo),
        lecturas: Number(f.lecturas),
      })),
    };
  }

  /**
   * Consolida las lecturas crudas anteriores a `diasRetencion` en promedios
   * horarios y las borra (HU-19).
   *
   * `lecturas_iot` recibe una fila por sensor y por intervalo de muestreo: con
   * pocos sensores ya son cientos de miles de filas por temporada, y ninguna
   * consulta del sistema necesita el dato crudo de hace meses. Se agrega en SQL
   * y en una sola transacción para no dejar la tabla a medio consolidar.
   */
  async consolidarHistorico(diasRetencion = 30): Promise<{
    filasConsolidadas: number;
    filasBorradas: number;
  }> {
    const corte = new Date();
    corte.setDate(corte.getDate() - diasRetencion);

    return this.dataSource.transaction(async (manager) => {
      const insertadas = await manager.query<{ insertadas: string }[]>(
        `INSERT INTO lecturas_iot_historico (sensor_id, valor_promedio, unidad, fecha_hora)
         SELECT sensor_id,
                ROUND(AVG(valor), 4),
                MIN(unidad),
                date_trunc('hour', sensor_timestamp)
           FROM lecturas_iot
          WHERE sensor_timestamp < $1
          GROUP BY sensor_id, date_trunc('hour', sensor_timestamp)
        RETURNING 1 AS insertadas`,
        [corte],
      );

      const borradas = await manager.query<[unknown[], number]>(
        `DELETE FROM lecturas_iot WHERE sensor_timestamp < $1`,
        [corte],
      );

      return {
        filasConsolidadas: insertadas.length,
        filasBorradas: Array.isArray(borradas) ? (borradas[1] ?? 0) : 0,
      };
    });
  }

  /**
   * Ingesta de una lectura de telemetría (HU-19).
   *
   * Devuelve `{ estado: 'anomala' }` en vez de un 4xx cuando el valor cae
   * fuera del rango físico: el nodo ESP32 no puede hacer nada con un error, y
   * un reintento en bucle por una lectura que siempre va a estar fuera de rango
   * es peor que aceptarla y apartarla. Queda registrada para diagnóstico.
   */
  async ingest(dto: IngestLecturaDto): Promise<{
    estado: 'aceptada' | 'anomala';
    lectura?: LecturaIot;
    motivo?: string;
  }> {
    const sensor = await this.resolverSensor(dto);

    // Un sensor dado de baja fue retirado del campo o reemplazado: lo que llegue
    // con su identidad ya no representa a ese punto de medición.
    if (!sensor.activo) {
      throw new ForbiddenException(
        `El sensor ${sensor.codigo} está dado de baja y no acepta lecturas.`,
      );
    }

    const validacion = validarRangoFisico(sensor.tipo, dto.valor);
    if (!validacion.valida) {
      await this.anomalaRepository.save(
        this.anomalaRepository.create({
          sensorId: sensor.id,
          valor: dto.valor,
          unidad: dto.unidad,
          sensorTimestamp: new Date(dto.sensorTimestamp),
          motivo: validacion.motivo ?? 'Fuera del rango físico esperado.',
        }),
      );
      this.logger.warn(
        `Lectura anómala descartada del sensor ${sensor.codigo}: ${validacion.motivo}`,
      );
      return { estado: 'anomala', motivo: validacion.motivo };
    }

    const lectura = this.lecturaRepository.create({
      sensorId: sensor.id,
      valor: dto.valor,
      unidad: dto.unidad,
      sensorTimestamp: new Date(dto.sensorTimestamp),
    });
    const guardada = await this.lecturaRepository.save(lectura);

    // Fuera del camino de respuesta: al nodo ESP32 solo le importa que la
    // lectura se haya persistido. Evaluar umbrales acá sumaba a la latencia de
    // cada ingesta la consulta del umbral, el alta de la alerta y —una vez que
    // se sumen las notificaciones por mail de HU-22— el SMTP, sobre el endpoint
    // de mayor frecuencia del sistema y contra dispositivos con timeouts cortos.
    this.eventEmitter.emit(
      EVENTO_LECTURA_INGERIDA,
      new LecturaIngeridaEvent(sensor.id, dto.valor, guardada.sensorTimestamp),
    );

    return { estado: 'aceptada', lectura: guardada };
  }

  /**
   * Resuelve el sensor por código —el contrato documentado— o por UUID interno,
   * que se sigue aceptando por los dispositivos ya desplegados.
   */
  private async resolverSensor(dto: IngestLecturaDto): Promise<Sensor> {
    if (dto.codigoSensor) {
      return this.sensoresService.findByCodigo(dto.codigoSensor);
    }
    if (dto.sensorId) {
      return this.sensoresService.findById(dto.sensorId);
    }
    throw new BadRequestException(
      'Falta identificar el sensor: enviá `codigoSensor`.',
    );
  }

  /**
   * Se dispara por evento, no en línea. Absorbe sus propios errores: un fallo
   * evaluando el umbral no puede dejar sin persistir una lectura ya guardada,
   * y acá ya no hay nadie esperando la respuesta.
   */
  @OnEvent(EVENTO_LECTURA_INGERIDA, { async: true })
  async manejarLecturaIngerida(evento: LecturaIngeridaEvent): Promise<void> {
    try {
      await this.evaluarUmbral(
        evento.sensorId,
        evento.valor,
        evento.sensorTimestamp,
      );
    } catch (error) {
      this.logger.error(
        `Error evaluando umbrales del sensor ${evento.sensorId}: ${(error as Error).message}`,
      );
    }
  }

  private async evaluarUmbral(
    sensorId: string,
    valor: number,
    timestamp: Date,
  ): Promise<void> {
    const umbral = await this.umbralSensorService.findBySensor(sensorId);
    if (!umbral) {
      return;
    }

    if (umbral.umbralMinimo !== null && valor < Number(umbral.umbralMinimo)) {
      await this.alertasIotService.generarAlerta({
        sensorId,
        tipoAlerta: TipoAlerta.UMBRAL_MINIMO,
        valorLectura: valor,
        umbralSuperado: Number(umbral.umbralMinimo),
        timestampLectura: timestamp,
      });
      return;
    }

    if (umbral.umbralMaximo !== null && valor > Number(umbral.umbralMaximo)) {
      await this.alertasIotService.generarAlerta({
        sensorId,
        tipoAlerta: TipoAlerta.UMBRAL_MAXIMO,
        valorLectura: valor,
        umbralSuperado: Number(umbral.umbralMaximo),
        timestampLectura: timestamp,
      });
    }
  }
}
