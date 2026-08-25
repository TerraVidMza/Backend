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
 * *plantación*, no el de cosecha, y hoy no está vinculado a ninguna columna:
 * son dimensiones independientes, un cuartel en implantación puede estar
 * `pendiente` de cosecha. Ver D-013 en docs/DECISIONS.md.
 *
 * Es un enum de código y no una FK al catálogo justamente porque las
 * transiciones las escribe el sistema: si un usuario pudiera renombrar o
 * borrar el valor desde el ABM de tablas maestras, las rompería.
 */
export enum EstadoCuartel {
  PENDIENTE = 'pendiente',
  EN_COSECHA = 'en_cosecha',
  COSECHADO = 'cosechado',
}
