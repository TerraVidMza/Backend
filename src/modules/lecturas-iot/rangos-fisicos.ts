import { SensorTipo } from '../sensores/entities/sensor.entity';

export interface RangoFisico {
  minimo: number;
  maximo: number;
  unidadEsperada: string;
}

/**
 * Rango físicamente posible de cada variable (HU-19).
 *
 * No son umbrales agronómicos —esos los configura el usuario por sensor en
 * HU-21— sino los límites de lo que el instrumento puede medir. Una humedad de
 * suelo del 340 % o una temperatura de −80 °C en Mendoza no son un evento del
 * viñedo: son un sensor descalibrado o un error de transmisión, y meterlos en
 * los promedios corrompe las correlaciones de HU-32.
 */
export const RANGOS_FISICOS: Record<SensorTipo, RangoFisico> = {
  [SensorTipo.TEMPERATURA]: { minimo: -15, maximo: 60, unidadEsperada: '°C' },
  [SensorTipo.HUMEDAD_SUELO]: { minimo: 0, maximo: 100, unidadEsperada: '%' },
  [SensorTipo.HUMEDAD_AMBIENTE]: {
    minimo: 0,
    maximo: 100,
    unidadEsperada: '%',
  },
  // Un evento extremo de una hora rara vez supera los 150 mm acumulados.
  [SensorTipo.PLUVIOMETRO]: { minimo: 0, maximo: 500, unidadEsperada: 'mm' },
  [SensorTipo.RADIACION_SOLAR]: {
    minimo: 0,
    maximo: 1500,
    unidadEsperada: 'W/m2',
  },
  [SensorTipo.VIENTO]: { minimo: 0, maximo: 200, unidadEsperada: 'km/h' },
};

export interface ResultadoValidacion {
  valida: boolean;
  motivo?: string;
}

/** Verifica que el valor caiga dentro del rango físico de su tipo de sensor. */
export function validarRangoFisico(
  tipo: SensorTipo,
  valor: number,
): ResultadoValidacion {
  const rango = RANGOS_FISICOS[tipo];
  if (!rango) {
    // Tipo sin rango declarado: se acepta en vez de descartar telemetría real
    // por una omisión de configuración.
    return { valida: true };
  }
  if (valor < rango.minimo || valor > rango.maximo) {
    return {
      valida: false,
      motivo: `Valor ${valor} fuera del rango físico de ${tipo} (${rango.minimo} a ${rango.maximo} ${rango.unidadEsperada}). Posible fallo de calibración.`,
    };
  }
  return { valida: true };
}
