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

# El SHA cuya imagen se está esperando. Existe por dos razones: para no repetir
# el mismo aviso cada dos minutos, y para que se pueda ver de afuera que la VM
# está esperando —si el workflow falló, los merges dejan de llegar y sin esto
# no habría ninguna señal—.
readonly MARCA_ESPERA="$ESTADO/esperando-imagen"

log() { echo "==> $*"; }
error() { echo "!!! $*" >&2; }

# Avisa una sola vez por commit. Esperar es lo normal —el workflow tarda unos
# minutos— así que no es un error; pero esperar para siempre sí significa que
# el build falló, y por eso queda el archivo.
anotar_espera() {
  local sha="$1"
  if [ "$(cat "$MARCA_ESPERA" 2>/dev/null || true)" != "$sha" ]; then
    printf '%s' "$sha" >"$MARCA_ESPERA"
    log "esperando la imagen de $sha (el workflow sigue corriendo, o falló)"
  fi
}

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

  # ---- 1. cuál es el commit objetivo -------------------------------------
  # Se mira `origin/main` **sin** tocar el árbol de trabajo todavía. El repo
  # local se mueve más abajo, recién cuando se sabe que hay una imagen para ese
  # commit: hasta entonces el checkout tiene que seguir coincidiendo con lo que
  # está corriendo.
  local git_antes objetivo corto
  git_antes=$(git -C "$REPO" rev-parse HEAD)
  git -C "$REPO" fetch --quiet origin main
  objetivo=$(git -C "$REPO" rev-parse origin/main)
  corto=${objetivo:0:7}

  # ---- 2. la imagen de ESE commit, no la etiqueta móvil ------------------
  # Acá estaba el problema que esto arregla. Siguiendo `:main` el despliegue
  # disparaba dos veces por merge: el `git fetch` ve el commit al instante,
  # pero la imagen tarda lo que tardan los tests y el build. El primer
  # despliegue aplicaba el código nuevo **con la imagen vieja** y el segundo,
  # tres minutos después, corregía. Dos recreaciones del contenedor y una
  # ventana en la que el compose y la imagen no eran del mismo commit.
  #
  # Con la etiqueta del SHA no hay ambigüedad posible: o existe la imagen de
  # este commit y se despliega entero, o no existe y se espera. De paso, «qué
  # está corriendo» pasa a ser una pregunta con una sola respuesta.
  local base=$imagen
  # Se saca la etiqueta solo si la hay: el `:` de un host con puerto
  # (`registro:5000/repo`) no es una etiqueta, y cortar ahí rompería el nombre.
  case "${imagen##*/}" in *:*) base=${imagen%:*} ;; esac
  local objetivo_imagen="${base}:${corto}"

  autenticar_registro "${base%%/*}" || error "sigo igual; el pull va a decir si alcanzaba"

  local salida
  if ! salida=$(docker pull -q "$objetivo_imagen" 2>&1); then
    # «not found» es el caso normal: el workflow todavía no terminó. Cualquier
    # otro error —red, credenciales— sí hay que informarlo.
    if grep -q 'not found' <<<"$salida"; then
      anotar_espera "$corto"
      return 0
    fi
    error "no pude traer $objetivo_imagen:"
    printf '%s\n' "$salida" | sed 's/^/    /' >&2
    return 1
  fi
  rm -f "$MARCA_ESPERA"

  # Se comparan identificadores locales entre sí: el `.Image` del contenedor y
  # el `.Id` de la imagen son la misma clase de valor. El digest del registro
  # es otra cosa y mezclarlos daría diferencias falsas.
  local id_objetivo id_corriendo digest_antes api_viva=no
  id_objetivo=$(docker image inspect --format '{{.Id}}' "$objetivo_imagen")
  id_corriendo=$(docker inspect --format '{{.Image}}' terravid-api 2>/dev/null || echo ninguna)
  digest_antes=$(docker image inspect \
    --format '{{if .RepoDigests}}{{index .RepoDigests 0}}{{end}}' "$id_corriendo" 2>/dev/null || echo "")

  if [ "$(docker inspect -f '{{.State.Running}}' terravid-api 2>/dev/null || echo false)" = true ]; then
    api_viva=si
  fi

  if [ "$id_objetivo" = "$id_corriendo" ] &&
    [ "$git_antes" = "$objetivo" ] &&
    [ "$api_viva" = si ]; then
    log "sin cambios ($corto)"
    return 0
  fi

  # La marca es el par commit + imagen, no la imagen sola. Un merge que solo
  # cambia el Caddyfile o el compose da la misma imagen —esos archivos no entran
  # al contexto de build—, así que con la imagen sola el arreglo de un
  # despliegue roto quedaría bloqueado por el despliegue que rompió. Y guardar
  # solo el commit bloquearía una imagen corregida para el mismo commit,
  # republicada a mano.
  local marca="$objetivo $id_objetivo"
  if [ -f "$MARCA_FALLIDO" ] && [ "$marca" = "$(cat "$MARCA_FALLIDO")" ]; then
    log "$corto con esta imagen ya falló antes; espero algo nuevo en lugar de reintentar"
    return 0
  fi

  # ---- 3. recién ahora se mueve el checkout ------------------------------
  # Al commit exacto cuya imagen ya está en disco, no a `origin/main`: si
  # alguien mergeó algo en el medio, este despliegue sigue siendo coherente y
  # el próximo tic se ocupa del commit siguiente.
  #
  # `reset --hard` porque esta máquina refleja `main` y nada más: cualquier
  # edición local se descarta. Los dos `.env` no están versionados y sobreviven.
  git -C "$REPO" reset --hard --quiet "$objetivo"

  log "desplegando $corto"
  [ "$id_objetivo" != "$id_corriendo" ] && log "imagen: $objetivo_imagen"
  [ "$git_antes" != "$objetivo" ] && log "código: ${git_antes:0:7} -> $corto"

  # Que compose use la etiqueta del commit y no la de `.env`. El shell gana
  # sobre el archivo, así que alcanza con exportarla.
  export API_IMAGE="$objetivo_imagen"
  local git_despues=$objetivo

  # ---- 4. migrar ----------------------------------------------------------
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

  # ---- 5. levantar --------------------------------------------------------
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

  # ---- 6. verificar -------------------------------------------------------
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

  # ---- 7. volver atrás ----------------------------------------------------
  error "la API no responde después del despliegue de $corto"
  printf '%s' "$marca" >"$MARCA_FALLIDO"

  if [ -z "$digest_antes" ] || [ "$digest_antes" = "$objetivo_imagen" ]; then
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

# Comprueba que la API pueda servir, no solo que el proceso haya arrancado.
#
# `/api/salud` consulta la base antes de contestar, asi que un 200 ahi dice que
# la aplicacion sirve. Antes esto miraba `/api` y aceptaba el 401 del guard, que
# se produce **antes** de tocar nada: una API que arranco y perdio Postgres
# pasaba la verificacion igual.
#
# El 404 es el caso que importa y que costo un incidente: una imagen anterior a
# `/api/salud` no tiene esa ruta, asi que responde 404 y no 401. Al hacer
# rollback a una de esas, la verificacion daba por muerta una API que estaba
# perfectamente viva, y el script terminaba en "hace falta intervenir a mano"
# con produccion funcionando. Por eso, ante un 404 se reintenta contra `/api`:
# si ahi contesta 401 o 200, es una imagen vieja sana.
#
# Hasta 90 segundos: en una e2-micro con 0,25 vCPU de linea base el arranque de
# Nest no es inmediato.
verificar_salud() {
  local dominio="$1" codigo
  for _ in $(seq 1 45); do
    codigo=$(probar "$dominio" /api/salud)
    case "$codigo" in
    200)
      log "responde ($codigo)"
      return 0
      ;;
    404)
      # Imagen anterior a /api/salud: se verifica como se verificaba entonces.
      codigo=$(probar "$dominio" /api)
      case "$codigo" in
      401 | 200)
        log "responde ($codigo en /api; imagen sin /api/salud)"
        return 0
        ;;
      esac
      ;;
    esac
    sleep 2
  done
  error "ultima respuesta: ${codigo:-sin respuesta}"
  return 1
}

# Entra por Caddy con el nombre real resuelto a loopback: asi el certificado
# coincide y se ejerce el mismo camino que usa un cliente.
probar() {
  curl -sk -o /dev/null -w '%{http_code}' --max-time 5     --resolve "${1}:443:127.0.0.1" "https://${1}${2}" 2>/dev/null || echo 000
}

main "$@"
