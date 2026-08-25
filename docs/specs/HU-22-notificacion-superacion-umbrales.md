# HU-22 — Notificación por superación de umbrales

| Campo | Valor |
|---|---|
| **Actor** | Propietario o Agrónomo |
| **Área** | Telemetría IoT |
| **Módulo backend** | `src/modules/alertas-iot` |
| **Entidad principal** | `LECTURA_TELEMETRIA`, `NOTIFICACION` |
| **Prioridad** | Media |
| **Complejidad** | Media |
| **Precondiciones** | HU-19 (lectura recibida) y HU-21 (umbral configurado) |
| **Pantallas (Figma)** | PAN-17: Gráficos de Telemetría y Configuración de Umbrales — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** sin deduplicación: genera una alerta por cada lectura mientras dure la condición. No se envía email. Los destinatarios se filtran por empresa, no por finca. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Criterios (2026-08-25):** se agregó **deduplicación** por sensor, tipo y ventana configurable (`ALERTAS_VENTANA_DEDUP_MINUTOS`, 1 h por defecto) y el **correo de alerta** con enlace al panel. Un sensor fuera de umbral toda una noche generaba ~100 alertas idénticas.
>
> **Decisiones de modelo (2026-08-25):** ✅ **cerrado el criterio de destinatarios**: la tabla `usuario_finca` permite asignar usuarios a fincas y las alertas van a los de la finca afectada ([D-012](../DECISIONS.md)). Sin asignaciones se reciben las de todas las fincas de la empresa, para no dejar de notificar en silencio mientras nadie configure nada.

## Descripción

Como **Propietario o Agrónomo**
Quiero **recibir una notificación automática cuando una lectura supera el umbral configurado**
Para **reaccionar a tiempo ante condiciones críticas del campo sin monitorear constantemente.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| Una lectura entrante supera el umbral mínimo o máximo configurado para ese sensor | El sistema genera una alerta con los datos: sensor (código y nombre), finca, tipo de alerta (mínimo/máximo superado), valor de la lectura, umbral configurado, timestamp de la lectura y estado inicial "no revisada". La alerta aparece en el panel de alertas in-app con un badge numérico en el ícono de notificaciones. | Evaluación de umbrales asíncrona (worker/queue). Tabla `alerts` con campos: id, sensor_id, tipo_alerta, valor, umbral, timestamp_lectura, estado (no-revisada/revisada), revisada_por, revisada_at. |
| El sistema detecta lecturas consecutivas fuera de rango del mismo sensor dentro de una ventana de 1 hora | Solo se genera una alerta por sensor por ventana de 1 hora. Las lecturas subsiguientes fuera de rango dentro de esa ventana no generan alertas duplicadas. Al cabo de la ventana, si el sensor continúa fuera de rango, se genera una nueva alerta. | Implementar deduplicación: al intentar crear una alerta, verificar si ya existe una alerta no revisada del mismo sensor y tipo dentro de la última hora. La ventana de agrupación de 1 hora es configurable por variable de entorno. |
| Se genera una alerta | El sistema envía un email asíncrono a todos los usuarios con rol Propietario y Agrónomo de la finca afectada. El email incluye: asunto "[ALERTA] Sensor [nombre] - [finca]", cuerpo con el detalle de la alerta, y un enlace directo al panel de telemetría del sensor. | El envío de email se realiza en una cola de tareas asíncrona (Bull/Redis) para no bloquear la ingesta de lecturas. Usar el SMTP configurado en HU-33. |
| El usuario accede al panel de alertas y marca una alerta como revisada | La alerta cambia de estado a "revisada", se registra el userId del usuario que la revisó y el timestamp. El badge numérico del ícono de notificaciones disminuye en 1. | Solo el Propietario y el Agrónomo pueden marcar alertas como revisadas. |

## Endpoints relacionados

- `GET /api/alertas-iot/pendientes`
- `PATCH /api/alertas-iot/:id/revisar`

## Notas / decisiones

- El documento maestro referencia `PATCH /alerts/:id`; la implementación real usa `PATCH /alertas-iot/:id/revisar`. Verificar si ya existe el worker de envío de email — no confirmado por inspección de rutas.
