import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Cuartel } from '../cuarteles/entities/cuartel.entity';
import { Sensor, SensorTipo } from '../sensores/entities/sensor.entity';
import { LecturaIot } from '../lecturas-iot/entities/lectura-iot.entity';
import { AlertaIot } from '../alertas-iot/entities/alerta-iot.entity';
import { RegistroLabor } from '../registro-labor/entities/registro-labor.entity';
import { DetalleInsumoLabor } from '../registro-labor/entities/detalle-insumo-labor.entity';
import { PesajeVendimia } from '../pesaje-vendimia/entities/pesaje-vendimia.entity';
import { LiquidacionBodega } from '../remitos/entities/liquidacion-bodega.entity';
import { EstadoSync } from '../../common/enums/estado-sync.enum';

export interface SerieDiaria {
  fecha: string;
  valor: number;
}

/** Un extremo de la comparación de HU-31: campaña cargada o rango ad-hoc. */
export interface RangoComparacion {
  campaniaId?: string;
  desde?: string;
  hasta?: string;
}

/**
 * Variables IoT que HU-31 pide promediar entre campañas, y cómo se agregan.
 *
 * La lluvia se **suma** y el resto se promedia: los milímetros caídos son un
 * acumulado del período, y promediarlos daría "mm por lectura", que no
 * significa nada agronómicamente.
 */
const AGREGACION_IOT: Partial<Record<SensorTipo, 'promedio' | 'total'>> = {
  [SensorTipo.TEMPERATURA]: 'promedio',
  [SensorTipo.HUMEDAD_SUELO]: 'promedio',
  [SensorTipo.HUMEDAD_AMBIENTE]: 'promedio',
  [SensorTipo.PLUVIOMETRO]: 'total',
};

/**
 * Mínimo de pares (días con dato en ambas series) para calcular la correlación.
 * HU-29 lo fija en 7 para tener significancia estadística básica.
 */
const MINIMO_PARES_CORRELACION = 7;

import { ConfiguracionService } from '../configuracion/configuracion.service';
import { CampaniasService } from '../campanias/campanias.service';
import { fechaLocal } from '../../common/fechas/rango-fechas';
import {
  Recomendacion,
  EstadoRecomendacion,
} from './entities/recomendacion.entity';
import {
  ALERTAS_RECURRENTES_MINIMO,
  ALERTAS_VENTANA_DIAS,
  DIAS_MINIMOS_HISTORICO,
  DefinicionRegla,
  FACTOR_COSTO_DESVIADO,
  HUMEDAD_SUELO_MINIMA,
  REGLAS_AGRONOMICAS,
  SIN_LABORES_DIAS,
} from './reglas-agronomicas';

/** Regla disparada durante la evaluación, antes de persistirse. */
interface RecomendacionDetectada {
  regla: DefinicionRegla;
  patronDetectado: string;
  accionSugerida: string;
  evidencia: Record<string, unknown>;
}

@Injectable()
export class InteligenciaAgronomicaService {
  constructor(
    @InjectRepository(Cuartel)
    private readonly cuartelRepository: Repository<Cuartel>,
    @InjectRepository(Sensor)
    private readonly sensorRepository: Repository<Sensor>,
    @InjectRepository(LecturaIot)
    private readonly lecturaRepository: Repository<LecturaIot>,
    @InjectRepository(AlertaIot)
    private readonly alertaRepository: Repository<AlertaIot>,
    @InjectRepository(RegistroLabor)
    private readonly registroLaborRepository: Repository<RegistroLabor>,
    @InjectRepository(DetalleInsumoLabor)
    private readonly detalleInsumoLaborRepository: Repository<DetalleInsumoLabor>,
    @InjectRepository(PesajeVendimia)
    private readonly pesajeRepository: Repository<PesajeVendimia>,
    @InjectRepository(LiquidacionBodega)
    private readonly liquidacionRepository: Repository<LiquidacionBodega>,
    @InjectRepository(Recomendacion)
    private readonly recomendacionRepository: Repository<Recomendacion>,
    private readonly configuracionService: ConfiguracionService,
    private readonly campaniasService: CampaniasService,
  ) {}

  private getZonaHoraria(empresaId: string): Promise<string> {
    return this.configuracionService.getZonaHoraria(empresaId);
  }

  async correlacionSensorCostos(
    cuartelId: string,
    sensorId: string,
    desde: string,
    hasta: string,
    empresaId: string,
  ) {
    const cuartel = await this.cuartelRepository.findOne({
      where: { id: cuartelId },
    });
    if (!cuartel) {
      throw new NotFoundException('Cuartel no encontrado');
    }
    const sensor = await this.sensorRepository.findOne({
      where: { id: sensorId },
    });
    if (!sensor) {
      throw new NotFoundException('Sensor no encontrado');
    }

    // Las dos series tienen que estar en el mismo huso o los pares no se
    // corresponden: la de costos viene de una columna `date` ya local.
    const zonaHoraria =
      await this.configuracionService.getZonaHoraria(empresaId);
    const serieSensor = await this.getSerieDiariaSensor(
      sensorId,
      desde,
      hasta,
      zonaHoraria,
    );
    const serieCosto = await this.getSerieDiariaCosto(cuartelId, desde, hasta);

    const fechasComunes = serieSensor
      .map((s) => s.fecha)
      .filter((fecha) => serieCosto.some((c) => c.fecha === fecha));

    const valoresSensor = fechasComunes.map(
      (f) => serieSensor.find((s) => s.fecha === f)!.valor,
    );
    const valoresCosto = fechasComunes.map(
      (f) => serieCosto.find((c) => c.fecha === f)!.valor,
    );

    const coeficienteCorrelacion = this.pearson(valoresSensor, valoresCosto);
    const datosSuficientes = fechasComunes.length >= MINIMO_PARES_CORRELACION;

    return {
      sensor: { id: sensor.id, codigo: sensor.codigo, tipo: sensor.tipo },
      serieSensor,
      serieCosto,
      diasConDatosEnComun: fechasComunes.length,
      diasRequeridos: MINIMO_PARES_CORRELACION,
      datosSuficientes,
      coeficienteCorrelacion,
      interpretacion: this.interpretarCorrelacion(coeficienteCorrelacion),
      // El backend emite el mensaje para que el front no tenga que duplicar el
      // umbral ni redactar el texto por su cuenta.
      mensaje: datosSuficientes
        ? null
        : `No hay suficientes datos para calcular la correlación. Se necesitan al menos ${MINIMO_PARES_CORRELACION} días con datos de sensores y costos registrados para el cuartel seleccionado.`,
    };
  }

  /**
   * Recomendaciones activas del cuartel, evaluando el catálogo de reglas (HU-30).
   *
   * Consultar la pantalla **genera** las recomendaciones que correspondan y las
   * persiste, para que puedan marcarse como Aplicada o Descartada. Antes se
   * calculaban al vuelo y no tenían `id`: no había a qué apuntarle.
   *
   * Reevaluar no duplica: un índice parcial garantiza una sola recomendación
   * *activa* por regla y cuartel. Una regla ya resuelta puede volver a generarse
   * si las condiciones se repiten, tal como pide la HU.
   */
  async getRecomendaciones(cuartelId: string, empresaId: string) {
    const cuartel = await this.cuartelRepository.findOne({
      where: { id: cuartelId },
    });
    if (!cuartel) {
      throw new NotFoundException('Cuartel no encontrado');
    }

    const zonaHoraria = await this.getZonaHoraria(empresaId);
    const diasConDatos = await this.contarDiasConDatos(cuartel, zonaHoraria);
    if (diasConDatos < DIAS_MINIMOS_HISTORICO) {
      const diasFaltantes = DIAS_MINIMOS_HISTORICO - diasConDatos;
      return {
        disponible: false,
        diasConDatos,
        diasMinimos: DIAS_MINIMOS_HISTORICO,
        diasFaltantes,
        mensaje: `Faltan ${diasFaltantes} día(s) de datos para generar recomendaciones para este cuartel. Las recomendaciones estarán disponibles cuando se acumulen suficientes datos históricos.`,
        recomendaciones: [],
      };
    }

    const detectadas = await this.evaluarReglas(cuartel, zonaHoraria);
    await this.persistirRecomendaciones(cuartelId, detectadas);

    const recomendaciones = await this.recomendacionRepository.find({
      where: { cuartelId, estado: EstadoRecomendacion.ACTIVA },
      order: { createdAt: 'DESC' },
    });

    return {
      disponible: true,
      diasConDatos,
      diasMinimos: DIAS_MINIMOS_HISTORICO,
      diasFaltantes: 0,
      mensaje:
        recomendaciones.length === 0
          ? 'No se detectaron novedades relevantes para este cuartel en el período reciente.'
          : null,
      recomendaciones,
    };
  }

  /**
   * Marca una recomendación como Aplicada o Descartada (HU-30).
   *
   * Solo se resuelven las **activas**: reescribir el estado de una ya resuelta
   * perdería quién y cuándo la resolvió, que es el dato que le da valor al
   * registro.
   */
  async resolverRecomendacion(
    id: string,
    empresaId: string,
    estado: EstadoRecomendacion.APLICADA | EstadoRecomendacion.DESCARTADA,
    nota: string | undefined,
    usuarioId: string,
  ): Promise<Recomendacion> {
    const recomendacion = await this.recomendacionRepository.findOne({
      where: { id, cuartel: { finca: { empresaId } } },
      relations: { cuartel: { finca: true } },
    });
    if (!recomendacion) {
      throw new NotFoundException('Recomendación no encontrada');
    }
    if (recomendacion.estado !== EstadoRecomendacion.ACTIVA) {
      throw new ConflictException(
        `La recomendación ya fue marcada como ${recomendacion.estado}.`,
      );
    }

    recomendacion.estado = estado;
    recomendacion.nota = nota ?? null;
    recomendacion.resueltaPorId = usuarioId;
    recomendacion.timestampEstado = new Date();
    return this.recomendacionRepository.save(recomendacion);
  }

  /**
   * Días distintos con dato para el cuartel, contando tanto labores como
   * lecturas de los sensores de su finca.
   *
   * Son **días con dato** y no días transcurridos desde el alta: un cuartel
   * creado hace un año pero sin registros no tiene histórico que analizar, y la
   * barra de progreso de la HU quedaría llena mintiendo.
   */
  private async contarDiasConDatos(
    cuartel: Cuartel,
    zonaHoraria: string,
  ): Promise<number> {
    const filas = await this.registroLaborRepository.query<
      Array<{ dias: string }>
    >(
      `SELECT COUNT(*) AS dias
         FROM (
           SELECT rl.fecha AS dia
             FROM registro_labor rl
            WHERE rl.cuartel_id = $1
              AND rl.estado_sync = $3
           UNION
           SELECT (l.sensor_timestamp AT TIME ZONE $4)::date AS dia
             FROM lecturas_iot l
             JOIN sensores s ON s.id = l.sensor_id
            WHERE s.finca_id = $2
         ) d`,
      [cuartel.id, cuartel.fincaId, EstadoSync.SINCRONIZADO, zonaHoraria],
    );
    return Number(filas[0]?.dias ?? 0);
  }

  private async evaluarReglas(
    cuartel: Cuartel,
    zonaHoraria: string,
  ): Promise<RecomendacionDetectada[]> {
    const detectadas: RecomendacionDetectada[] = [];

    // R1 — humedad de suelo baja sostenida. Es la regla que la HU da de ejemplo.
    const desde = fechaLocal(
      new Date(Date.now() - DIAS_MINIMOS_HISTORICO * 24 * 60 * 60 * 1000),
    );
    const humedad = await this.lecturaRepository.query<
      Array<{ promedio: string | null; lecturas: string }>
    >(
      `SELECT AVG(l.valor) AS promedio, COUNT(*) AS lecturas
         FROM lecturas_iot l
         JOIN sensores s ON s.id = l.sensor_id
        WHERE s.finca_id = $1
          AND s.tipo = $2
          AND (l.sensor_timestamp AT TIME ZONE $4)::date >= $3::date`,
      [cuartel.fincaId, SensorTipo.HUMEDAD_SUELO, desde, zonaHoraria],
    );
    const promedioHumedad = humedad[0]?.promedio;
    if (promedioHumedad !== null && promedioHumedad !== undefined) {
      const valor = Number(promedioHumedad);
      if (valor < HUMEDAD_SUELO_MINIMA) {
        detectadas.push({
          regla: REGLAS_AGRONOMICAS.humedad_suelo_baja,
          patronDetectado: `La humedad de suelo promedió ${valor.toFixed(1)} % en los últimos ${DIAS_MINIMOS_HISTORICO} días, por debajo del ${HUMEDAD_SUELO_MINIMA} % de referencia.`,
          accionSugerida:
            'Revisar la programación de riego del cuartel antes de sumar labores de recuperación, que son más caras que corregir la frecuencia.',
          evidencia: {
            promedio: Math.round(valor * 100) / 100,
            umbral: HUMEDAD_SUELO_MINIMA,
            lecturas: Number(humedad[0]?.lecturas ?? 0),
          },
        });
      }
    }

    // R2 — alertas IoT recurrentes en la finca.
    const sensores = await this.sensorRepository.find({
      where: { fincaId: cuartel.fincaId, activo: true },
      select: { id: true },
    });
    if (sensores.length > 0) {
      const desdeAlertas = new Date(
        Date.now() - ALERTAS_VENTANA_DIAS * 24 * 60 * 60 * 1000,
      );
      const alertas = await this.alertaRepository
        .createQueryBuilder('a')
        .where('a.sensor_id IN (:...sensorIds)', {
          sensorIds: sensores.map((s) => s.id),
        })
        .andWhere('a.created_at >= :desde', { desde: desdeAlertas })
        .getCount();

      if (alertas >= ALERTAS_RECURRENTES_MINIMO) {
        detectadas.push({
          regla: REGLAS_AGRONOMICAS.alerta_iot_recurrente,
          patronDetectado: `Se registraron ${alertas} alertas de sensores en los últimos ${ALERTAS_VENTANA_DIAS} días.`,
          accionSugerida:
            'Inspeccionar el cuartel y revisar riego o protección según el tipo de sensor afectado. Si las lecturas son correctas, revisar el umbral configurado.',
          evidencia: { alertas, ventanaDias: ALERTAS_VENTANA_DIAS },
        });
      }
    }

    // R3 — sin labores recientes.
    const desdeLabores = fechaLocal(
      new Date(Date.now() - SIN_LABORES_DIAS * 24 * 60 * 60 * 1000),
    );
    const labores = await this.registroLaborRepository
      .createQueryBuilder('r')
      .where('r.cuartel_id = :cuartelId', { cuartelId: cuartel.id })
      .andWhere('r.fecha >= :desde', { desde: desdeLabores })
      .getCount();
    if (labores === 0) {
      detectadas.push({
        regla: REGLAS_AGRONOMICAS.sin_labores_recientes,
        patronDetectado: `No se registraron labores en este cuartel durante los últimos ${SIN_LABORES_DIAS} días.`,
        accionSugerida:
          'Verificar si corresponde planificar una labor de mantenimiento, o si hay partes del dispositivo móvil sin sincronizar.',
        evidencia: { dias: SIN_LABORES_DIAS },
      });
    }

    // R4 — costo por hectárea desviado del resto de la finca.
    const desvio = await this.getDesvioCostoPorHa(cuartel);
    if (desvio) {
      detectadas.push({
        regla: REGLAS_AGRONOMICAS.costo_por_ha_desviado,
        patronDetectado: `El costo por hectárea del cuartel (${desvio.costoPorHa.toFixed(2)}) supera ${FACTOR_COSTO_DESVIADO}× la mediana del resto de la finca (${desvio.mediana.toFixed(2)}).`,
        accionSugerida:
          'Revisar las labores e insumos cargados en el cuartel: comparte clima, suelo y cuadrillas con el resto de la finca, así que el desvío suele ser un error de carga o una intervención no planificada.',
        evidencia: desvio,
      });
    }

    return detectadas;
  }

  /**
   * Costo por hectárea del cuartel contra la **mediana** del resto de la finca.
   *
   * Mediana y no promedio: con pocos cuarteles, uno solo muy caro arrastra el
   * promedio y termina ocultando el desvío que se busca detectar.
   */
  private async getDesvioCostoPorHa(
    cuartel: Cuartel,
  ): Promise<{ costoPorHa: number; mediana: number; factor: number } | null> {
    const filas = await this.registroLaborRepository.query<
      Array<{ cuartelId: string; costoPorHa: string }>
    >(
      `SELECT c.id AS "cuartelId",
              (COALESCE(SUM(rl.cantidad * COALESCE(rl.costo_unitario_al_sync, 0)), 0)
                 / NULLIF(c.hectareas, 0)) AS "costoPorHa"
         FROM cuarteles c
         LEFT JOIN registro_labor rl
                ON rl.cuartel_id = c.id
               AND rl.estado_sync = $2
        WHERE c.finca_id = $1
          AND c.activo = true
          AND c.hectareas > 0
        GROUP BY c.id, c.hectareas`,
      [cuartel.fincaId, EstadoSync.SINCRONIZADO],
    );

    const propio = filas.find((f) => f.cuartelId === cuartel.id);
    const otros = filas
      .filter((f) => f.cuartelId !== cuartel.id && f.costoPorHa !== null)
      .map((f) => Number(f.costoPorHa))
      .sort((a, b) => a - b);

    // Con menos de tres cuarteles de referencia la mediana no dice nada: un
    // único vecino convierte cualquier diferencia en un "desvío".
    if (!propio || propio.costoPorHa === null || otros.length < 3) {
      return null;
    }

    const medio = Math.floor(otros.length / 2);
    const mediana =
      otros.length % 2 === 0
        ? (otros[medio - 1] + otros[medio]) / 2
        : otros[medio];

    const costoPorHa = Number(propio.costoPorHa);
    if (mediana <= 0 || costoPorHa <= mediana * FACTOR_COSTO_DESVIADO) {
      return null;
    }

    return {
      costoPorHa: Math.round(costoPorHa * 100) / 100,
      mediana: Math.round(mediana * 100) / 100,
      factor: Math.round((costoPorHa / mediana) * 100) / 100,
    };
  }

  /**
   * Inserta las detectadas que todavía no tienen una recomendación activa.
   *
   * `orIgnore()` se apoya en el índice parcial: dos requests concurrentes sobre
   * la misma pantalla no pueden crear duplicados, y no hace falta serializar.
   */
  private async persistirRecomendaciones(
    cuartelId: string,
    detectadas: RecomendacionDetectada[],
  ): Promise<void> {
    if (detectadas.length === 0) return;

    await this.recomendacionRepository
      .createQueryBuilder()
      .insert()
      .into(Recomendacion)
      .values(
        // El cast es por el `jsonb`: TypeORM descompone el tipo de la columna en
        // un `DeepPartial` recursivo y un `Record<string, unknown>` deja de
        // encajar. El valor que se inserta es el correcto.
        detectadas.map((d) => ({
          cuartelId,
          reglaId: d.regla.id,
          variable: d.regla.variable,
          severidad: d.regla.severidad,
          patronDetectado: d.patronDetectado,
          accionSugerida: d.accionSugerida,
          evidencia: d.evidencia,
          estado: EstadoRecomendacion.ACTIVA,
        })) as unknown as QueryDeepPartialEntity<Recomendacion>[],
      )
      .orIgnore()
      .execute();
  }

  /**
   * Comparación entre dos campañas (HU-31).
   *
   * Los períodos se identifican por **id de campaña** (`D-014`). Antes el
   * cliente mandaba cuatro fechas sueltas, así que dos pantallas podían comparar
   * "la campaña 2025" con recortes distintos y nadie lo notaba. Se siguen
   * aceptando fechas explícitas para comparaciones ad-hoc que no coinciden con
   * ninguna campaña cargada.
   */
  async compararCampanias(
    cuartelId: string,
    empresaId: string,
    periodos: { a: RangoComparacion; b: RangoComparacion },
  ) {
    const cuartel = await this.cuartelRepository.findOne({
      where: { id: cuartelId },
    });
    if (!cuartel) {
      throw new NotFoundException('Cuartel no encontrado');
    }

    const [rango1, rango2] = await Promise.all([
      this.resolverRango(periodos.a, empresaId),
      this.resolverRango(periodos.b, empresaId),
    ]);

    const zonaHoraria = await this.getZonaHoraria(empresaId);
    const [periodo1, periodo2] = await Promise.all([
      this.getIndicadoresPeriodo(
        cuartel,
        rango1.desde,
        rango1.hasta,
        zonaHoraria,
      ),
      this.getIndicadoresPeriodo(
        cuartel,
        rango2.desde,
        rango2.hasta,
        zonaHoraria,
      ),
    ]);

    // El margen solo se compara si las DOS campañas tienen liquidaciones: variar
    // contra un período sin ingreso cargado daría −100 % y se leería como una
    // caída real en vez de como un dato que falta.
    const margenComparable =
      periodo1.margenBrutoDisponible && periodo2.margenBrutoDisponible;

    return {
      periodo1: { ...rango1, ...periodo1 },
      periodo2: { ...rango2, ...periodo2 },
      variaciones: {
        kgCosechados: this.variacionPorcentual(
          periodo1.kgCosechados,
          periodo2.kgCosechados,
        ),
        costoLabores: this.variacionPorcentual(
          periodo1.costoLabores,
          periodo2.costoLabores,
        ),
        costoInsumos: this.variacionPorcentual(
          periodo1.costoInsumos,
          periodo2.costoInsumos,
        ),
        costoTotal: this.variacionPorcentual(
          periodo1.costoTotal,
          periodo2.costoTotal,
        ),
        costoPorHa:
          periodo1.costoPorHa !== null && periodo2.costoPorHa !== null
            ? this.variacionPorcentual(periodo1.costoPorHa, periodo2.costoPorHa)
            : null,
        ingresos: margenComparable
          ? this.variacionPorcentual(periodo1.ingresos, periodo2.ingresos)
          : null,
        margenBruto:
          margenComparable &&
          periodo1.margenBruto !== null &&
          periodo2.margenBruto !== null
            ? this.variacionPorcentual(
                periodo1.margenBruto,
                periodo2.margenBruto,
              )
            : null,
      },
      // Permite al front pintar verde/rojo sin duplicar la semántica: en los
      // costos, subir es deterioro; en los kilos cosechados, mejora.
      sentidoIndicadores: {
        kgCosechados: 'mayor_es_mejor',
        costoLabores: 'menor_es_mejor',
        costoInsumos: 'menor_es_mejor',
        costoTotal: 'menor_es_mejor',
        costoPorHa: 'menor_es_mejor',
        ingresos: 'mayor_es_mejor',
        margenBruto: 'mayor_es_mejor',
      },
      mensaje: !periodo1.tieneDatos
        ? `El período ${rango1.desde} — ${rango1.hasta} no tiene registros completos para este cuartel.`
        : !periodo2.tieneDatos
          ? `El período ${rango2.desde} — ${rango2.hasta} no tiene registros completos para este cuartel.`
          : null,
    };
  }

  /** Campaña por id, o el par de fechas sueltas si vino una comparación ad-hoc. */
  private async resolverRango(
    rango: RangoComparacion,
    empresaId: string,
  ): Promise<{
    desde: string;
    hasta: string;
    campaniaId: string | null;
    nombre: string | null;
  }> {
    if (rango.campaniaId) {
      return this.campaniasService.getRango(rango.campaniaId, empresaId);
    }
    if (!rango.desde || !rango.hasta) {
      throw new BadRequestException(
        'Cada período necesita una campaña (`campaniaA`/`campaniaB`) o el par `desde`/`hasta`.',
      );
    }
    return {
      desde: rango.desde,
      hasta: rango.hasta,
      campaniaId: null,
      nombre: null,
    };
  }

  private async getIndicadoresPeriodo(
    cuartel: Cuartel,
    desde: string,
    hasta: string,
    zonaHoraria: string,
  ) {
    const cuartelId = cuartel.id;
    const registros = await this.registroLaborRepository.find({
      where: {
        cuartelId,
        fecha: Between(desde, hasta),
        estadoSync: EstadoSync.SINCRONIZADO,
      },
    });
    const costoLabores = registros.reduce(
      (acc, r) => acc + Number(r.cantidad) * Number(r.costoUnitarioAlSync ?? 0),
      0,
    );

    const registroIds = registros.map((r) => r.id);
    let costoInsumos = 0;
    if (registroIds.length > 0) {
      const detalles = await this.detalleInsumoLaborRepository.find({
        where: { registroLaborId: In(registroIds) },
      });
      costoInsumos = detalles.reduce(
        (acc, d) =>
          acc + Number(d.cantidadUsada) * Number(d.costoUnitarioAlSync ?? 0),
        0,
      );
    }

    const pesajes = await this.pesajeRepository.find({
      where: {
        cuartelId,
        fecha: Between(desde, hasta),
        estadoSync: EstadoSync.SINCRONIZADO,
      },
    });
    const kgCosechados = pesajes.reduce(
      (acc, p) => acc + Number(p.kgTotales),
      0,
    );
    // OJO: esto es lo que se le PAGA a la cuadrilla de vendimia, o sea un costo
    // de cosecha. No es un ingreso. Antes se restaba como si lo fuera y el
    // "margen bruto" resultante no tenía sentido económico.
    const costoCosecha = pesajes.reduce(
      (acc, p) => acc + Number(p.montoLiquidacion ?? 0),
      0,
    );

    const costoTotal = costoLabores + costoInsumos + costoCosecha;
    const hectareas = Number(cuartel.hectareas ?? 0);

    // Ingreso real: lo que la bodega pagó por los remitos del cuartel (D-010).
    // Se filtra por la fecha del remito —la jornada cosechada— y no por la de
    // la liquidación, que suele ser semanas posterior y caería en otra campaña.
    const [ingresoFila, promediosIot] = await Promise.all([
      this.liquidacionRepository
        .createQueryBuilder('lb')
        .innerJoin('remitos', 'r', 'r.id = lb.remito_id')
        .select('COALESCE(SUM(lb.monto_neto), 0)', 'ingresos')
        .addSelect('COUNT(*)', 'liquidaciones')
        .where('r.cuartel_id = :cuartelId', { cuartelId })
        .andWhere('r.fecha BETWEEN :desde::date AND :hasta::date', {
          desde,
          hasta,
        })
        .getRawOne<{ ingresos: string; liquidaciones: string }>(),
      this.getPromediosIot(cuartel.fincaId, desde, hasta, zonaHoraria),
    ]);

    const ingresos = Number(ingresoFila?.ingresos ?? 0);
    const liquidaciones = Number(ingresoFila?.liquidaciones ?? 0);
    // Sin liquidaciones el margen es DESCONOCIDO, no cero: "todavía no se sabe"
    // y "no ganó nada" son afirmaciones distintas.
    const margenBrutoDisponible = liquidaciones > 0;

    return {
      kgCosechados,
      costoLabores,
      costoInsumos,
      costoCosecha,
      costoTotal,
      costoPorHa: hectareas > 0 ? costoTotal / hectareas : null,
      ingresos,
      liquidaciones,
      margenBruto: margenBrutoDisponible
        ? Math.round((ingresos - costoTotal) * 100) / 100
        : (null as number | null),
      margenBrutoPorHa:
        margenBrutoDisponible && hectareas > 0
          ? Math.round(((ingresos - costoTotal) / hectareas) * 100) / 100
          : (null as number | null),
      margenBrutoDisponible,
      promediosIot,
      tieneDatos: registros.length > 0 || pesajes.length > 0,
    };
  }

  /**
   * Promedios IoT del período por variable (HU-31).
   *
   * Agrupa por tipo de sensor y no por sensor: al productor le importa "la
   * temperatura del período", no la de cada nodo. Las variables sin lecturas
   * **no aparecen en el objeto**, para que el cliente pueda distinguir "sin
   * datos" de un promedio que dio 0 —una lluvia acumulada de 0 mm es un dato
   * real y muy distinto de no haber tenido pluviómetro—.
   *
   * Las lecturas fuera de rango físico ya viven en `lecturas_anomalas` y nunca
   * llegan a `lecturas_iot`, así que no hace falta filtrarlas acá.
   */
  private async getPromediosIot(
    fincaId: string,
    desde: string,
    hasta: string,
    zonaHoraria: string,
  ): Promise<
    Record<string, { valor: number; agregacion: string; lecturas: number }>
  > {
    const tipos = Object.keys(AGREGACION_IOT);
    const filas = await this.lecturaRepository.query<
      Array<{ tipo: string; promedio: string; total: string; lecturas: string }>
    >(
      `SELECT s.tipo                        AS tipo,
              AVG(l.valor)                  AS promedio,
              SUM(l.valor)                  AS total,
              COUNT(*)                      AS lecturas
         FROM lecturas_iot l
         JOIN sensores s ON s.id = l.sensor_id
        WHERE s.finca_id = $1
          AND s.tipo = ANY($4)
          AND (l.sensor_timestamp AT TIME ZONE $5)::date BETWEEN $2::date AND $3::date
        GROUP BY s.tipo`,
      [fincaId, desde, hasta, tipos, zonaHoraria],
    );

    const resultado: Record<
      string,
      { valor: number; agregacion: string; lecturas: number }
    > = {};
    for (const fila of filas) {
      const agregacion = AGREGACION_IOT[fila.tipo as SensorTipo] ?? 'promedio';
      const crudo =
        agregacion === 'total' ? Number(fila.total) : Number(fila.promedio);
      resultado[fila.tipo] = {
        valor: Math.round(crudo * 100) / 100,
        agregacion,
        lecturas: Number(fila.lecturas),
      };
    }
    return resultado;
  }

  /**
   * Promedio diario del sensor, agrupado en la **zona horaria de la empresa**.
   *
   * `sensor_timestamp` es `timestamptz` y `to_char` lo formateaba en UTC,
   * mientras que la serie de costos sale de una columna `date` que ya es local.
   * En Mendoza (UTC−3) eso mandaba las lecturas de 21:00 a 24:00 al día
   * siguiente: **los pares quedaban desalineados y el coeficiente de Pearson
   * se calculaba sobre días que no se corresponden**. Con `AT TIME ZONE` las
   * dos series hablan del mismo día.
   */
  private async getSerieDiariaSensor(
    sensorId: string,
    desde: string,
    hasta: string,
    zonaHoraria: string,
  ): Promise<SerieDiaria[]> {
    const rows = await this.lecturaRepository.query<
      Array<{ fecha: string; valor: string }>
    >(
      `SELECT to_char(l.sensor_timestamp AT TIME ZONE $4, 'YYYY-MM-DD') AS fecha,
              AVG(l.valor) AS valor
         FROM lecturas_iot l
        WHERE l.sensor_id = $1
          AND (l.sensor_timestamp AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
        GROUP BY 1
        ORDER BY 1 ASC`,
      [sensorId, desde, hasta, zonaHoraria],
    );

    return rows.map((r) => ({ fecha: r.fecha, valor: Number(r.valor) }));
  }

  private async getSerieDiariaCosto(
    cuartelId: string,
    desde: string,
    hasta: string,
  ): Promise<SerieDiaria[]> {
    const registros = await this.registroLaborRepository.find({
      where: { cuartelId, fecha: Between(desde, hasta) },
    });

    const normalizarFecha = (fecha: string | Date): string =>
      fecha instanceof Date ? fechaLocal(fecha) : String(fecha).slice(0, 10);

    const costoPorFecha = new Map<string, number>();
    for (const registro of registros) {
      const fecha = normalizarFecha(registro.fecha);
      const costoLabor =
        Number(registro.cantidad) * Number(registro.costoUnitarioAlSync ?? 0);
      costoPorFecha.set(fecha, (costoPorFecha.get(fecha) ?? 0) + costoLabor);
    }

    const registroIds = registros.map((r) => r.id);
    if (registroIds.length > 0) {
      const detalles = await this.detalleInsumoLaborRepository
        .createQueryBuilder('d')
        .innerJoin('d.registroLabor', 'r')
        .addSelect('r.fecha', 'fecha')
        .where('d.registro_labor_id IN (:...ids)', { ids: registroIds })
        .getRawAndEntities();

      detalles.entities.forEach((detalle, index) => {
        const fecha = normalizarFecha(
          (detalles.raw[index] as { fecha: string | Date }).fecha,
        );
        const costoInsumo =
          Number(detalle.cantidadUsada) *
          Number(detalle.costoUnitarioAlSync ?? 0);
        costoPorFecha.set(fecha, (costoPorFecha.get(fecha) ?? 0) + costoInsumo);
      });
    }

    return Array.from(costoPorFecha.entries())
      .map(([fecha, valor]) => ({ fecha, valor }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  /**
   * Coeficiente de correlación de Pearson.
   *
   * Exige el mínimo de {@link MINIMO_PARES_CORRELACION} pares que pide HU-29.
   * Con menos, el resultado no tiene significancia: con n=2 el coeficiente es
   * siempre ±1 (dos puntos son colineales por definición) y se presentaba como
   * "correlación perfecta".
   */
  private pearson(x: number[], y: number[]): number | null {
    const n = x.length;
    if (n < MINIMO_PARES_CORRELACION) {
      return null;
    }

    const mediaX = x.reduce((a, b) => a + b, 0) / n;
    const mediaY = y.reduce((a, b) => a + b, 0) / n;

    let numerador = 0;
    let sumaCuadX = 0;
    let sumaCuadY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - mediaX;
      const dy = y[i] - mediaY;
      numerador += dx * dy;
      sumaCuadX += dx * dx;
      sumaCuadY += dy * dy;
    }

    const denominador = Math.sqrt(sumaCuadX * sumaCuadY);
    if (denominador === 0) {
      return null;
    }

    return Number((numerador / denominador).toFixed(4));
  }

  private variacionPorcentual(anterior: number, actual: number): number | null {
    if (anterior === 0) {
      return null;
    }
    return Number((((actual - anterior) / anterior) * 100).toFixed(2));
  }

  /** Etiqueta legible del coeficiente, según los cortes habituales de |r|. */
  private interpretarCorrelacion(r: number | null): string {
    if (r === null) {
      return 'Sin datos suficientes';
    }
    const abs = Math.abs(r);
    const sentido = r > 0 ? 'positiva' : 'negativa';
    if (abs >= 0.7) return `Correlación fuerte ${sentido}`;
    if (abs >= 0.4) return `Correlación moderada ${sentido}`;
    if (abs >= 0.2) return `Correlación débil ${sentido}`;
    return 'Sin correlación apreciable';
  }
}
