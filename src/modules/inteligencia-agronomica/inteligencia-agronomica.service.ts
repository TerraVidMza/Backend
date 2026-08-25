import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Cuartel } from '../cuarteles/entities/cuartel.entity';
import { Sensor } from '../sensores/entities/sensor.entity';
import { LecturaIot } from '../lecturas-iot/entities/lectura-iot.entity';
import { AlertaIot } from '../alertas-iot/entities/alerta-iot.entity';
import { RegistroLabor } from '../registro-labor/entities/registro-labor.entity';
import { DetalleInsumoLabor } from '../registro-labor/entities/detalle-insumo-labor.entity';
import { PesajeVendimia } from '../pesaje-vendimia/entities/pesaje-vendimia.entity';
import { EstadoSync } from '../../common/enums/estado-sync.enum';

export interface SerieDiaria {
  fecha: string;
  valor: number;
}

/**
 * Mínimo de pares (días con dato en ambas series) para calcular la correlación.
 * HU-29 lo fija en 7 para tener significancia estadística básica.
 */
const MINIMO_PARES_CORRELACION = 7;

import { ConfiguracionService } from '../configuracion/configuracion.service';
import { fechaLocal } from '../../common/fechas/rango-fechas';

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
    private readonly configuracionService: ConfiguracionService,
  ) {}

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

  async getRecomendaciones(
    cuartelId: string,
  ): Promise<{ tipo: string; severidad: string; mensaje: string }[]> {
    const cuartel = await this.cuartelRepository.findOne({
      where: { id: cuartelId },
    });
    if (!cuartel) {
      throw new NotFoundException('Cuartel no encontrado');
    }

    const recomendaciones: {
      tipo: string;
      severidad: string;
      mensaje: string;
    }[] = [];

    const sensoresFinca = await this.sensorRepository.find({
      where: { fincaId: cuartel.fincaId, activo: true },
    });
    const sensorIds = sensoresFinca.map((s) => s.id);

    if (sensorIds.length > 0) {
      const hace7Dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const alertasRecientes = await this.alertaRepository
        .createQueryBuilder('a')
        .where('a.sensor_id IN (:...sensorIds)', { sensorIds })
        .andWhere('a.created_at >= :desde', { desde: hace7Dias })
        .getMany();

      if (alertasRecientes.length >= 3) {
        recomendaciones.push({
          tipo: 'alerta_iot_recurrente',
          severidad: 'alta',
          mensaje: `Se registraron ${alertasRecientes.length} alertas de sensores en los últimos 7 días. Se recomienda inspeccionar el cuartel y revisar riego/protección según el tipo de sensor afectado.`,
        });
      }
    }

    const hace14Dias = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const labores = await this.registroLaborRepository
      .createQueryBuilder('r')
      .where('r.cuartel_id = :cuartelId', { cuartelId })
      .andWhere('r.fecha >= :desde', {
        desde: fechaLocal(hace14Dias),
      })
      .getCount();

    if (labores === 0) {
      recomendaciones.push({
        tipo: 'sin_labores_recientes',
        severidad: 'media',
        mensaje:
          'No se registraron labores en este cuartel durante los últimos 14 días. Verificar si corresponde planificar una labor de mantenimiento.',
      });
    }

    if (recomendaciones.length === 0) {
      recomendaciones.push({
        tipo: 'sin_novedades',
        severidad: 'baja',
        mensaje:
          'No se detectaron novedades relevantes para este cuartel en el período reciente.',
      });
    }

    return recomendaciones;
  }

  async compararCampanias(
    cuartelId: string,
    desde1: string,
    hasta1: string,
    desde2: string,
    hasta2: string,
  ) {
    const cuartel = await this.cuartelRepository.findOne({
      where: { id: cuartelId },
    });
    if (!cuartel) {
      throw new NotFoundException('Cuartel no encontrado');
    }

    const [periodo1, periodo2] = await Promise.all([
      this.getIndicadoresPeriodo(cuartel, desde1, hasta1),
      this.getIndicadoresPeriodo(cuartel, desde2, hasta2),
    ]);

    return {
      periodo1: { desde: desde1, hasta: hasta1, ...periodo1 },
      periodo2: { desde: desde2, hasta: hasta2, ...periodo2 },
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
        // Sin ingreso modelado no hay margen que comparar (D-005).
        margenBruto: null,
      },
      // Permite al front pintar verde/rojo sin duplicar la semántica: en los
      // costos, subir es deterioro; en los kilos cosechados, mejora.
      sentidoIndicadores: {
        kgCosechados: 'mayor_es_mejor',
        costoLabores: 'menor_es_mejor',
        costoInsumos: 'menor_es_mejor',
        costoTotal: 'menor_es_mejor',
        costoPorHa: 'menor_es_mejor',
      },
      mensaje: !periodo1.tieneDatos
        ? `El período ${desde1} — ${hasta1} no tiene registros completos para este cuartel.`
        : !periodo2.tieneDatos
          ? `El período ${desde2} — ${hasta2} no tiene registros completos para este cuartel.`
          : null,
    };
  }

  private async getIndicadoresPeriodo(
    cuartel: Cuartel,
    desde: string,
    hasta: string,
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

    return {
      kgCosechados,
      costoLabores,
      costoInsumos,
      costoCosecha,
      costoTotal,
      costoPorHa: hectareas > 0 ? costoTotal / hectareas : null,
      // El margen exige un ingreso (precio de venta o liquidación de bodega)
      // que todavía no existe en el modelo de datos — ver D-005 en
      // docs/DECISIONS.md. Se expone en null en vez de publicar un número
      // falso.
      margenBruto: null as number | null,
      margenBrutoDisponible: false,
      tieneDatos: registros.length > 0 || pesajes.length > 0,
    };
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
