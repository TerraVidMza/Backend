import { SensorTipo } from '../sensores/entities/sensor.entity';

/**
 * Catálogo de reglas agronómicas de HU-30.
 *
 * La HU pide «un conjunto de reglas predefinidas» if-then y da **un solo
 * ejemplo**, sin especificar el resto. Este archivo es esa especificación
 * faltante, y vive en código a propósito: son reglas que se auditan, se
 * versionan con el repo y se discuten en un PR. Un ABM de reglas editables por
 * el usuario sería otra HU —y otra discusión sobre quién responde cuando una
 * regla mal cargada recomienda regar de más.
 *
 * Explícitamente **no son un modelo predictivo**: son heurísticas de umbral
 * que sirven como punto de partida objetivo, que es lo que la HU pide. Cada
 * una lleva su `porQue` para que el agrónomo pueda discutir el criterio en vez
 * de tener que confiar en el número.
 *
 * Los umbrales están calibrados para vid en Mendoza (secano bajo riego). Si el
 * sistema se despliega en otra región hay que revisarlos: quedan acá juntos y
 * comentados justamente para que esa revisión sea un cambio de un solo archivo.
 */

export const DIAS_MINIMOS_HISTORICO = 30;

export interface DefinicionRegla {
  id: string;
  variable: string;
  severidad: 'alta' | 'media' | 'baja';
  /** Sensor que la alimenta; `null` si sale de labores o costos. */
  sensorTipo: SensorTipo | null;
  porQue: string;
}

export const REGLAS_AGRONOMICAS: Record<string, DefinicionRegla> = {
  /**
   * La regla que la HU usa como ejemplo textual.
   *
   * 30 % de humedad volumétrica está por debajo del umbral de estrés hídrico
   * para vid en la mayoría de los suelos francos de Mendoza. Sostenido durante
   * un mes no es una seca puntual: es un problema de programación de riego.
   */
  humedad_suelo_baja: {
    id: 'humedad_suelo_baja',
    variable: 'humedad_suelo',
    severidad: 'alta',
    sensorTipo: SensorTipo.HUMEDAD_SUELO,
    porQue:
      'Humedad de suelo promedio por debajo del 30 % durante el período analizado.',
  },

  /**
   * Alertas repetidas del mismo sensor son síntoma de una condición sostenida
   * o de un umbral mal configurado. En los dos casos amerita ir a mirar.
   */
  alerta_iot_recurrente: {
    id: 'alerta_iot_recurrente',
    variable: 'alertas_iot',
    severidad: 'alta',
    sensorTipo: null,
    porQue:
      'Tres o más alertas de sensores en los últimos 7 días sobre la misma finca.',
  },

  /**
   * Catorce días sin labores en plena temporada suele ser un parte que no se
   * sincronizó, no un cuartel abandonado. Vale la misma advertencia en los dos
   * casos.
   */
  sin_labores_recientes: {
    id: 'sin_labores_recientes',
    variable: 'labores',
    severidad: 'media',
    sensorTipo: null,
    porQue: 'Sin labores registradas en los últimos 14 días.',
  },

  /**
   * Desvío de costo contra los demás cuarteles de la misma finca, que comparten
   * clima, suelo y cuadrillas.
   *
   * Se compara contra la **mediana** y no contra el promedio: con pocos
   * cuarteles, uno solo muy caro arrastra el promedio hacia arriba y termina
   * ocultando justamente el desvío que se busca detectar.
   */
  costo_por_ha_desviado: {
    id: 'costo_por_ha_desviado',
    variable: 'costo_por_ha',
    severidad: 'media',
    sensorTipo: null,
    porQue:
      'Costo por hectárea superior a 1,5 veces la mediana del resto de los cuarteles de la finca.',
  },
};

/** Umbral de humedad de suelo, en porcentaje volumétrico. */
export const HUMEDAD_SUELO_MINIMA = 30;
/** Alertas en la ventana que disparan `alerta_iot_recurrente`. */
export const ALERTAS_RECURRENTES_MINIMO = 3;
export const ALERTAS_VENTANA_DIAS = 7;
export const SIN_LABORES_DIAS = 14;
/** Múltiplo de la mediana a partir del cual el costo se considera desviado. */
export const FACTOR_COSTO_DESVIADO = 1.5;
