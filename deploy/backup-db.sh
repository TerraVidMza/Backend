#!/usr/bin/env bash
#
# Backup de la base a Cloud Storage. Pensado para correr desde el cron de la VM
# (Apéndice A.9 de docs/DESPLIEGUE.md):
#
#   0 7 * * *  /opt/terravid/deploy/backup-db.sh >> /var/log/terravid-backup.log 2>&1
#
# La VM del nivel gratuito no tiene snapshots automáticos: si se pierde el
# disco, se pierde la base. Esto es lo que hace que eso no sea cierto.
#
# Requiere que la cuenta de servicio de la VM tenga `roles/storage.objectAdmin`
# sobre el bucket, y el bucket una regla de ciclo de vida que borre lo viejo
# (si no, el nivel gratuito de 5 GB se llena solo).

set -euo pipefail

BUCKET="${BUCKET_BACKUPS:?falta BUCKET_BACKUPS}"
CONTENEDOR="${CONTENEDOR_DB:-terravid-db}"
BASE="${DB_DATABASE:-terravid}"
RETENCION_LOCAL_DIAS="${RETENCION_LOCAL_DIAS:-3}"
DESTINO_LOCAL="${DESTINO_LOCAL:-/var/backups/terravid}"

marca="$(date -u +%Y%m%dT%H%M%SZ)"
archivo="${DESTINO_LOCAL}/${BASE}-${marca}.sql.gz"

mkdir -p "$DESTINO_LOCAL"

echo "[$(date -uIs)] Volcando ${BASE} desde ${CONTENEDOR}..."

# `--clean --if-exists` deja un dump que se puede restaurar sobre una base que
# ya tiene el esquema, que es el caso normal cuando algo salió mal y hay que
# volver atrás. Se escribe a un temporal y se renombra al final: si el volcado
# se corta por la mitad, no queda un .sql.gz truncado con nombre de backup
# válido.
docker exec "$CONTENEDOR" \
  pg_dump --username=postgres --dbname="$BASE" --clean --if-exists \
  | gzip -9 > "${archivo}.parcial"

mv "${archivo}.parcial" "$archivo"

tamanio="$(du -h "$archivo" | cut -f1)"
echo "[$(date -uIs)] Volcado local listo: ${archivo} (${tamanio})"

gcloud storage cp "$archivo" "gs://${BUCKET}/postgres/"
echo "[$(date -uIs)] Subido a gs://${BUCKET}/postgres/$(basename "$archivo")"

# Las copias locales son solo para restaurar rápido sin bajar de la nube; el
# disco de la VM son 30 GB y no conviene llenarlo con dumps.
borradas="$(find "$DESTINO_LOCAL" -name "${BASE}-*.sql.gz" -type f \
  -mtime "+${RETENCION_LOCAL_DIAS}" -print -delete | wc -l)"

if [ "$borradas" -gt 0 ]; then
  echo "[$(date -uIs)] Copias locales borradas: ${borradas} (retención ${RETENCION_LOCAL_DIAS} días)"
fi

echo "[$(date -uIs)] Backup terminado."
