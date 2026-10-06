#!/bin/sh
# Arranque del broker MQTT (D-026).
#
# 1. Inicializa el plugin dynamic security la primera vez, con el usuario que
#    la API usa para administrar las credenciales de los sensores.
# 2. Si hay dominio (producción), copia el certificado que Caddy obtiene y
#    renueva. Mosquitto corre como usuario `mosquitto` y la clave de Caddy es
#    de root: se copia con el dueño correcto. actualizar.sh reinicia este
#    contenedor una vez por día para tomar las renovaciones.
# 3. Mosquitto no expande variables en su configuración: se reemplaza
#    ${MQTT_DOMINIO} antes de arrancar.
set -eu

DYNSEC=/mosquitto/data/dynamic-security.json
PLANTILLA="${MOSQUITTO_CONF:-/mosquitto/config/mosquitto.conf}"
CONF=/mosquitto/data/mosquitto.conf

if [ ! -f "$DYNSEC" ]; then
  : "${MQTT_ADMIN_USUARIO:?falta MQTT_ADMIN_USUARIO}"
  : "${MQTT_ADMIN_PASSWORD:?falta MQTT_ADMIN_PASSWORD}"
  mosquitto_ctrl dynsec init "$DYNSEC" "$MQTT_ADMIN_USUARIO" "$MQTT_ADMIN_PASSWORD"
fi
chown mosquitto:mosquitto "$DYNSEC"
chmod 0600 "$DYNSEC"

if [ -n "${MQTT_DOMINIO:-}" ]; then
  ORIGEN="/caddy-data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/$MQTT_DOMINIO"
  mkdir -p /mosquitto/certs
  cp "$ORIGEN/$MQTT_DOMINIO.crt" /mosquitto/certs/servidor.crt
  cp "$ORIGEN/$MQTT_DOMINIO.key" /mosquitto/certs/servidor.key
  chown -R mosquitto:mosquitto /mosquitto/certs
  chmod 0600 /mosquitto/certs/servidor.key
fi

cp "$PLANTILLA" "$CONF"
chown mosquitto:mosquitto "$CONF"
exec mosquitto -c "$CONF"
