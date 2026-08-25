# HU-29 — Análisis de correlación sensor-costos

| Campo | Valor |
|---|---|
| **Actor** | Propietario o Agrónomo |
| **Área** | Inteligencia agronómica |
| **Módulo backend** | `src/modules/inteligencia-agronomica` |
| **Entidad principal** | `LECTURA_TELEMETRIA`, `CUARTEL`, `PARTE_LABOR` |
| **Prioridad** | Media |
| **Complejidad** | Alta |
| **Precondiciones** | HU-15 (datos de margen bruto disponibles) y HU-20 (lecturas de sensores disponibles) |
| **Pantallas (Figma)** | PAN-18: Consola de Correlación Agronómica-Financiera — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** el umbral de Pearson es n<2 en vez de n<7, lo que produce correlaciones falsas de ±1.0. Sin interpretación textual y sin restricción de rol. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Criterios (2026-08-25):** corregido el **bucketing por zona horaria** (cierra F1-10): la serie del sensor agrupa con `AT TIME ZONE` sobre la zona de la empresa, así que los pares se alinean con las fechas locales de las labores en vez de con UTC.

## Descripción

Como **Propietario o Agrónomo**
Quiero **ver un panel que cruce lecturas de sensores con costos de un cuartel**
Para **identificar relaciones entre las condiciones físicas del campo y la rentabilidad.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El usuario selecciona finca, cuartel y rango de fechas | El sistema muestra un gráfico de doble eje con Chart.js: eje Y izquierdo para el costo acumulado del cuartel (en $), eje Y derecho para el promedio diario de la variable IoT seleccionada (ej: temperatura en °C), eje X para el tiempo. El usuario puede cambiar la variable IoT mediante un selector. | Disponible solo en web. El cálculo se realiza en el backend para no sobrecargar el cliente. Agrupar lecturas IoT por día (promedio) para el gráfico. |
| El sistema calcula el coeficiente de correlación | El sistema calcula el coeficiente de correlación de Pearson entre la serie diaria de la variable IoT y la serie diaria de costos. El resultado se muestra como un valor entre -1 y 1 con una interpretación textual: "Correlación fuerte positiva", "Correlación débil", etc. | Calcular Pearson en el backend con datos diarios agregados. Requerir mínimo 7 pares de datos para calcular la correlación. Modelos predictivos y ML quedan fuera del alcance v1. |
| No hay datos suficientes para mostrar el gráfico (menos de 7 días con datos de ambas series) | El sistema muestra el mensaje: "No hay suficientes datos para calcular la correlación. Se necesitan al menos 7 días con datos de sensores y costos registrados para el cuartel seleccionado." El gráfico no se renderiza. | El cálculo de correlación mínimo requiere 7 pares de observaciones para tener significancia estadística básica. |

## Endpoints relacionados

- `GET /api/inteligencia-agronomica/correlacion/:cuartelId`

## Notas / decisiones

- Implementado en `src/modules/inteligencia-agronomica`.
