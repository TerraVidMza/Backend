# HU-30 — Generación de recomendaciones agronómicas

| Campo | Valor |
|---|---|
| **Actor** | Agrónomo |
| **Área** | Inteligencia agronómica |
| **Módulo backend** | `src/modules/inteligencia-agronomica` |
| **Entidad principal** | `SINOPSIS_PROCESO`, `CUARTEL` |
| **Prioridad** | Baja |
| **Complejidad** | Media |
| **Precondiciones** | HU-29 (al menos 30 días de datos históricos en el cuartel) |
| **Pantallas (Figma)** | PAN-19: Reporte de Tendencias y Recomendaciones de Manejo — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** no existe la tabla de recomendaciones: se calculan al vuelo y no tienen id, por lo que no son direccionables. Sin gate de 30 días, reglas hardcodeadas. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Cierre (2026-08-25):** sin cambios. La entidad `recomendaciones` con aplicar/descartar y el gate de 30 días siguen pendientes, bloqueados por **definir qué reglas agronómicas se aplican** — ninguna HU las especifica, así que no hay contra qué implementar.
>
> **Decisiones pendientes (2026-08-26):** ✅ **cerrada.** Entidad `recomendaciones` con `aplicada`/`descartada` y nota, gate de 30 días con `diasFaltantes`, y el catálogo de reglas definido en `reglas-agronomicas.ts` — que es la especificación que a la HU le faltaba. Cuatro reglas: humedad de suelo baja (la que la HU da de ejemplo), alertas IoT recurrentes, sin labores recientes y costo por hectárea desviado de la mediana de la finca.
>
> Consultar la pantalla **genera** las recomendaciones, así que ese GET escribe. Es deliberado: no hay otro momento natural para dispararlas, y reevaluar es idempotente porque un índice parcial garantiza una sola recomendación *activa* por regla y cuartel. Una regla ya resuelta puede volver a generarse si las condiciones se repiten, como pide la HU.

## Descripción

Como **Agrónomo**
Quiero **recibir recomendaciones básicas de manejo generadas a partir del histórico**
Para **contar con un punto de partida objetivo para decisiones de manejo.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El cuartel tiene 30 o más días de datos históricos de sensores y costos | El sistema evalúa un conjunto de reglas predefinidas sobre los datos históricos y genera recomendaciones textuales. Cada recomendación incluye: variable involucrada, patrón detectado y acción sugerida. Ejemplo: "Humedad de suelo promedio inferior a 30% → Revisar programación de riego para reducir costos de fumigación". | Las recomendaciones son basadas en reglas (if-then), no en modelos de ML. El conjunto de reglas es configurable por el equipo técnico. Los modelos predictivos de ML quedan fuera del alcance v1. |
| El Agrónomo marca una recomendación como "Aplicada" o "Descartada" | La recomendación actualiza su estado en la BD y deja de aparecer en la lista de recomendaciones activas. En ambos casos, el Agrónomo puede agregar una nota opcional (máx 300 chars) explicando el motivo de la acción. | Tabla recomendaciones: campos cuartel_id, regla_id, estado (activa/aplicada/descartada), nota, timestamp_estado. Una misma regla puede volver a generarse si las condiciones se repiten. |
| El cuartel tiene menos de 30 días de datos | El sistema muestra: "Faltan [N] días de datos para generar recomendaciones para este cuartel. Las recomendaciones estarán disponibles cuando se acumulen suficientes datos históricos." | Calcular N = 30 - días_con_datos_actuales. Mostrar una barra de progreso visual de avance. |

## Endpoints relacionados

- `GET /api/inteligencia-agronomica/recomendaciones/:cuartelId`
- ⚠️ Falta: endpoint para actualizar estado de una recomendación (ej. `PATCH /api/inteligencia-agronomica/recomendaciones/:id`)

## Notas / decisiones

- Gap detectado: el criterio de aceptación "marcar como Aplicada/Descartada" no tiene endpoint de escritura implementado todavía.
