# HU-28 — Estado de cosecha por cuartel

| Campo | Valor |
|---|---|
| **Actor** | Propietario, Agrónomo o Capataz |
| **Área** | Logística de vendimia |
| **Módulo backend** | `src/modules/pesaje-vendimia` |
| **Entidad principal** | `CUARTEL` |
| **Prioridad** | Media |
| **Complejidad** | Baja |
| **Precondiciones** | HU-24 (al menos un pesaje registrado) y HU-27 (al menos un remito procesado) |
| **Pantallas (Figma)** | ⚠️ Pendiente — no está en la matriz de trazabilidad. |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** la máquina de estados del cuartel no está implementada: la columna existe pero ningún código la escribe ni la lee. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Criterios (2026-08-25):** `GET /pesajes-vendimia/finca/:id/estado-cosecha` devuelve la **tabla por finca** con una fila por cuartel, su estado, kilos por situación y rendimiento kg/ha, agregada en SQL.
>
> **Cierre (2026-08-25):** la máquina de estados quedó implementada (F1-8) y los cuarteles Cosechados rechazan nuevos pesajes. La propagación «en tiempo real» del panel es del cliente: el backend expone el estado ya calculado.

## Descripción

Como **Propietario, Agrónomo o Capataz**
Quiero **ver el estado actualizado de cada cuartel en el ciclo de vendimia**
Para **tener visibilidad completa del avance de la cosecha.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El usuario accede al panel de estado de cosecha | El sistema muestra una tabla con todos los cuarteles activos de la finca. Columnas: nombre del cuartel, estado (Pendiente / En cosecha / Cosechado), kg totales pesados y sincronizados, cantidad de cuadrillas que trabajaron en el cuartel y estado del último remito (Sin remito / Pendiente / Aprobado / Rechazado). Disponible en web y mobile. | Este panel es la vista principal del Capataz durante la campaña. Ordenar por estado: En cosecha primero, luego Pendiente, luego Cosechado. Dentro de cada grupo, ordenar por nombre. |
| El Capataz registra el primer pesaje sincronizado para un cuartel en Pendiente | El estado del cuartel cambia automáticamente a "En cosecha" en el panel. El cambio se refleja en el panel en la siguiente actualización (máximo 30 segundos en web, inmediato tras sincronización en mobile). | La transición de estado es: Pendiente → En cosecha (primer pesaje sincronizado) → Cosechado (remito aprobado). No hay transición manual de estados desde este panel. |
| Un remito del cuartel es aprobado (HU-27) | El estado del cuartel en el panel cambia automáticamente a "Cosechado" y el estado del remito se actualiza a "Aprobado". Los cuarteles Cosechados no aceptan nuevos pesajes. | El cambio de estado se propaga en tiempo real mediante polling o WebSocket según lo implementado en el dashboard. |

## Endpoints relacionados

- `GET /api/pesajes-vendimia/cuartel/:cuartelId/estado-cosecha`

## Notas / decisiones

- Implementado en `src/modules/pesaje-vendimia`.
