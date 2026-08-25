# HU-20 — Monitoreo y gráficos de sensores

| Campo | Valor |
|---|---|
| **Actor** | Propietario o Agrónomo |
| **Área** | Telemetría IoT |
| **Módulo backend** | `src/modules/lecturas-iot` |
| **Entidad principal** | `LECTURA_TELEMETRIA` |
| **Prioridad** | Alta |
| **Complejidad** | Media |
| **Precondiciones** | HU-19 completado (al menos una lectura recibida) |
| **Pantallas (Figma)** | PAN-17: Gráficos de Telemetría y Configuración de Umbrales — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** el historial solo acepta limit, sin desde/hasta ni agregación por hora/día, y falta el índice en la tabla de lecturas. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Fase 2 (2026-08-24):** el historial acepta **`desde`/`hasta` y viene paginado**, y ya existe el índice que lo sostiene (F2-2, F2-6). Falta la agregación por hora/día en la consulta.
>
> **Criterios (2026-08-25):** `GET /lecturas-iot/sensor/:id/serie` devuelve la **serie agregada por hora o por día**, en la zona horaria de la empresa. Un mes de un sensor que mide cada 5 minutos son ~9.000 puntos crudos.

## Descripción

Como **Propietario o Agrónomo**
Quiero **ver las últimas lecturas de los sensores activos de una finca y su historial gráfico**
Para **monitorear las condiciones microclimáticas del campo y tomar decisiones oportunas.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El usuario accede al panel de telemetría de una finca | El sistema muestra una tarjeta por cada sensor activo de la finca. Cada tarjeta incluye: nombre/código del sensor, tipo, último valor con unidad, y tiempo transcurrido desde la última lectura ("Hace 3 min"). Las tarjetas se actualizan automáticamente cada 5 minutos o al presionar el botón "Actualizar". | Disponible solo en web en esta versión. Las tarjetas usan polling cada 5 minutos (no WebSocket en MVP). Implementar un indicador visual de "actualizando". |
| El usuario selecciona un sensor y un rango de fechas para ver el historial | El sistema muestra un gráfico de línea temporal (Chart.js) con el eje X representando el tiempo y el eje Y el valor de la variable medida. El gráfico incluye: línea de valores, y líneas punteadas horizontales indicando los umbrales configurados (si existen). El rango de fechas por defecto es las últimas 24 horas. | Para rangos > 7 días, agregar los datos por hora (promedio) para evitar sobrecarga del cliente. Para rangos > 30 días, agregar por día. |
| Un sensor activo no envía datos durante más de 2 horas | La tarjeta del sensor muestra una advertencia visual (ícono de alerta naranja) con el texto "Sin datos hace más de 2 horas. Última lectura: [timestamp]". | La detección de sensores silenciosos se realiza en el frontend comparando el `received_at` de la última lectura con el tiempo actual. No requiere un job en el backend para el MVP. |

## Endpoints relacionados

- `GET /api/lecturas-iot/sensor/:sensorId`

## Notas / decisiones

- Agregación por hora/día para rangos largos no verificada — confirmar si el service ya la implementa o si el frontend debe hacerla client-side.
