# HU-17 — Historial de labores por cuartel

| Campo | Valor |
|---|---|
| **Actor** | Propietario, Agrónomo o Auditor |
| **Área** | Operaciones y costeo |
| **Módulo backend** | `src/modules/registro-labor` |
| **Entidad principal** | `PARTE_LABOR` |
| **Prioridad** | Media |
| **Complejidad** | Baja |
| **Precondiciones** | HU-14 completado (registros sincronizados en el servidor) |
| **Pantallas (Figma)** | ⚠️ Pendiente — no está en la matriz de trazabilidad (PAN-01 a PAN-19). |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** sin paginación ni filtros, no trae los insumos de cada labor, sin restricción de rol y expone la entidad usuario completa. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Fase 2 (2026-08-24):** el historial ya viene **paginado y con los insumos de cada labor** (`detalles`), que era el dato que faltaba para mostrar el costo real de la fila (F2-2). Falta el resto de los filtros y la restricción del Capataz a sus registros del día.
>
> **Criterios (2026-08-25):** sumados los filtros por tipo de labor, usuario y rango de fechas, y **el Capataz queda acotado a sus propios registros del día**: el resto del historial expone trabajo y costos de terceros. La restricción se aplica después de los filtros del query string para que no pueda relajarse desde el cliente.

## Descripción

Como **Propietario, Agrónomo o Auditor**
Quiero **ver el historial completo de labores registradas en un cuartel**
Para **auditar la actividad productiva, detectar inconsistencias y analizar el uso de insumos.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El usuario accede al historial de operaciones de un cuartel | El sistema muestra un listado paginado (20 por página) ordenado por fecha descendente. Cada fila muestra: fecha, tipo de labor, lista de insumos con cantidades y unidades, nombre del Capataz que registró la labor y estado de sincronización. Solo se muestran registros con estado_sync = "sincronizado". | Disponible en web. En mobile, el Capataz solo ve sus propios registros del día actual (filtrado por userId y fecha = hoy). |
| El usuario aplica filtros al historial | Los filtros disponibles son: cuartel (selector), rango de fechas (desde/hasta), tipo de labor (selector multi-opción del catálogo) y usuario/Capataz (selector). Los filtros son acumulativos y el total de resultados filtrados se muestra sobre el listado. | El filtro de usuario solo está disponible para Propietario y Agrónomo, no para Capataz (que solo ve sus propios registros). |
| Un Auditor accede al historial | El Auditor puede ver todos los registros con los mismos filtros disponibles que el Propietario/Agrónomo. No existen botones de edición ni eliminación en la vista. Todos los campos son de solo lectura. | Verificar rol en el backend para el endpoint de historial. El rol Auditor tiene permiso de lectura pero no de escritura sobre este recurso. |

## Endpoints relacionados

- `GET /api/registro-labor/cuartel/:cuartelId`

## Notas / decisiones

- El endpoint real de este repo es `GET /registro-labor/cuartel/:cuartelId` (el documento maestro lo referencia como `/labores/historial`).
