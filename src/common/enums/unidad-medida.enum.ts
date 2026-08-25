/**
 * Unidades de medida admitidas para insumos y tipos de labor (HU-16).
 *
 * Era un `varchar` libre: en la práctica convivían "kg", "Kg", "kilos" y
 * "kilogramos" como valores distintos, y cualquier agregación por unidad los
 * contaba por separado. Al ser un conjunto cerrado y chico, un enum en el DTO
 * es suficiente y no necesita una tabla de catálogo.
 */
export enum UnidadMedida {
  KILOGRAMO = 'kg',
  GRAMO = 'g',
  LITRO = 'l',
  MILILITRO = 'ml',
  UNIDAD = 'unidad',
  JORNAL = 'jornal',
  HORA = 'hora',
  HECTAREA = 'ha',
  METRO = 'm',
}

/** Unidades que expresan tiempo de trabajo, no consumo de material. */
export const UNIDADES_DE_TRABAJO: ReadonlySet<UnidadMedida> = new Set([
  UnidadMedida.JORNAL,
  UnidadMedida.HORA,
]);
