/**
 * Estado del cuartel dentro del ciclo de vendimia (HU-09, HU-10, HU-28).
 *
 *   pendiente ──primer pesaje sincronizado──► en_cosecha ──remito aprobado──► cosechado
 *                                                 ▲                              │
 *                                                 └────── remito rechazado ──────┘
 *
 * No hay transición manual: el estado siempre se deriva de hechos del circuito.
 *
 * OJO — no confundir con el catálogo `ESTADO_CUARTEL` (`catalogo_item`), que el
 * seed carga con "Productivo" / "En implantación". Ese describe el ciclo de
 * *plantación*, no el de cosecha, y hoy no está vinculado a ninguna columna.
 * Ver `D-f` en docs/specs/PLAN-MEJORAS.md.
 */
export enum EstadoCuartel {
  PENDIENTE = 'pendiente',
  EN_COSECHA = 'en_cosecha',
  COSECHADO = 'cosechado',
}
