# HU-31 — Comparación de indicadores entre campañas

| Campo | Valor |
|---|---|
| **Actor** | Propietario o Agrónomo |
| **Área** | Inteligencia agronómica |
| **Módulo backend** | `src/modules/inteligencia-agronomica` |
| **Entidad principal** | `SINOPSIS_PROCESO`, `CUARTEL` |
| **Prioridad** | Baja |
| **Complejidad** | Media |
| **Precondiciones** | HU-15 y HU-20 completados con datos de al menos dos campañas |
| **Pantallas (Figma)** | PAN-19: Reporte de Tendencias y Recomendaciones de Manejo — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟠 PARCIAL — faltan los promedios IoT y el concepto de campaña (D-c) |

> **Auditoría (2026-08-24):** el "margen bruto" usa el monto de liquidación (un costo) como si fuera ingreso. Faltan costo/ha, los promedios IoT y distinguir 0 de "sin datos". Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Fase 2 (2026-08-24):** ningún endpoint publica ya un margen bruto falso. Falta el ingreso de [D-005](../DECISIONS.md) para que el indicador sea real.
>
> **Decisiones de modelo (2026-08-25):** ✅ el ingreso existe en el modelo ([D-010](../DECISIONS.md)), así que el margen bruto de la comparación es calculable.
>
> **Cierre (2026-08-25):** **Pendiente:** los **promedios IoT** por campaña (temperatura, humedad, precipitaciones) no están implementados, y el endpoint sigue recibiendo los rangos del cliente porque el concepto de campaña no existe en el modelo ([D-c](PLAN-MEJORAS.md)).

## Descripción

Como **Propietario o Agrónomo**
Quiero **comparar indicadores de un cuartel entre campañas**
Para **evaluar la evolución del cuartel y tomar decisiones fundamentadas.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El usuario selecciona un cuartel y dos campañas (años agrícolas) a comparar | El sistema muestra una tabla comparativa con dos columnas (una por campaña). Filas: costo total de labores ($), costo total de insumos ($), costo total por ha ($/ha), kg cosechados (si hay remitos aprobados) y margen bruto ($). Para cada indicador se muestra la variación porcentual entre campañas, resaltada en verde (mejora) o rojo (deterioro). | Disponible solo en web. Campaña = año agrícola (configurable en HU-33, ej: puede ser año calendario o ciclo productivo). El cálculo se realiza en el backend. |
| El cuartel tiene datos de sensores en ambas campañas | La tabla incluye una sección adicional con promedios IoT: temperatura promedio, humedad promedio y precipitaciones totales (para las variables que tengan datos en ambas campañas). Si una variable no tiene datos en una campaña, se muestra "Sin datos" para esa celda. | Los promedios IoT son opcionales: si no existen datos de sensores, la sección IoT no se muestra. |
| Una de las campañas seleccionadas no tiene datos en el sistema | El sistema muestra la tabla con los datos disponibles y señala los indicadores sin datos con el texto "Sin datos" en color gris. Se muestra un mensaje informativo: "La campaña [año] no tiene registros completos para este cuartel." | No bloquear la visualización por falta de datos. Permitir comparación parcial. |

## Endpoints relacionados

- `GET /api/inteligencia-agronomica/comparar-campanias/:cuartelId`

## Notas / decisiones

- Implementado en `src/modules/inteligencia-agronomica`.
