import { SetMetadata } from '@nestjs/common';

export const AUDITAR_KEY = 'auditar';

export interface OpcionesAuditoria {
  /** Verbo del evento, en mayúsculas: `CREAR_USUARIO`, `APROBAR_REMITO`. */
  accion: string;
  /** Entidad afectada, en singular: `usuario`, `remito`, `costo_insumo`. */
  entidad: string;
  /**
   * De dónde sale el id de la entidad afectada:
   * - `'resultado'` (por defecto): del `id` de lo que devuelve el handler.
   * - `'param:<nombre>'`: de un parámetro de ruta, para bajas y aprobaciones
   *   donde el handler no devuelve la entidad completa.
   */
  idDesde?: string;
  /**
   * `'ninguno'` no guarda el cuerpo. Se usa en los endpoints de sincronización:
   * un lote de 200 registros por request convertiría la columna `jsonb` del log
   * en la tabla más pesada del sistema, duplicando datos que ya están en su
   * propia tabla.
   */
  datos?: 'cuerpo' | 'ninguno';
  /**
   * Cambio de estado que produce la acción (HU-27: «estado anterior y estado
   * nuevo»). `desde` es el único estado de partida que el service acepta para
   * esa acción —si fuera otro, la respuesta es un error y no se audita—, así
   * que no hace falta leerlo antes. El estado nuevo se toma del campo `campo`
   * de lo que devuelve el handler.
   */
  transicion?: { campo: string; desde: string };
}

/**
 * Marca un handler como auditable (HU-05).
 *
 * Se resuelve en el interceptor y no en cada service para que agregar auditoría
 * a un endpoint nuevo sea una línea: el modo en que esto se degradaba era que
 * un módulo nuevo simplemente no auditara y nadie lo notara.
 */
export const Auditar = (opciones: OpcionesAuditoria) =>
  SetMetadata(AUDITAR_KEY, opciones);
