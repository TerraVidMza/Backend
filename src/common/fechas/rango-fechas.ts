import {
  Between,
  FindOperator,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Fecha `YYYY-MM-DD` en la zona del servidor.
 *
 * **No usar `toISOString().slice(0, 10)` para esto.** Ese método devuelve la
 * fecha en UTC: en Mendoza (UTC−3), entre las 21:00 y la medianoche ya informa
 * el día siguiente. Todas las columnas `date` del sistema —la fecha de una
 * labor, la de un pesaje, el `valid_from` de un costo— representan el día de
 * trabajo en la finca, que es local. Con la fecha UTC, un costo cargado a las
 * 21:30 quedaba vigente recién al día siguiente y las labores de esa misma
 * jornada se rechazaban por "sin costo vigente".
 */
export function fechaLocal(fecha: Date = new Date()): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Hoy en la zona del servidor, en formato `YYYY-MM-DD`. */
export function hoyLocal(): string {
  return fechaLocal();
}

/**
 * Convierte `YYYY-MM-DD` al instante en que arranca ese día **en la zona del
 * servidor**.
 *
 * `new Date('2026-08-24')` no sirve: el estándar obliga a interpretar una
 * fecha sin hora como medianoche **UTC**, así que en Mendoza (UTC−3) apunta a
 * las 21:00 del día anterior. Filtrar un `timestamptz` con eso corre la ventana
 * tres horas y deja afuera parte del día que el usuario pidió.
 *
 * Si el valor ya trae hora (ISO completo), se respeta tal cual.
 */
export function inicioDelDia(fecha: string): Date {
  if (!SOLO_FECHA.test(fecha)) {
    return new Date(fecha);
  }
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia, 0, 0, 0, 0);
}

/**
 * Último instante del día indicado. `hasta` es inclusive en toda la API: pedir
 * `hasta=2026-08-24` tiene que incluir lo que pasó ese día.
 */
export function finDelDia(fecha: string): Date {
  if (!SOLO_FECHA.test(fecha)) {
    return new Date(fecha);
  }
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia, 23, 59, 59, 999);
}

/** Operador de TypeORM para un rango opcional por ambos extremos. */
export function rangoDeFechas(
  desde?: string,
  hasta?: string,
): FindOperator<Date> | undefined {
  if (desde && hasta) return Between(inicioDelDia(desde), finDelDia(hasta));
  if (desde) return MoreThanOrEqual(inicioDelDia(desde));
  if (hasta) return LessThanOrEqual(finDelDia(hasta));
  return undefined;
}

/**
 * Variante para columnas `date`, que TypeORM mapea a `string`.
 *
 * Acá **no** hay conversión de zona horaria que hacer: una columna `date` no
 * tiene hora ni offset, así que se compara texto contra texto en formato
 * ISO —donde el orden lexicográfico coincide con el cronológico—. Usar el
 * operador de `Date` sobre estas columnas reintroduce el corrimiento de un día.
 */
export function rangoDeFechasComoTexto(
  desde?: string,
  hasta?: string,
): FindOperator<string> | undefined {
  const soloFecha = (valor: string) => valor.slice(0, 10);
  if (desde && hasta) return Between(soloFecha(desde), soloFecha(hasta));
  if (desde) return MoreThanOrEqual(soloFecha(desde));
  if (hasta) return LessThanOrEqual(soloFecha(hasta));
  return undefined;
}
