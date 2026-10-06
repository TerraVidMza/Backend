# HU-19 — Ingesta de lecturas de sensores

| Campo | Valor |
|---|---|
| **Actor** | Sistema |
| **Área** | Telemetría IoT |
| **Módulo backend** | `src/modules/lecturas-iot` |
| **Entidad principal** | `SENSOR_IOT`, `LECTURA_TELEMETRIA` |
| **Prioridad** | Alta |
| **Complejidad** | Alta |
| **Precondiciones** | HU-18 completado (sensor registrado y activo), HU-21 (umbrales configurados) |
| **Pantallas (Figma)** | PAN-11: Configuración de Dispositivos IoT — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** el endpoint de ingesta no tiene API key: cualquier usuario autenticado puede inyectar telemetría. No rechaza sensores inactivos, sin validación de rango físico. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Fase 2 (2026-08-24):** la evaluación de umbrales salió del camino de respuesta (`EventEmitter2`, F2-5) y se agregó el índice `(sensor_id, sensor_timestamp)` (F2-6). Un cron nocturno consolida las lecturas crudas de más de 30 días en promedios horarios. Falta la validación de rango físico y el rechazo de sensores inactivos.
>
> **Criterios (2026-08-25):** cerrados los dos criterios que faltaban: **validación de rango físico** por variable, con las lecturas fuera de rango apartadas a `lecturas_anomalas` en vez de contaminar los promedios, y **rechazo de sensor dado de baja** (403). Además el contrato de ingesta pasó a `codigoSensor` —la etiqueta física, que es lo que el nodo conoce—, con el UUID interno aceptado por compatibilidad.

> **MQTT (2026-10-05):** además del `POST /api/lecturas-iot`, la telemetría entra por **MQTT con TLS** (Mosquitto, puerto 8883). Cada sensor tiene usuario y contraseña propios, que el Propietario o el Agrónomo generan desde la Web, y solo puede publicar en `terravid/sensores/{codigo}/lecturas`. El código se toma del tópico, no del payload. La lectura sigue el mismo camino que por HTTP: rango físico, anómalas, umbrales y alertas. El contrato para el firmware está en [`docs/IOT-MQTT.md`](../IOT-MQTT.md). Ver [D-026](../DECISIONS.md#d-026--ingesta-de-telemetría-por-mqtt-con-credenciales-por-sensor).

## Descripción

Como **sistema**
Quiero **recibir las lecturas de los sensores de la red IoT propia y persistirlas en la base de datos**
Para **que los datos estén disponibles en tiempo real y para el motor de alertas.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| Un sensor activo envía una lectura al endpoint de ingesta | El sistema autentica la solicitud verificando la API key estática en el header Authorization. Valida que el payload contenga: codigo_sensor (string), valor (número), unidad (string) y timestamp (ISO 8601). Si todo es válido, persiste la lectura y retorna HTTP 201. | Autenticación por API key estática en header (X-Api-Key). Restricción de IPs de los sensores configurada en firewall/proxy. Usar cola de mensajes (MQTT o HTTP Queue) para no bloquear la ingesta bajo alta carga. |
| El sensor envía un timestamp de la lectura | El sistema persiste el timestamp original del sensor (no el timestamp del servidor), garantizando la fidelidad temporal del dato. El sistema también guarda el timestamp de recepción del servidor en un campo separado para diagnóstico. | Tabla `sensor_readings`: campos sensor_id, value, unit, sensor_timestamp (del hardware), received_at (del servidor). Índice en (sensor_id, sensor_timestamp) para queries de historial. |
| Una lectura proviene de un código de sensor que no está registrado en el sistema | El sistema devuelve HTTP 404 con el mensaje "Sensor no registrado" y no persiste ningún dato. El intento queda registrado en el log de auditoría. | No revelar si el código existe o no en el sistema en el mensaje de error (seguridad). Registrar el código no reconocido y la IP de origen en el log para detección de intrusos. |
| Una lectura proviene de un sensor que existe pero está inactivo | El sistema devuelve HTTP 403 con el mensaje "Sensor inactivo" y no persiste el dato. | Verificar estado del sensor en cada ingesta. Loguear el intento de envío de sensor inactivo. |
| La lectura válida supera algún umbral configurado para ese sensor (HU-21) | El sistema evalúa los umbrales de forma asíncrona tras la persistencia de la lectura. Si se supera un umbral, dispara el proceso de generación de alerta (HU-22) sin bloquear la respuesta HTTP 201 al sensor. | Evaluar umbrales en worker asíncrono / job queue para no impactar la latencia de ingesta. La ingesta debe responder en menos de 200ms bajo carga normal. |
| El sistema recibe un payload con lecturas numéricas desde los sensores IoT en los viñedos | El backend valida que el valor se encuentre dentro de los umbrales lógicos predefinidos para esa variable física (ej. Temperatura ambiente entre -15°C y 60°C; Humedad del suelo entre 0% y 100%). | Si el valor está fuera de rango, el registro se descarta para los cálculos de Inteligencia Agronómica y se guarda en una tabla de auditoría de hardware (o log de anomalías) indicando un posible fallo de calibración del sensor. |

## Endpoints relacionados

- `POST /api/lecturas-iot`
- `GET /api/lecturas-iot/sensor/:sensorId`

## Notas / decisiones

- El documento maestro referencia el endpoint como `POST /api/iot/readings`; la implementación real usa `POST /lecturas-iot`.
