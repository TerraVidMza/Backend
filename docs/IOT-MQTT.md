# Contrato MQTT para los sensores (D-026)

Cómo publica un nodo (ESP32 o el simulador) sus lecturas por MQTT. La ingesta
por HTTP (`POST /api/lecturas-iot` con `X-Api-Key`) sigue funcionando como
respaldo.

## Conexión

| Parámetro | Valor |
|---|---|
| Broker | `mqtts://terravid-api.duckdns.org:8883` (en desarrollo, `mqtt://localhost:1883`) |
| TLS | Sí, certificado de Let's Encrypt (validar contra las CA raíz de ISRG) |
| Usuario | el **código del sensor**, tal como figura en la Web (ej. `SM-001`) |
| Contraseña | la que muestra la Web al generar la credencial (una sola vez) |
| Client ID | libre; se recomienda el código del sensor |
| Protocolo | MQTT 3.1.1 o 5 |

La credencial se genera en **Telemetría → sensor → Credencial MQTT**. Generarla
de nuevo invalida la anterior. Dar de baja el sensor la deshabilita.

## Publicación

- **Tópico:** `terravid/sensores/{codigo}/lecturas`. El broker solo deja
  publicar a cada sensor en su propio tópico: cualquier otro se descarta.
- **QoS:** 1 (al menos una vez). La ingesta tolera duplicados: es la misma
  lectura con la misma marca de tiempo.
- **Payload:** JSON.

```json
{ "valor": 23.4, "unidad": "%", "sensorTimestamp": "2026-10-05T12:00:00-03:00" }
```

| Campo | Tipo | Notas |
|---|---|---|
| `valor` | número | Se valida contra el rango físico del tipo de sensor; fuera de rango va a `lecturas_anomalas`. |
| `unidad` | texto (1–20) | |
| `sensorTimestamp` | ISO 8601 | Momento de la medición en el nodo, con zona horaria. |

El código del sensor **no** va en el payload: sale del tópico, que es la
identidad que el broker autenticó. Si se manda `codigoSensor`, se ignora.

## Errores

Un payload inválido (no es JSON, falta un campo, valor no numérico) se descarta
y queda en el log de la API. MQTT no tiene una respuesta por mensaje como HTTP;
si hace falta confirmar la recepción, la Web muestra la última lectura de cada
sensor.

## Prueba rápida

```bash
mosquitto_pub -h terravid-api.duckdns.org -p 8883 --capath /etc/ssl/certs \
  -u SM-001 -P '<contraseña>' -q 1 \
  -t terravid/sensores/SM-001/lecturas \
  -m '{"valor":23.4,"unidad":"%","sensorTimestamp":"2026-10-05T12:00:00-03:00"}'
```
