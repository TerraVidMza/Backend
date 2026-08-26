#!/usr/bin/env bash
#
# Despliegue automático en la VM: trae la versión de `main` que esté publicada,
# migra el esquema, levanta la imagen nueva y verifica que responda. Si no
# responde, vuelve a la anterior.
#
# Lo dispara `terravid-deploy.timer` cada dos minutos. Para forzarlo:
#
#     sudo systemctl start terravid-deploy
#     journalctl -u terravid-deploy -f
#
# ---------------------------------------------------------------------------
# Por qué la VM busca la imagen en vez de que el CI la empuje
#
# Migrar necesita la contraseña del superusuario de Postgres, y esa contraseña
# vive únicamente en el `.env` de esta máquina: mantenerla fuera del alcance de
# la aplicación es todo el punto de la separación en dos archivos (D-017). Un
# pipeline que empujara el despliegue tendría que conocerla —o tendría que
# entrar por SSH a leerla, con lo cual la lógica termina acá de todas formas—.
# Así, GitHub solo puede publicar imágenes: no tiene acceso a esta máquina ni a
# ningún secreto de producción, y no hay que abrir el 22 a internet.
#
# El costo es que el despliegue no es instantáneo: tarda lo que falte para el
# próximo tic del timer.
# ---------------------------------------------------------------------------
#
# Todo el cuerpo está dentro de `main` a propósito. El `git reset` de abajo
# puede reemplazar **este mismo archivo**, y bash lee los scripts por pedazos a
# medida que los ejecuta: cambiarlo a mitad de camino haría que siguiera leyendo
# desde un offset que ya no significa lo mismo. Con el cuerpo en una función,
# bash lo parsea entero antes de ejecutar nada.

set -euo pipefail

readonly DIR=/opt/backend/deploy
readonly REPO=/opt/backend
readonly COMPOSE_FILE=docker-compose.prod.yml
readonly ESTADO=/var/lib/terravid
readonly LOCK=/var/lock/terravid-deploy.lock

# Una imagen que ya falló no se vuelve a intentar. Sin esto, una versión rota
# en `main` se reintentaría cada dos minutos y la API quedaría oscilando entre
# arrancar y morir en lugar de quedarse quieta en la última versión que anda.
readonly MARCA_FALLIDO="$ESTADO/imagen-fallida"

log() { echo "==> $*"; }
error() { echo "!!! $*" >&2; }

# Lee una variable de un archivo de entorno sin evaluarlo: `source` ejecutaría
# lo que hubiera adentro, y estos archivos los edita gente a mano.
leer_var() {
  local archivo="$1" clave="$2"
  [ -f "$archivo" ] || return 0
  grep -E "^${clave}=" "$archivo" | head -1 | cut -d= -f2-
}

main() {
  cd "$DIR"
  mkdir -p "$ESTADO"

  # systemd no solapa dos ejecuciones de la misma unidad, pero nada impide que
  # alguien corra el script a mano en medio de un tic del timer.
  exec 9>"$LOCK"
  if ! flock -n 9; then
    log "hay otro despliegue en curso; salgo sin hacer nada"
    return 0
  fi

  local compose="docker compose -f $COMPOSE_FILE"
  local imagen dominio
  imagen=$(leer_var .env API_IMAGE)
  dominio=$(leer_var .env DOMINIO)
  [ -n "$imagen" ] || { error "no encontré API_IMAGE en $DIR/.env"; return 1; }
  [ -n "$dominio" ] || { error "no encontré DOMINIO en $DIR/.env"; return 1; }

  # ---- 1. traer el repositorio -------------------------------------------
  # El compose, el Caddyfile y este script viven ahí, así que un despliegue no
  # es solo una imagen nueva. `reset --hard` porque esta máquina debe reflejar
  # `main` y nada más: cualquier edición local hecha acá se descarta. Los dos
  # `.env` no están versionados, así que sobreviven.
  local git_antes git_despues
  git_antes=$(git -C "$REPO" rev-parse HEAD)
  git -C "$REPO" fetch --quiet origin main
  git -C "$REPO" reset --hard --quiet origin/main
  git_despues=$(git -C "$REPO" rev-parse HEAD)

  # ---- 2. ¿hay algo nuevo? ------------------------------------------------
  local digest_antes id_antes
  id_antes=$(docker image inspect --format '{{.Id}}' "$imagen" 2>/dev/null || echo ninguna)
  digest_antes=$(docker image inspect \
    --format '{{if .RepoDigests}}{{index .RepoDigests 0}}{{end}}' "$imagen" 2>/dev/null || echo "")

  autenticar_registro "${imagen%%/*}" || error "sigo igual; el pull va a decir si alcanzaba"
  $compose pull --quiet api

  local id_despues digest_despues
  id_despues=$(docker image inspect --format '{{.Id}}' "$imagen")
  digest_despues=$(docker image inspect \
    --format '{{if .RepoDigests}}{{index .RepoDigests 0}}{{end}}' "$imagen")

  local api_viva=no
  if [ "$(docker inspect -f '{{.State.Running}}' terravid-api 2>/dev/null || echo false)" = true ]; then
    api_viva=si
  fi

  if [ "$id_antes" = "$id_despues" ] &&
    [ "$git_antes" = "$git_despues" ] &&
    [ "$api_viva" = si ]; then
    log "sin cambios (${git_despues:0:7})"
    return 0
  fi

  if [ -f "$MARCA_FALLIDO" ] && [ "$digest_despues" = "$(cat "$MARCA_FALLIDO")" ]; then
    log "esta imagen ya falló antes; espero una versión nueva en lugar de reintentar"
    return 0
  fi

  log "desplegando ${git_despues:0:7}"
  [ "$id_antes" != "$id_despues" ] && log "imagen nueva: $digest_despues"
  [ "$git_antes" != "$git_despues" ] && log "código nuevo: ${git_antes:0:7} -> ${git_despues:0:7}"

  # ---- 3. migrar ----------------------------------------------------------
  # Corre **desde la imagen recién bajada**, no desde un checkout con
  # devDependencies: `data-source.ts` deduce sus globs de su propia ubicación,
  # así que el mismo archivo sirve compilado. Antes esto era un paso manual por
  # un túnel SSH desde una máquina de desarrollo, y era lo único que impedía
  # automatizar el despliegue.
  #
  # Las credenciales van por el entorno del script y no en la línea de comandos
  # (`-e VAR` sin valor las toma de acá): un `ps` de otro usuario no las ve.
  local pass_root pass_app
  pass_root=$(leer_var .env POSTGRES_ROOT_PASSWORD)
  pass_app=$(leer_var .env.app DB_PASSWORD)
  [ -n "$pass_root" ] || { error "falta POSTGRES_ROOT_PASSWORD en .env"; return 1; }

  export DB_MIGRATION_USERNAME=postgres
  export DB_MIGRATION_PASSWORD="$pass_root"

  log "aplicando migraciones"
  $compose run --rm -T \
    -e DB_MIGRATION_USERNAME -e DB_MIGRATION_PASSWORD \
    api npm run --silent migration:run:dist

  # Idempotente, y se corre siempre: reaplica los privilegios del rol acotado.
  # Si una migración agregó una tabla y esto no corre, la API se queda sin
  # permiso para leerla. Cuesta un arranque de contenedor y evita esa clase
  # entera de fallas.
  if [ -n "$pass_app" ]; then
    log "reaplicando privilegios del rol de la aplicación"
    export DB_APP_PASSWORD="$pass_app"
    $compose run --rm -T \
      -e DB_MIGRATION_USERNAME -e DB_MIGRATION_PASSWORD -e DB_APP_PASSWORD \
      api npm run --silent db:rol-app:dist
  else
    error "no encontré DB_PASSWORD en .env.app: salteo los privilegios del rol"
  fi

  # ---- 4. levantar --------------------------------------------------------
  # Solo `api`, salvo que el compose haya cambiado de verdad. Un `up -d` de
  # todo evalúa también db y caddy, y cualquier deriva en el hash de
  # configuración de esos servicios los recrearía: un despliegue de la API no
  # tiene por qué reiniciar Postgres ni cortar TLS.
  local cambiados
  cambiados=$(git -C "$REPO" diff --name-only "$git_antes" "$git_despues")

  if grep -qx "deploy/$COMPOSE_FILE" <<<"$cambiados"; then
    log "el compose cambió: levantando todos los servicios"
    $compose up -d
  else
    log "levantando la API"
    $compose up -d api
  fi

  # El Caddyfile va montado, así que cambiarlo no recrea el contenedor. Caddy
  # recarga en caliente sin cortar conexiones.
  if grep -qx 'deploy/Caddyfile' <<<"$cambiados"; then
    log "el Caddyfile cambió: recargando Caddy"
    docker exec terravid-caddy caddy reload --config /etc/caddy/Caddyfile
  fi

  # ---- 5. verificar -------------------------------------------------------
  # Se prueba la cadena completa, entrando por Caddy con el nombre real
  # resuelto a loopback: así el certificado coincide y se ejerce el mismo
  # camino que usa un cliente. `/api` sin token responde 401, y ese 401 es la
  # señal de que la aplicación levantó y está exigiendo autenticación. Si la
  # API está caída, Caddy contesta 502.
  if verificar_salud "$dominio"; then
    rm -f "$MARCA_FALLIDO"
    log "OK: ${git_despues:0:7} en producción"
    # Libera espacio sin tocar lo reciente, que es lo que sirve para volver
    # atrás. Solo borra imágenes que ningún contenedor usa.
    docker image prune -af --filter until=168h >/dev/null 2>&1 || true
    return 0
  fi

  # ---- 6. volver atrás ----------------------------------------------------
  error "la API no responde después del despliegue"
  echo "$digest_despues" >"$MARCA_FALLIDO"

  if [ -z "$digest_antes" ] || [ "$digest_antes" = "$digest_despues" ]; then
    error "no tengo una imagen anterior a la que volver. La API queda caída."
    return 1
  fi

  error "volviendo a $digest_antes"
  API_IMAGE="$digest_antes" $compose up -d api

  if verificar_salud "$dominio"; then
    error "revertido: producción quedó en la imagen anterior."
    error "OJO: las migraciones NO se revierten. Si la versión nueva agregó"
    error "migraciones, el esquema quedó adelantado respecto del código."
  else
    error "el rollback tampoco responde. Hace falta intervenir a mano."
  fi
  return 1
}

# Docker no sabe entrar a Artifact Registry por sí solo, y el helper de gcloud no
# sirve acá: root no tiene configuración de docker, y depender de que alguien haya
# corrido `gcloud auth configure-docker` como root convierte el despliegue en algo
# que se rompe según cómo se instaló la máquina.
#
# El servidor de metadatos no depende de nada de eso. Devuelve un token de la
# cuenta de servicio de la propia VM —la misma que ya tiene permiso de lectura
# sobre el repositorio de imágenes—, dura una hora, y se pide de nuevo en cada
# corrida. Sin gcloud, sin claves y sin un paso manual de instalación.
autenticar_registro() {
  local host="$1" token
  token=$(curl -s --max-time 10 -H 'Metadata-Flavor: Google' \
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" |
    sed -n 's/.*"access_token" *: *"\([^"]*\)".*/\1/p')

  if [ -z "$token" ]; then
    error "el servidor de metadatos no devolvió un token para $host"
    return 1
  fi

  printf '%s' "$token" | docker login -u oauth2accesstoken --password-stdin "https://$host" >/dev/null
}

# 401 (sin token) o 200 cuentan como viva. Hasta 90 segundos: en una e2-micro
# con 0,25 vCPU de línea base el arranque de Nest no es inmediato.
verificar_salud() {
  local dominio="$1" codigo
  for _ in $(seq 1 45); do
    codigo=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 5 \
      --resolve "${dominio}:443:127.0.0.1" "https://${dominio}/api" 2>/dev/null || echo 000)
    case "$codigo" in
    401 | 200)
      log "responde ($codigo)"
      return 0
      ;;
    esac
    sleep 2
  done
  error "última respuesta: ${codigo:-sin respuesta}"
  return 1
}

main "$@"
