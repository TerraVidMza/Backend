# HU-21 — Configuración de umbrales para sensores

| Campo | Valor |
|---|---|
| **Actor** | Propietario o Agrónomo |
| **Área** | Telemetría IoT |
| **Módulo backend** | `src/modules/umbral-sensor` |
| **Entidad principal** | `LECTURA_TELEMETRIA` |
| **Prioridad** | Media |
| **Complejidad** | Baja |
| **Precondiciones** | HU-18 completado (sensor activo registrado) |
| **Pantallas (Figma)** | PAN-17: Gráficos de Telemetría y Configuración de Umbrales — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟠 PARCIAL — falta el aviso de «la última lectura ya supera el umbral» |

> **Auditoría (2026-08-24):** bug: el operador ?? hace imposible borrar un umbral ya configurado. Sin aviso de "la última lectura ya supera el umbral", sin auditoría. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Fase 2 (2026-08-24):** la corrección de F1-6 estaba **incompleta** y se cerró acá: omitir un umbral lo borraba igual que enviarlo en `null`, porque con `target: ES2023` `plainToInstance` materializa los campos declarados y el operador `in` daba `true`. Corregido comparando contra `undefined`, con test de regresión. La configuración queda auditada.
>
> **Cierre (2026-08-25):** **Pendiente:** el aviso «la última lectura del sensor ya supera el umbral que configuraste» al momento de guardar. El resto de los criterios está cubierto.

## Descripción

Como **Propietario o Agrónomo**
Quiero **definir valores mínimos y máximos aceptables para cada variable de un sensor**
Para **recibir alertas automáticas cuando las condiciones del campo superen los límites establecidos.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El usuario configura umbrales para un sensor | El formulario permite ingresar un umbral mínimo y/o un umbral máximo de forma independiente. Ambos campos son opcionales (si no se configuran, no se generan alertas para ese sensor). El valor debe ser un número decimal coherente con la unidad del sensor. | Almacenar `umbral_minimo` y `umbral_maximo` como campos separados (nullable) en la tabla `sensor_thresholds`, junto a sensor_id y el usuario que los configuró. Registrar la operación en auditoría. |
| El usuario guarda un umbral y la última lectura del sensor ya supera ese valor | El sistema muestra inmediatamente un mensaje informativo: "La última lectura del sensor ([valor] [unidad]) ya supera el umbral que configuraste ([umbral] [unidad])." | Verificar la condición al momento del guardado comparando el nuevo umbral con la última lectura de la tabla `sensor_readings` para ese sensor. |
| El usuario modifica un umbral existente | Los nuevos umbrales aplican para las lecturas recibidas a partir del momento del cambio. Las alertas ya generadas previamente no se modifican ni se eliminan retroactivamente. | Actualizar el registro en `sensor_thresholds`. No crear histórico de versiones de umbrales en el MVP (sobrescribir el valor). |
| El usuario elimina un umbral | El sensor deja de generar alertas por superar ese umbral. Las alertas ya generadas permanecen visibles hasta ser marcadas como revisadas por el usuario. | Setear `umbral_minimo` o `umbral_maximo` a NULL según corresponda. Si ambos son NULL, no se evaluarán alertas para ese sensor. |

## Endpoints relacionados

- `GET /api/sensores/:sensorId/umbral`
- `PUT /api/sensores/:sensorId/umbral`

## Notas / decisiones

- Implementado en `src/modules/umbral-sensor`, anidado bajo la ruta de sensores.
