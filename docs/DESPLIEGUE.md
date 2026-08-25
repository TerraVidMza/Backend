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

**La alternativa evaluada**, con el procedimiento completo en el [Apéndice A](#apéndice-a--alternativa-de-bajo-costo-vm-e2-micro-del-nivel-gratuito), es una VM `e2-micro` de Compute Engine con `docker compose` —la API y Postgres en la misma máquina, igual que en desarrollo—. Entra en el nivel gratuito permanente de Google, así que gana si el presupuesto es cero, pero HTTPS, backups y parches quedan a cargo del equipo, y las regiones gratuitas están en Estados Unidos (unos 150 ms extra desde Mendoza).

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
#    El seed levanta un contexto Nest completo: AuthModule exige JWT_SECRET
#    y JWT_REFRESH_SECRET aunque el seed solo inserte filas.
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

---

# Apéndice A — Alternativa de bajo costo: VM `e2-micro` del nivel gratuito

Este apéndice reemplaza las secciones 3 a 8 del camino principal por un despliegue sobre **una sola VM de Compute Engine del nivel gratuito**, con la API, PostgreSQL y Caddy en `docker compose`. Es lo que conviene mientras el proyecto esté en fase experimental.

Los archivos de despliegue están en [`deploy/`](../deploy): `docker-compose.prod.yml`, `Caddyfile`, `backup-db.sh` y los dos ejemplos de entorno.

> **Sobre el shell.** Los comandos que corren *en tu máquina* usan sintaxis POSIX (`VAR=valor`, `$(comando)`, `openssl`). En Windows, corrélos desde **Git Bash** o WSL, no desde PowerShell, donde la asignación de variables y la sustitución de comandos son distintas. Los que corren *dentro de la VM* son Linux en los dos casos.

## A.1 Por qué esta opción, y qué se entrega a cambio

La razón no es solo el precio: **una VM hace desaparecer las tres restricciones de la [sección 2](#2-tres-restricciones-del-código-que-fijan-la-configuración)**. Hay un proceso Node vivo de verdad, así que el cron de `@nestjs/schedule` corre a las 3 AM, los handlers de `EventEmitterModule` procesan las alertas al instante, y las migraciones corren donde está `src/`. Cero refactor.

Y entra con holgura. La medición de los dos contenedores en reposo y después de 200 requests:

| | Reposo | Después de 200 requests |
|---|---|---|
| API (NestJS, 50 módulos) | 96 MB | 104 MB |
| PostgreSQL | 66 MB | 62 MB |
| **Total** | | **~166 MB** |

Sobre el 1 GB de la `e2-micro` queda más del 80 % libre.

Lo que se entrega a cambio:

| | Camino principal (Cloud Run) | Este apéndice (VM) |
|---|---|---|
| Costo | USD 75 – 115 / mes | USD 3 – 5 / mes |
| Latencia desde Mendoza | ~30 ms (São Paulo) | ~150 ms (las regiones gratuitas están en EE.UU.) |
| TLS | Gestionado por Google | Caddy + Let's Encrypt (automático, pero es tu proceso) |
| Backups | Automáticos, con point-in-time recovery | Un `pg_dump` por cron a Cloud Storage ([A.9](#a9-backups-a-cloud-storage)) |
| Parches del sistema | No hay sistema que parchear | Tuyos |
| Escalar | Cambiar un flag | Cambiar de máquina |
| Alta disponibilidad | Opción de configuración | No hay: una zona, una VM |

## A.2 El costo real: no es cero

El nivel gratuito **permanente** —distinto de los USD 300 del período de prueba, y sigue vigente después de que ese crédito vence— cubre:

- **1 VM `e2-micro` no interrumpible por mes**, en `us-west1` (Oregón), `us-central1` (Iowa) o `us-east1` (Carolina del Sur). Es una por cuenta de facturación, no una por proyecto.
- **30 GB-mes de disco persistente estándar.** SSD no está incluido.
- **1 GB de egreso mensual** desde Norteamérica hacia cualquier destino, excepto China y Australia.
- **5 GB-mes de Cloud Storage** en regiones de EE.UU., que es donde van los backups.
- **0,5 GB de Artifact Registry.** La imagen pesa ~576 MB, así que se pasa apenas: son centavos.

**Lo que no cubre: la IP pública.** Desde 2024 Google cobra las direcciones IPv4 externas en uso, del orden de USD 0,005/hora ≈ **USD 3–4 por mes**, y ese cargo no entra en el nivel gratuito. Es la razón por la que esto cuesta unos pocos dólares y no cero.

Los límites cambian: confirmalos en la [página del nivel gratuito](https://cloud.google.com/free/docs/free-cloud-features) y mirá la factura del primer mes.

Antes de crear nada, un presupuesto con alertas. Es lo más barato del apéndice:

```bash
# El presupuesto se crea sobre la cuenta de facturación, no sobre el
# proyecto. El ID sale de: gcloud billing accounts list
gcloud billing budgets create \
  --billing-account=<ID-DE-LA-CUENTA> \
  --display-name="TerraVid — piloto" \
  --budget-amount=10USD \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0

# Verificar que quedó, y que no haya duplicados:
gcloud billing budgets list --billing-account=<ID-DE-LA-CUENTA>
```

Requiere `billingbudgets.googleapis.com`, que se habilita en [A.3](#a3-requisitos-previos). Con la API deshabilitada, `budgets list` **falla** en vez de devolver una lista vacía: si se silencia el error, se lee como «no hay presupuestos» y se termina creando uno duplicado. Por consola es *Facturación → Presupuestos y alertas → Crear presupuesto*.

## A.3 Requisitos previos

- `gcloud` CLI autenticado y Docker instalado **en tu máquina** (la imagen se construye acá, no en la VM).
- **Un nombre de dominio que puedas apuntar.** Caddy necesita un hostname resoluble para el desafío HTTP-01 de Let's Encrypt; una IP pelada no sirve. Si el proyecto todavía no tiene dominio, [DuckDNS](https://www.duckdns.org) es gratis y alcanza.
- Las variables del [§3](#3-proyecto-variables-y-apis) definidas, y las APIs habilitadas — de esa lista, para este camino hacen falta `compute.googleapis.com`, `artifactregistry.googleapis.com` y `storage.googleapis.com`.

```bash
PROJECT=terravid-prod
ZONA=us-central1-a
REGION=us-central1
VM=terravid
DOMINIO=terravid-api.duckdns.org

gcloud config set project $PROJECT
gcloud services enable \
  compute.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com \
  billingbudgets.googleapis.com
```

## A.4 Crear la VM y abrir el firewall

```bash
# La IP se reserva primero: una IP efímera cambia cada vez que la VM se
# detiene, y el registro DNS quedaría apuntando al vacío. Reservada cuesta lo
# mismo que efímera mientras esté en uso.
gcloud compute addresses create ${VM}-ip --region=$REGION

IP=$(gcloud compute addresses describe ${VM}-ip --region=$REGION --format='value(address)')
echo "IP reservada: $IP"

gcloud compute instances create $VM \
  --zone=$ZONA \
  --machine-type=e2-micro \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-standard \
  --address=$IP \
  --tags=servidor-web \
  --scopes=https://www.googleapis.com/auth/cloud-platform
```

Tres parámetros que importan. `--boot-disk-type=pd-standard`, porque el nivel gratuito no cubre SSD. `--scopes=cloud-platform`, porque sin eso la VM no puede bajar la imagen de Artifact Registry ni subir backups a Cloud Storage. Y el sufijo `-amd64` de la familia de imagen: desde 24.04 Canonical publica las familias con la arquitectura en el nombre, y `ubuntu-2404-lts` a secas falla con un «resource not found» que no da ninguna pista del motivo. Para ver los nombres vigentes:

```bash
gcloud compute images list --project=ubuntu-os-cloud \
  --filter="family~ubuntu AND family~lts" --format='value(family)' | sort -u
```

El firewall de la VPC por defecto no trae reglas para 80 y 443, así que se crean:

```bash
gcloud compute firewall-rules create permitir-web \
  --allow=tcp:80,tcp:443 \
  --target-tags=servidor-web \
  --description="HTTP y HTTPS hacia el reverse proxy"
```

**El 5432 no se abre.** La base se alcanza por un túnel SSH ([A.8](#a8-migrar-el-esquema-y-crear-el-rol-acotado)), igual que en el camino principal se alcanza por el Cloud SQL Auth Proxy.

## A.5 Preparar el sistema

```bash
gcloud compute ssh $VM --zone=$ZONA
```

Dentro de la VM:

```bash
# 1. Swap. Con 166 MB de uso medido sobre 1 GB no es imprescindible, pero el
#    disco es gratis hasta 30 GB y esto evita que un pico de memoria mate un
#    contenedor en vez de ponerse lento.
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# `swappiness` bajo: que use swap como red de contención, no como rutina.
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf
sudo sysctl --system

# 2. Docker con el plugin de Compose. Es el script oficial de Docker.
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"

# 3. Parches de seguridad desatendidos. Ubuntu los trae, esto confirma que
#    están activos.
sudo systemctl status unattended-upgrades --no-pager | head -3

exit   # y volvé a entrar, para que el grupo `docker` tome efecto
```

Verificación:

```bash
gcloud compute ssh $VM --zone=$ZONA --command="free -h && docker --version && docker compose version"
```

## A.6 Apuntar el dominio

Un registro **A** del dominio a la IP reservada en [A.4](#a4-crear-la-vm-y-abrir-el-firewall). En un dominio propio es un registro A en el DNS del registrador. Con [DuckDNS](https://www.duckdns.org) —gratis, y alcanza para esta fase— son cuatro pasos:

1. **Entrar.** No hay registro con email: se entra con Google, GitHub, Reddit o Twitter.
2. **Crear el dominio.** El nombre va en el campo *sub domain* → *add domain*. Hasta 5 por cuenta. Conviene registrar el nombre completo que se va a usar (`terravid-api` da `terravid-api.duckdns.org`) y no un sub-subdominio: DuckDNS resuelve `algo.tudominio.duckdns.org` al mismo IP, pero es una dependencia que no hace falta.
3. **Copiar el token**, arriba del panel. Es una credencial —quien lo tenga puede repuntar el dominio— así que va al gestor de contraseñas del equipo, no al repositorio.
4. **Apuntarlo a la IP.** Desde el panel, o por HTTP, que es más fácil de repetir:

```bash
IP=$(gcloud compute addresses describe ${VM}-ip --region=$REGION --format='value(address)')

# `domains=` va SIN el .duckdns.org. Responde OK; si dice KO, el token o el
# nombre están mal.
curl "https://www.duckdns.org/update?domains=terravid-api&token=<TOKEN>&ip=${IP}"
```

> **No hace falta el cron actualizador** que instalan casi todas las guías de DuckDNS. Ese paso existe porque el caso típico del servicio es una conexión doméstica con IP dinámica; acá la IP está reservada en [A.4](#a4-crear-la-vm-y-abrir-el-firewall) y no se mueve. Solo se repite el `curl` si se borra y recrea la VM.

**Verificá que resuelve antes de seguir.** Si Caddy arranca con el DNS sin propagar, el desafío HTTP-01 falla, y Let's Encrypt limita a 5 certificados por dominio por semana:

```bash
# `dig` no viene con Windows; `nslookup` sí, y en PowerShell también está
# `Resolve-DnsName`. Cualquiera de los tres sirve.
dig +short $DOMINIO
nslookup $DOMINIO 8.8.8.8   # contra un resolver público, sin caché local
```

Conviene hacer este paso justo después de [A.4](#a4-crear-la-vm-y-abrir-el-firewall), y usar [A.5](#a5-preparar-el-sistema) como tiempo de propagación.

Dos cosas sobre DuckDNS a tener presentes. Es un servicio gratuito mantenido por voluntarios: si se cae, el dominio no resuelve y la API queda inalcanzable —el certificado no se rompe, porque dura 90 días, pero el acceso sí—. Y a favor: `duckdns.org` está en la Public Suffix List, así que cada `X.duckdns.org` cuenta como dominio independiente para los límites de Let's Encrypt, y no se comparte el cupo con el resto de los usuarios del servicio. Para la defensa conviene igual un dominio propio.

## A.7 Publicar la imagen en Artifact Registry

Se construye en tu máquina y no en la VM: con 0,25 vCPU de línea base, `npm ci` más `tsc` tardan muchísimo y pueden quedarse sin memoria.

```bash
# Una sola vez: el repositorio de imágenes.
gcloud artifacts repositories create terravid \
  --repository-format=docker \
  --location=$REGION \
  --description="Imágenes del backend TerraVid"

gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Y que la cuenta de servicio de la VM pueda leerlo.
NUMERO=$(gcloud projects describe $PROJECT --format='value(projectNumber)')
gcloud artifacts repositories add-iam-policy-binding terravid \
  --location=$REGION \
  --member="serviceAccount:${NUMERO}-compute@developer.gserviceaccount.com" \
  --role="roles/artifactregistry.reader"
```

El rol de IAM **no alcanza por sí solo**: Docker en la VM necesita además el helper de credenciales, o el `pull` falla con «Unauthenticated request» aunque el permiso esté bien puesto —y el mensaje sugiere un problema de permisos, no de configuración local—. Una vez, **dentro de la VM**:

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
```

Se configura para el usuario que corre `docker`. Con `sudo docker` el helper que se lee es el de `root`, así que habría que configurarlo ahí también; más simple es no usar `sudo` —el `usermod -aG docker` de [A.5](#a5-preparar-el-sistema) ya lo permite— y reconectarse por SSH para que el grupo tome efecto.

Cada vez que se publica una versión, desde la raíz del repositorio:

```bash
TAG=$(git rev-parse --short HEAD)
IMAGEN="${REGION}-docker.pkg.dev/${PROJECT}/terravid/api:${TAG}"

# `--platform linux/amd64` explícito: la VM es x86, y si algún día se construye
# desde una máquina ARM la imagen no arrancaría allá.
docker build --platform linux/amd64 -t "$IMAGEN" .
docker push "$IMAGEN"

echo "API_IMAGE=$IMAGEN"   # este valor va al .env.produccion de la VM
```

Etiquetar con el SHA del commit y no con `latest` es lo que hace que se sepa qué está corriendo, y que volver atrás sea cambiar una línea.

## A.8 Migrar el esquema y crear el rol acotado

Primero la base sola, sin la API: el esquema todavía no existe.

En la VM. **El repositorio es privado**, así que el `git clone` necesita credenciales. La forma correcta es una *deploy key* de solo lectura: acotada a este repositorio, y sin permiso de escritura —si la VM pudiera escribir, comprometer el servidor sería comprometer el repositorio—.

```bash
# 1. Generar el par en la VM. La clave privada no sale de ahí.
ssh-keygen -t ed25519 -f ~/.ssh/github_terravid -N "" -C "deploy key vm terravid"

# 2. Que git la use para github.com, y solo para eso.
cat >> ~/.ssh/config <<'CONF'

Host github.com
  User git
  IdentityFile ~/.ssh/github_terravid
  IdentitiesOnly yes
CONF
chmod 600 ~/.ssh/config

# 3. Mostrar la PÚBLICA —esta no es secreta— y pegarla en
#    github.com/TerraVidMza/Backend/settings/keys -> Add deploy key,
#    DEJANDO "Allow write access" sin marcar.
cat ~/.ssh/github_terravid.pub

# 4. Comprobar. Tiene que responder "Hi TerraVidMza/Backend!".
ssh -T git@github.com
```

Con la clave ya autorizada:

```bash
sudo mkdir -p /opt/backend && sudo chown -R "$USER:$USER" /opt/backend
git clone --branch main git@github.com:TerraVidMza/Backend.git /opt/backend
cd /opt/backend/deploy

# Dos archivos, y la separación importa: `.env` lo lee Compose para
# interpolar y no entra en ningún contenedor; `.env.app` es lo único que ve
# el proceso Node. Así la contraseña del superusuario de Postgres no queda
# al alcance de la aplicación, que es el punto de D-017.
cp .env.example .env          &&  nano .env        # dominio, imagen, root pass
cp .env.app.example .env.app  &&  nano .env.app    # secretos de la aplicación
chmod 600 .env .env.app

docker compose -f docker-compose.prod.yml up -d db
docker compose -f docker-compose.prod.yml logs db | tail -5
```

`/opt/backend` es un checkout de git y nada más. Los dos `.env` no están versionados, así que sobreviven a los `git pull`, y de ese layout depende que [A.11](#a11-desplegar-una-versión-nueva) sea un `git pull` y no una copia manual. Si la VM además sirve otra cosa —un build del frontend, por ejemplo— que viva en otro directorio.

Clonando, los saltos de línea vienen bien: el `.gitattributes` del repositorio fuerza LF en el `Caddyfile`, el `docker-compose.prod.yml` y `backup-db.sh`, que se ejecutan dentro de contenedores Linux. **Copiar** los archivos en vez de clonarlos —con `gcloud compute scp`, útil si la rama todavía no está en `main`— no pasa por `.gitattributes`, y desde Windows llegan con CRLF: rompen el `Caddyfile` y el shebang del script con un `bad interpreter: ...^M` que no dice cuál es el problema. Ahí hay que normalizarlos a mano:

```bash
sed -i 's/\r$//' docker-compose.prod.yml Caddyfile backup-db.sh
chmod +x backup-db.sh
```

Ahora el túnel, **desde tu máquina**, en una terminal aparte:

```bash
gcloud compute ssh $VM --zone=$ZONA -- -N -L 5433:localhost:5432
```

Con el túnel abierto, la base de la VM queda en `127.0.0.1:5433`. A partir de acá es exactamente el procedimiento de la [sección 5](#5-migrar-el-esquema-y-crear-el-rol-acotado): un `.env.produccion` local que apunte ahí con el rol de DDL, y después

```bash
cp .env .env.desarrollo && cp .env.produccion .env
npm run migration:run
npm run migration:show                    # todas con [X]

DB_APP_PASSWORD='<contraseña-larga-generada>' npm run db:rol-app

# verificar-privilegios se conecta con las credenciales REALES de la API:
# para este paso DB_USERNAME/DB_PASSWORD apuntan al rol acotado, no a postgres.
npm run db:verificar-privilegios

# El seed levanta un contexto Nest completo, así que AuthModule exige
# JWT_SECRET y JWT_REFRESH_SECRET aunque solo vaya a insertar filas. Sin
# ellas falla con "JwtStrategy requires a secret or key", que no sugiere
# que lo que falta sea una variable de entorno.
npm run seed

cp .env.desarrollo .env
```

La `DB_APP_PASSWORD` va a `DB_PASSWORD` del `.env.app` **de la VM**. La del superusuario `postgres` se queda en el gestor de contraseñas del equipo y no vuelve a usarse hasta la próxima migración.

## A.9 Levantar todo y verificar

En la VM:

```bash
cd /opt/backend/deploy
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Caddy pide el certificado en el primer arranque; tarda unos segundos. Si algo falla, el motivo está en sus logs:

```bash
docker compose -f docker-compose.prod.yml logs caddy | tail -20
```

Desde afuera:

```bash
curl -i https://$DOMINIO/api
# 401 es correcto: el JwtAuthGuard global está activo y la raíz no es pública.

# Que el certificado sea de Let's Encrypt y no el autofirmado de prueba:
echo | openssl s_client -connect ${DOMINIO}:443 -servername $DOMINIO 2>/dev/null \
  | openssl x509 -noout -issuer -dates
```

> **Si la API entra en bucle de reinicio con `password authentication failed for user "terravid_app"`,** el rol acotado todavía no existe: falta el paso [A.8](#a8-migrar-el-esquema-y-crear-el-rol-acotado). Es el orden lo que importa — `db:rol-app` crea el rol, y hasta que exista la API no puede conectarse. `docker compose logs api` lo dice en la primera línea del error.

El stack se verificó localmente con este mismo `docker-compose.prod.yml`: el `healthcheck` de la base efectivamente retiene el arranque de la API hasta que Postgres acepta conexiones, `max_connections=50` y `shared_buffers=128MB` quedan aplicados, y los dos contenedores juntos consumen **117 MB** —90 MB la API, 27 MB Postgres— sobre el 1 GB de la `e2-micro`.

## A.10 Backups a Cloud Storage

La VM del nivel gratuito no tiene snapshots automáticos: si se pierde el disco, se pierde la base.

```bash
# Bucket en una región de EE.UU., que es donde aplica el nivel gratuito.
gcloud storage buckets create gs://terravid-backups \
  --location=US \
  --uniform-bucket-level-access

# Sin regla de ciclo de vida, los 5 GB gratuitos se llenan solos.
cat > /tmp/ciclo.json <<'JSON'
{"rule": [{"action": {"type": "Delete"}, "condition": {"age": 30}}]}
JSON
gcloud storage buckets update gs://terravid-backups --lifecycle-file=/tmp/ciclo.json

NUMERO=$(gcloud projects describe $PROJECT --format='value(projectNumber)')
gcloud storage buckets add-iam-policy-binding gs://terravid-backups \
  --member="serviceAccount:${NUMERO}-compute@developer.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

En la VM, el cron de las 7 UTC (4 de la mañana en Mendoza, después de las purgas de las 3):

```bash
chmod +x /opt/backend/deploy/backup-db.sh

# El script lee BUCKET_BACKUPS del entorno; el cron no hereda el .env.
( crontab -l 2>/dev/null; \
  echo 'BUCKET_BACKUPS=terravid-backups'; \
  echo '0 7 * * * /opt/backend/deploy/backup-db.sh >> /var/log/terravid-backup.log 2>&1' \
) | crontab -

# Probalo a mano antes de confiar en el cron.
BUCKET_BACKUPS=terravid-backups /opt/backend/deploy/backup-db.sh
```

Y **restaurá uno** en una base descartable. Un backup que nunca se restauró no es un backup:

```bash
gcloud storage cp gs://terravid-backups/postgres/<archivo>.sql.gz .
docker exec -i terravid-db psql -U postgres -c 'CREATE DATABASE prueba_restore'
gunzip -c <archivo>.sql.gz | docker exec -i terravid-db psql -U postgres -d prueba_restore
docker exec -i terravid-db psql -U postgres -d prueba_restore -c '\dt' | head
docker exec -i terravid-db psql -U postgres -c 'DROP DATABASE prueba_restore'
```

## A.11 Desplegar una versión nueva

En tu máquina, publicar la imagen ([A.7](#a7-publicar-la-imagen-en-artifact-registry)). En la VM:

```bash
cd /opt/backend/deploy
git pull                                  # por si cambió el compose
nano .env                                 # actualizar API_IMAGE al tag nuevo
docker compose -f docker-compose.prod.yml pull api
docker compose -f docker-compose.prod.yml up -d api
docker image prune -f                     # el disco son 30 GB
```

Si el deploy trae migraciones, corrélas **antes** de levantar la imagen nueva, por el túnel de [A.8](#a8-migrar-el-esquema-y-crear-el-rol-acotado). Y si la migración creó tablas, `db:rol-app` otra vez.

Volver atrás es poner el tag anterior en `API_IMAGE` y repetir las dos últimas líneas.

## A.12 Qué vigilar

| Qué | Por qué | Cómo |
|---|---|---|
| **Egreso mensual** | 1 GB gratis son ~33 MB/día. Es el límite que se cruza primero si el dashboard devuelve series largas de lecturas. | Facturación → Informes, filtrando por *Network Egress* |
| Memoria | 166 MB medidos sobre 1 GB, pero una consulta sin paginar sobre `lecturas_iot_historico` puede cambiar eso | `docker stats --no-stream` |
| Disco | 30 GB entre el sistema, las imágenes y la base | `df -h` y `docker system df` |
| El cron de las 3 AM | Es la razón de usar una VM: confirmá que efectivamente corre | `docker compose logs api \| grep -i purga` |
| Vencimiento del certificado | Caddy renueva solo, pero si el DNS cambia deja de poder | El mail de `EMAIL_ACME` |

## A.13 Cuándo dejar este camino

Tres señales de que la VM dejó de alcanzar:

1. **El egreso pasa de 1 GB** de forma sostenida. Ahí el ahorro se vuelve marginal.
2. **Los nodos IoT empiezan a publicar en serio** y los 150 ms de latencia o la falta de alta disponibilidad se notan.
3. **Hace falta que la API no se caiga**, aunque sea un rato. Una VM en una zona no da eso.

El camino de salida es el cuerpo de este documento, que ya está escrito: la imagen es la misma, el `.env.app` tiene las mismas variables, y las migraciones ya se corren por un túnel. Cambia dónde vive el contenedor.
