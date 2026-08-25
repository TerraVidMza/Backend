# Despliegue del Backend en Google Cloud

Runbook para poner la API en producción sobre **Cloud Run + Cloud SQL**. Reemplaza el esquema VPS + Nginx + PM2 que describe [`ARCHITECTURE.md` §3.3](ARCHITECTURE.md); el motivo del cambio está en [D-018](DECISIONS.md).

Requisitos previos: [gcloud CLI](https://cloud.google.com/sdk/docs/install) instalado, una cuenta de facturación activa y permisos de propietario sobre el proyecto de Google Cloud.

---

## 1. Por qué esta arquitectura

| Servicio | Rol |
|---|---|
| **Cloud Run** | La API. Recibe el tráfico, termina TLS con certificado gestionado, escala. |
| **Cloud SQL** | PostgreSQL 16 administrado, con backups diarios y point-in-time recovery. |
| **Secret Manager** | Los secretos (JWT, contraseña de la base, clave IoT, Firebase), inyectados como variables de entorno al arrancar. |
| **Cloud Build** | Construye la imagen desde el [`Dockerfile`](../Dockerfile) en cada deploy. |
| **Artifact Registry** | Guarda las imágenes. Se crea solo en el primer deploy. |

Ninguno de los cinco requiere administrar un sistema operativo: no hay servidor que parchear, ni certificados que renovar, ni PM2 que supervisar.

**La alternativa evaluada** es una VM `e2-micro` de Compute Engine con `docker compose` —la API y Postgres en la misma máquina, igual que en desarrollo—. Entra en el nivel gratuito permanente de Google, así que gana si el presupuesto es cero, pero HTTPS, backups y parches quedan a cargo del equipo, y las regiones gratuitas están en Estados Unidos (unos 150 ms extra desde Mendoza).

### No hace falta PostGIS

El [`docker-compose.yml`](../docker-compose.yml) de desarrollo usa la imagen `postgis/postgis`, así que la suposición natural es que la base de producción necesita la extensión. No la necesita: el centroide de los cuarteles está modelado como dos columnas `decimal(10,7)` —decisión deliberada, documentada en `cuartel.entity.ts`— y la única extensión que piden las migraciones es `btree_gist`, que Cloud SQL soporta de fábrica. Una instancia PostgreSQL común alcanza.

---

## 2. Tres restricciones del código que fijan la configuración

Cloud Run apaga las instancias sin tráfico y le corta la CPU al contenedor entre requests. El backend tiene tres puntos que asumen un proceso vivo. Ninguno es un error —los tres están documentados como decisiones conscientes— pero determinan los parámetros del deploy.

### 2.1. Los eventos se procesan después de responder

`EventEmitterModule` ([`app.module.ts`](../src/app.module.ts)) desacopla del camino de respuesta el trabajo que no le importa a quien hizo el request: evaluar umbrales de sensores, generar alertas, notificar. Ese trabajo arranca *después* de que la respuesta salió.

Con la configuración por defecto de Cloud Run —CPU asignada solo durante el request— queda congelado hasta que llegue otro request. Una alerta de riesgo de helada que se procesa cuando alguien abre la app horas más tarde no es una alerta.

**Configuración:** `--no-cpu-throttling` (en la consola, «CPU siempre asignada»). Es el más determinante de los tres, y es independiente del cron.

### 2.2. El cron vive dentro del proceso

Las tres purgas nocturnas de [`tareas-programadas.service.ts`](../src/common/tareas/tareas-programadas.service.ts) usan `@nestjs/schedule`, que programa los temporizadores en memoria. Sin instancia encendida a las 3 AM no corre nada; con tres instancias corre tres veces. El propio archivo ya lo advierte y aclara que las tareas son idempotentes, así que el peor caso es trabajo duplicado y no datos corruptos.

**Configuración:** `--min-instances=1 --max-instances=1`. Hay exactamente una instancia y el cron se comporta igual que en desarrollo. Ver [§10](#10-cuando-haga-falta-escalar) para el camino de salida.

### 2.3. Las migraciones necesitan `src/` y ts-node

El DataSource de la CLI ([`data-source.ts`](../src/config/data-source.ts)) apunta a `src/**/*.entity.ts` y se invoca vía `ts-node`. La imagen de producción solo lleva `dist/` y las dependencias de runtime, así que `migration:run` no puede correr desde el contenedor desplegado.

**Configuración:** las migraciones se corren desde una máquina de desarrollo a través del Cloud SQL Auth Proxy ([§5](#5-migrar-el-esquema-y-crear-el-rol-acotado)). Esto además *refuerza* [D-017](DECISIONS.md): las credenciales con permiso de DDL nunca llegan a Cloud Run, que solo conoce el rol acotado `terravid_app`.

### Lo que ya está correcto

`TRUST_PROXY_HOPS=1` es el valor adecuado: Cloud Run pone exactamente un proxy (el front end de Google) delante de la app, así que `req.ip` —el que alimenta el log de auditoría y el rate limiting— resuelve la IP real del cliente. Y `DB_SYNCHRONIZE` ya se ignora cuando `NODE_ENV=production` ([D-007](DECISIONS.md)).

---

## 3. Proyecto, variables y APIs

Los pasos que siguen son una **secuencia**, no una lista: el rol acotado otorga privilegios sobre las tablas *existentes*, así que no se puede crear antes de correr las migraciones.

Definí las variables una vez en la terminal; todos los comandos posteriores las usan.

```bash
PROJECT=terravid-prod
REGION=southamerica-east1
INSTANCE=terravid-db
SERVICE=terravid-api
SA=terravid-api

gcloud projects create $PROJECT           # o usá uno existente
gcloud config set project $PROJECT
# Vinculá la cuenta de facturación desde la consola antes de seguir.

gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com
```

Sobre la región: `southamerica-east1` (São Paulo) tiene el catálogo de servicios más completo; `southamerica-west1` (Santiago) es la más cercana a Mendoza. **Cloud Run y Cloud SQL tienen que estar en la misma región.**

---

## 4. Crear la instancia de PostgreSQL

`db-g1-small` (1 vCPU compartida, 1,7 GB) es el tamaño razonable para arrancar. `db-f1-micro` es más barata, pero con 0,6 GB se pelea con la memoria en cuanto hay consultas concurrentes sobre el histórico de lecturas.

```bash
gcloud sql instances create $INSTANCE \
  --database-version=POSTGRES_16 \
  --edition=enterprise \
  --tier=db-g1-small \
  --region=$REGION \
  --storage-size=10GB \
  --storage-type=SSD \
  --storage-auto-increase \
  --backup-start-time=07:00 \
  --availability-type=ZONAL \
  --root-password='<contraseña-larga-generada>'

gcloud sql databases create terravid --instance=$INSTANCE
```

La contraseña de `postgres` va al gestor de contraseñas del equipo. Es la credencial de DDL: se usa para las migraciones y **no** va a Secret Manager ni a Cloud Run.

`--availability-type=ZONAL` es una sola zona. Para alta disponibilidad es `REGIONAL`, que duplica el costo de la instancia; para un piloto, zonal con backups diarios es la relación correcta.

---

## 5. Migrar el esquema y crear el rol acotado

La instancia no tiene IP pública abierta a internet, y así debe quedar. El [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/sql-proxy#install) hace un túnel autenticado con las credenciales de `gcloud` y expone la base en un puerto local. Dejalo corriendo en una terminal aparte:

```bash
# Windows: cloud-sql-proxy.exe
./cloud-sql-proxy $PROJECT:$REGION:$INSTANCE --port 5433
```

El puerto `5433` es a propósito: el `5432` lo ocupa el Postgres de desarrollo en Docker, y confundir las dos bases mientras se corren migraciones es un mal rato evitable.

Con el proxy abierto, apuntá un `.env` aparte a la base de producción. No sobreescribas el `.env` de desarrollo:

```bash
# .env.produccion  (NO se commitea)
DB_HOST=127.0.0.1
DB_PORT=5433
DB_DATABASE=terravid
DB_MIGRATION_USERNAME=postgres
DB_MIGRATION_PASSWORD=<la-root-password-de-la-sección-4>
```

```bash
# 1. El esquema. Crea las tablas, los índices y btree_gist.
cp .env .env.desarrollo && cp .env.produccion .env
npm run migration:run
npm run migration:show                    # todas con [X]

# 2. El rol con el que se conecta la API. Va después de las migraciones:
#    otorga privilegios sobre las tablas que ya existen.
DB_APP_PASSWORD='<otra-contraseña-larga-generada>' npm run db:rol-app

# 3. Verificar que quedó acotado de verdad.
npm run db:verificar-privilegios

# 4. Datos iniciales (roles de usuario, catálogos).
npm run seed

cp .env.desarrollo .env                   # volver a desarrollo
```

Anotá la `DB_APP_PASSWORD`: es la que va a Secret Manager en el paso siguiente y no queda guardada en ningún archivo. Si se pierde, volvé a correr `db:rol-app` con una nueva — el script es idempotente y actualiza la contraseña.

**Este paso se repite en cada deploy que traiga migraciones nuevas:** proxy, `migration:run`, y `db:rol-app` si la migración creó tablas.

---

## 6. Guardar los secretos

Nada de esto va en variables de entorno planas. Los JWT tienen que ser valores nuevos y aleatorios, no los del [`.env.example`](../.env.example).

```bash
crear_secreto() { printf '%s' "$2" | gcloud secrets create "$1" --data-file=- ; }

crear_secreto DB_PASSWORD         '<la DB_APP_PASSWORD de la sección 5>'
crear_secreto JWT_SECRET          "$(openssl rand -base64 48)"
crear_secreto JWT_REFRESH_SECRET  "$(openssl rand -base64 48)"
crear_secreto IOT_API_KEY         "$(openssl rand -hex 32)"
```

La clave IoT que se genera acá es la que va a los nodos ESP32 en el header `X-Api-Key`. Anotala aparte: se necesita al flashear el firmware.

Si se activan mails reales (`MAIL_TRANSPORT=smtp`) y push real (`PUSH_TRANSPORT=fcm`), agregá `SMTP_PASS` y `FIREBASE_PRIVATE_KEY`.

> **La clave de Firebase tiene una trampa.** `credenciales-firebase.ts` hace `.replace(/\\n/g, '\n')` sobre el valor, así que el secreto se guarda con los saltos **escapados como texto** (`-----BEGIN PRIVATE KEY-----\nMII...`), igual que en el `.env`, y no con saltos de línea reales. Guardado con saltos reales, la firma del token de FCM falla con un error de clave inválida que no dice nada útil. Ver [D-015](DECISIONS.md).

---

## 7. Cuenta de servicio con permisos mínimos

Por defecto Cloud Run corre con la cuenta de servicio de Compute, que tiene rol de Editor sobre todo el proyecto. Para una API expuesta a internet eso es demasiado: una cuenta propia que solo pueda conectarse a la base y leer sus secretos.

```bash
gcloud iam service-accounts create $SA \
  --display-name="TerraVid API (Cloud Run)"

MIEMBRO="serviceAccount:$SA@$PROJECT.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT \
  --member="$MIEMBRO" --role="roles/cloudsql.client"

for S in DB_PASSWORD JWT_SECRET JWT_REFRESH_SECRET IOT_API_KEY; do
  gcloud secrets add-iam-policy-binding $S \
    --member="$MIEMBRO" --role="roles/secretmanager.secretAccessor"
done
```

Es el mismo criterio de [D-017](DECISIONS.md) aplicado a IAM: el proceso solo tiene los permisos que necesita para funcionar.

---

## 8. Desplegar

`--source .` detecta el [`Dockerfile`](../Dockerfile) del repositorio, lo construye con Cloud Build y crea el repositorio de Artifact Registry en la primera corrida. El primer deploy tarda unos minutos; los siguientes reutilizan capas.

```bash
gcloud run deploy $SERVICE \
  --source . \
  --region=$REGION \
  --service-account="$SA@$PROJECT.iam.gserviceaccount.com" \
  --add-cloudsql-instances="$PROJECT:$REGION:$INSTANCE" \
  --allow-unauthenticated \
  --cpu=1 --memory=1Gi --cpu-boost \
  --min-instances=1 --max-instances=1 --no-cpu-throttling \
  --timeout=60 \
  --set-env-vars="^;^\
NODE_ENV=production;\
DB_HOST=/cloudsql/$PROJECT:$REGION:$INSTANCE;\
DB_DATABASE=terravid;\
DB_USERNAME=terravid_app;\
DB_SYNCHRONIZE=false;\
BCRYPT_SALT_ROUNDS=12;\
JWT_EXPIRES_IN=8h;\
JWT_REFRESH_EXPIRES_IN=7d;\
TRUST_PROXY_HOPS=1;\
MAIL_TRANSPORT=log;\
PUSH_TRANSPORT=log;\
CORS_ORIGIN=https://<tu-frontend>;\
APP_URL=https://<tu-frontend>;\
ALERTAS_VENTANA_DEDUP_MINUTOS=60;\
NOTIFICACIONES_RETENCION_DIAS=30;\
LECTURAS_RETENCION_DIAS=30" \
  --set-secrets="\
DB_PASSWORD=DB_PASSWORD:latest,\
JWT_SECRET=JWT_SECRET:latest,\
JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest,\
IOT_API_KEY=IOT_API_KEY:latest"
```

Dos detalles que no son obvios:

- **`DB_HOST` es una ruta, no un host.** Con `--add-cloudsql-instances`, Cloud Run monta un socket Unix en `/cloudsql/...`. El driver `pg` trata cualquier host que empiece con `/` como socket, así que [`typeorm.config.ts`](../src/config/typeorm.config.ts) funciona sin un solo cambio y `DB_PORT` se ignora.
- **El `^;^` al principio de `--set-env-vars`** cambia el separador de coma a punto y coma. Sin eso, `gcloud` parte `DB_HOST=/cloudsql/proyecto:región:instancia` en pedazos al encontrar la coma de la variable siguiente.

Cuando termina, el comando imprime la URL del servicio. Verificación:

```bash
curl -i https://<tu-url>/api
# 401 es la respuesta correcta: el JwtAuthGuard global está activo y la ruta
# raíz no es pública. Un 502 o 503 significa que el contenedor no arrancó.

gcloud run services logs tail $SERVICE --region=$REGION
```

---

## 9. Conectar el frontend y los nodos IoT

**Frontend.** Su base URL apunta a `https://<tu-url>/api`. Si el dominio del frontend cambia, hay que actualizar `CORS_ORIGIN` y `APP_URL`; el segundo es el que arma los enlaces de los mails de recuperación de contraseña (HU-03), así que un valor viejo genera links rotos.

**Nodos ESP32.** Cloud Run solo habla HTTPS, sin fallback a HTTP. En el firmware:

- Cargar el certificado raíz de Google (*GTS Root R1*) en el cliente TLS. `setInsecure()` no puede llegar al firmware definitivo: deja la clave IoT expuesta a un man-in-the-middle en la red del viñedo.
- El header `X-Api-Key` lleva el valor de `IOT_API_KEY` de la [sección 6](#6-guardar-los-secretos).
- Con `min-instances=1` no hay cold start, así que los timeouts del ESP32 no necesitan margen extra.

**Dominio propio** (por ejemplo `api.terravid.com.ar`): `gcloud beta run domain-mappings create`, o un balanceador de carga global si además se quiere Cloud Armor delante. El certificado lo gestiona Google en los dos casos.

---

## 10. Cuando haga falta escalar

Este paso **todavía no** hay que hacerlo. Queda anotado para cuando `max-instances=1` deje de alcanzar, porque a partir de ahí el cron in-process empieza a duplicar trabajo.

1. Exponer las tres tareas de `tareas-programadas.service.ts` como endpoints `POST`, y desactivar los decoradores `@Cron` cuando `NODE_ENV=production`.
2. Proteger esos endpoints con autenticación OIDC de Cloud Run —no con un token en el código.
3. Crear los jobs de Cloud Scheduler apuntando a esos endpoints con `--oidc-service-account-email`.
4. Recién entonces subir `--max-instances`.

El otro cabo suelto del mismo tamaño es `EventEmitterModule`: es in-process, así que un reinicio pierde los eventos en vuelo. Con una instancia y despliegues poco frecuentes es tolerable; con varias instancias y alertas que importan, la respuesta es una cola real (Pub/Sub, o BullMQ sobre Memorystore como preveía `ARCHITECTURE.md`).

---

## 11. Costo estimado

Órdenes de magnitud para una instancia siempre encendida en `southamerica-east1`, **no una cotización**. Los precios cambian y las regiones de Sudamérica tienen recargo sobre las de Estados Unidos: pasá la configuración por la [calculadora oficial](https://cloud.google.com/products/calculator) antes de comprometer un número.

| Servicio | Configuración | USD / mes aprox. |
|---|---|---|
| Cloud Run | 1 vCPU, 1 GiB, una instancia siempre encendida con CPU asignada | 40 – 60 |
| Cloud SQL | `db-g1-small` zonal + 10 GB SSD + backups | 30 – 50 |
| Secret Manager | 4 a 6 secretos | < 1 |
| Cloud Build | Unos pocos deploys por semana | < 1 |
| Egreso de red | Tráfico de un piloto | 1 – 5 |
| **Total** | | **75 – 115** |

El rubro caro es la instancia siempre encendida, y viene directo de las secciones [2.1](#21-los-eventos-se-procesan-después-de-responder) y [2.2](#22-el-cron-vive-dentro-del-proceso): es el precio de no haber sacado todavía el cron y los eventos del proceso. Tres formas de bajarlo, en orden de conveniencia:

- **Los USD 300 de crédito** del período de prueba de Google cubren unos tres meses. Suficiente para todo el piloto.
- **Hacer la [sección 10](#10-cuando-haga-falta-escalar)** y dejar que Cloud Run escale a cero: el costo de la API se vuelve casi nulo fuera de horario, a cambio de unos segundos de latencia en el primer request.
- **La VM `e2-micro`** del nivel gratuito permanente, con la base en la misma máquina. Costo cero, a cambio de administrarla.

---

## 12. Verificación posterior al primer deploy

Lo mínimo para poder decir que está en producción y no solo desplegado:

- [ ] `GET /api` devuelve 401, y el login con un usuario del seed devuelve un JWT.
- [ ] El endpoint de ingesta IoT acepta una lectura con la `X-Api-Key` correcta y la rechaza sin ella.
- [ ] `npm run push:diagnostico` pasa, si se activó FCM.
- [ ] Un presupuesto con alerta por mail al 50 %, 90 % y 100 % en *Facturación → Presupuestos*. Es lo que evita la sorpresa de fin de mes.
- [ ] Una verificación de tiempo de actividad en Cloud Monitoring contra `/api`, esperando 401.
- [ ] Los logs de las 3 AM del día siguiente muestran las tres purgas: confirma que el cron in-process efectivamente corre en Cloud Run.
- [ ] Una restauración de backup probada en una instancia descartable. Un backup que nunca se restauró no es un backup.
- [ ] Las contraseñas de `postgres` y de `terravid_app` en el gestor compartido del equipo, no en un chat.
