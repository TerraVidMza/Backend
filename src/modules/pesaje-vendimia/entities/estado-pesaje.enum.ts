/**
 * Ciclo de vida de un pesaje dentro del circuito de remitos (HU-26, HU-27).
 *
 *   pendiente_remito ──generarBorrador──► en_remito ──aprobar──► liquidado
 *                                             │
 *                                          rechazar
 *                                             ▼
 *                                         observado
 *
 * `observado` existe para que el rechazo de un remito tenga efecto real: si los
 * pesajes volvieran a `pendiente_remito`, el siguiente borrador los reincluiría
 * automáticamente sin que nadie los revise, anulando el propósito del rechazo.
 * Un pesaje observado debe ser corregido o anulado antes de volver al circuito.
 */
export enum EstadoPesaje {
  PENDIENTE_REMITO = 'pendiente_remito',
  EN_REMITO = 'en_remito',
  LIQUIDADO = 'liquidado',
  OBSERVADO = 'observado',
}
