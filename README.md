# TerraVid — Backend

ERP agrícola para la trazabilidad integral desde la plantación hasta la vendimia. API REST construida con **NestJS + TypeORM + PostgreSQL/PostGIS**, siguiendo el modelo de datos y las historias de usuario definidas en el documento del proyecto final (UTN FRM).

> **Alcance:** este repositorio contiene únicamente el **Backend**. El proyecto TerraVid se organiza en 4 repositorios dentro de la organización [TerraVidMza](https://github.com/TerraVidMza) en GitHub.

## Repositorios del proyecto

| Repo | Contenido |
|---|---|
| [`Backend`](https://github.com/TerraVidMza/Backend) (este repo) | API REST — NestJS + TypeORM + PostgreSQL/PostGIS |
| [`Web`](https://github.com/TerraVidMza/Web) | Frontend web de oficina (Dashboard, finanzas, ABMs, mapas) |
| [`Mobile`](https://github.com/TerraVidMza/Mobile) | App móvil offline-first para campo (React Native / Expo) |
| [`IoTSensor`](https://github.com/TerraVidMza/IoTSensor) | Firmware de los nodos de telemetría (ESP32) |

> Cómo se comunican estos 4 componentes entre sí está detallado en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Stack

- **NestJS (v11) + TypeScript**
- **TypeORM** sobre **PostgreSQL 16 + PostGIS** (extensión geoespacial habilitada para futuros usos)
- **Passport / JWT** para autenticación y autorización por rol (guards globales + `@Public()` / `@Roles()`)
- **class-validator / class-transformer** para DTOs

> El detalle completo de arquitectura, tecnologías y entornos del sistema (incluyendo componentes aún no implementados) está en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Requisitos

- Node.js 20+
- Docker Desktop (o una instancia de PostgreSQL con PostGIS accesible)

## Puesta en marcha

```bash
npm install
cp .env.example .env    # ajustar credenciales si hace falta
docker compose up -d    # levanta Postgres + PostGIS en localhost:5432
npm run migration:run   # crea el esquema
npm run seed            # roles, empresa demo, catálogos maestros, configuración y usuario Propietario
npm run start:dev
```

La API queda expuesta en `http://localhost:3000/api`.

Usuario demo creado por el seed, **solo fuera de producción**:

- **email:** `propietario@terravid.demo`
- **password:** `Terravid123!`

> ⚠️ Esas credenciales están publicadas acá, así que no sirven para un entorno
> real. Con `NODE_ENV=production` el seed **no arranca** sin
> `SEED_PROPIETARIO_PASSWORD`, y el Propietario que crea entra obligado a
> cambiarla. Para rotar la contraseña de una cuenta ya creada:
>
> ```bash
> ROTAR_EMAIL='propietario@terravid.demo' > ROTAR_PASSWORD='<generada>' npm run db:rotar-password
> ```

### Migraciones

El esquema lo gobiernan las migraciones de [`src/database/migrations/`](src/database/migrations/), **no `synchronize`** (ver [D-007](docs/DECISIONS.md)). Al cambiar una entidad hay que generar la migración correspondiente:

```bash
npm run migration:generate -- src/database/migrations/NombreDescriptivo
npm run migration:run
npm run migration:show     # qué migraciones están aplicadas
npm run migration:revert   # deshace la última
```

`migration:generate` diffea las entidades contra la base: si responde *"No changes in database schema were found"*, el modelo y el esquema coinciden.

`DB_SYNCHRONIZE=true` reactiva el modo deducido para prototipar rápido. **No dejarlo prendido:** un renombre de columna se traduce a `DROP` + `ADD` y borra los datos sin avisar.

### Rol de base de datos para producción

En desarrollo todo corre con `postgres` y alcanza. **En producción la aplicación no debe conectarse con un superusuario** ([D-017](docs/DECISIONS.md)): migrar es DDL y la API solo necesita leer y escribir filas. Con un mismo rol para las dos cosas, una inyección SQL en cualquier endpoint tendría permiso para hacer `DROP TABLE`.

```bash
# Con el rol dueño del esquema —el mismo que corre las migraciones—:
DB_APP_PASSWORD='<contraseña larga y generada>' npm run db:rol-app

# Después, apuntando DB_USERNAME/DB_PASSWORD al rol nuevo:
npm run db:verificar-privilegios
```

`db:rol-app` crea `terravid_app` con lo justo: DML sobre las tablas, uso de secuencias, **solo `SELECT`/`INSERT` sobre `log_auditoria`** (HU-07), sin `CREATE` sobre el esquema y sin acceso a la tabla `migrations`. Es idempotente.

`db:verificar-privilegios` se conecta **con las credenciales reales de la API** e intenta cada operación, revirtiendo todo. No lee `information_schema`: eso diría lo que *debería* pasar, y lo que importa es lo que pasa. Sale con código 1 si algo no cumple, así que sirve como paso de despliegue.

> El rol que corre `db:rol-app` tiene que ser **el mismo** que corre las migraciones: los `ALTER DEFAULT PRIVILEGES` que deja puestos aplican a las tablas que cree ese rol, y son los que evitan que una migración futura deje a la aplicación sin permisos sobre una tabla nueva.

El orden completo para producción —crear la instancia, migrar, crear el rol, desplegar— está en [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).

### Push a móviles (Firebase)

`PUSH_TRANSPORT=log` escribe el envío en consola y alcanza para desarrollo. Para mandar de verdad hacen falta las credenciales del service account (Firebase → ⚙️ Configuración del proyecto → **Cuentas de servicio** → *Generar nueva clave privada*), que van a `.env`:

```bash
PUSH_TRANSPORT=fcm
FIREBASE_PROJECT_ID=<project_id del JSON>
FIREBASE_CLIENT_EMAIL=<client_email del JSON>
FIREBASE_PRIVATE_KEY='<private_key del JSON, en UNA línea, con los \n>'
```

> ⚠️ **El JSON del service account da acceso al proyecto entero de Firebase.** No va al repositorio —ni siquiera a `.env.example`, que sí está versionado—. Borralo después de copiar los tres valores.

La clave privada es donde falla todo el mundo. Copiala **tal cual sale del JSON**, en una línea y con los `\n` literales. Entre comillas simples el código los convierte; entre comillas dobles los convierte dotenv. Lo que no funciona es pegarla en varias líneas reales: dotenv corta el valor en el primer salto.

```bash
npm run push:diagnostico              # valida las credenciales contra Firebase
npm run push:diagnostico -- <token>   # además envía a un dispositivo real
```

Sin token, el diagnóstico manda contra uno inválido a propósito. Suena raro pero es la prueba que sirve: **si Firebase rechaza el token, es porque autenticó la petición** y llegó hasta mirar el destinatario. Con credenciales malas el error aparecería antes. Esa distinción es todo lo que se puede saber mientras la app móvil no exista.

### Pruebas

```bash
npm test              # 207 tests unitarios, con umbrales de cobertura por archivo
npm run test:e2e      # perimetro de la app + integracion contra la base real
npm run test:smoke    # 185 casos end-to-end contra la API y la base reales
```

El smoke test necesita la API corriendo (`npm run start:prod` en otra terminal) y verifica de punta a punta las correcciones de seguridad, correctitud de datos, paginación y auditoría.

### Contrato de la API (OpenAPI)

Con la API levantada en desarrollo, la documentación queda en
`http://localhost:3000/api/docs`, y el JSON crudo en `/api/docs-json`.

```bash
npm run openapi:generar   # escribe openapi.json sin levantar el servidor
```

Ese archivo es el contrato para los repos `Web`, `Mobile` e `IoTSensor`: los
tipos del frontend salen de ahí y no de copiar los DTOs a mano. Sale casi
entero de los DTOs que ya existen —tipos, obligatoriedad y `enum` los deduce el
plugin de `@nestjs/swagger` desde los decoradores de class-validator, y las
descripciones de cada campo desde los comentarios JSDoc—, así que documentar un
endpoint nuevo es documentar su DTO.

> La UI **está apagada en producción** salvo que se ponga `OPENAPI_ENABLED=true`.
> El documento describe cada ruta, cada campo y qué rol puede usarla; publicarlo
> junto a la API es una decisión, no un default.


## Estructura de módulos

Los 24 módulos del backend están construidos y exponen sus endpoints REST. El detalle funcional de cada Historia de Usuario (criterios de aceptación, endpoints, pantalla de Figma, estado real de implementación) vive en [`docs/specs/`](docs/specs/README.md).

| Módulo | HUs cubiertas | Descripción |
|---|---|---|
| **Autenticación y seguridad** | | |
| `auth` | HU-01, HU-02, HU-03, HU-04 (cambio pass) | Login con bloqueo por intentos fallidos, logout, recuperación de contraseña por token, cambio de contraseña |
| `token-recuperacion` | HU-03 | Tokens de recuperación de contraseña (hash, expiración, un solo uso) |
| `usuarios` / `roles` | HU-04, HU-05, HU-06 | ABM de usuarios, perfil propio, roles (Propietario, Capataz, Agrónomo, Auditor) |
| `log-auditoria` | HU-07 | Registro y consulta de logs de auditoría |
| `empresas` | — | Entidad raíz multi-tenant (aislamiento por `empresaId`) |
| **Cartografía y topología** | | |
| `fincas` / `cuarteles` | HU-08, HU-09, HU-10, HU-11 | ABM de fincas y cuarteles (jerarquía espacial), datos para mapa y búsqueda |
| **Operaciones y costeo** | | |
| `registro-labor` | HU-12, HU-13, HU-14, HU-15, HU-17 | Registro de labores e insumos con **sincronización offline idempotente** (`local_uuid`), cálculo de margen bruto por cuartel |
| `insumos` / `tipo-labor` | HU-16 | ABM de insumos y tipos de labor con historial de costos (`valid_from`) |
| **Telemetría IoT** | | |
| `sensores` | HU-18 | ABM de sensores y asociación a finca |
| `lecturas-iot` | HU-19, HU-20 | Ingesta de telemetría y consulta de historial por sensor |
| `umbral-sensor` | HU-21 | Umbrales mín/máx por sensor |
| `alertas-iot` | HU-22 | Generación y revisión de alertas por superación de umbral |
| **Logística de vendimia** | | |
| `cuadrillas` | HU-23 | ABM de cuadrillas con historial de tarifas a destajo (`valid_from`) |
| `pesaje-vendimia` | HU-24, HU-25, HU-28 | Pesaje diario (sync offline), cálculo de liquidación, estado de cosecha por cuartel |
| `remitos` | HU-26, HU-27 | Generación de borrador, circuito de aprobación/rechazo |
| **Inteligencia agronómica (MVP)** | | |
| `inteligencia-agronomica` | HU-29, HU-30, HU-31 | Correlación sensor-costos, recomendaciones por reglas (persistidas, con aplicar/descartar), comparación entre campañas |
| **Dashboard, configuración y soporte** | | |
| `campanias` | HU-09, HU-31, HU-32 | Campañas o años agrícolas: el eje temporal que comparten los indicadores |
| `dashboard` | HU-32 | Indicadores clave |
| `configuracion` | HU-33 | Parámetros generales (clave-valor): organización, moneda, unidades, zona horaria |
| `catalogo-item` | HU-34 | Catálogos maestros genéricos: variedades, sistemas de conducción, estados de cuartel, unidades de medida |
| `notificaciones` | HU-35 | Notificaciones in-app por rol y push a móviles (FCM) |
| `ayuda` | HU-36 | Artículos de ayuda y tickets de soporte |

> El estado por HU (🟢 completa / 🟠 parcial / 🔴 incompleta), con el motivo puntual de cada una que no está cerrada, se lleva en [`docs/specs/README.md`](docs/specs/README.md). Las entidades siguen el diagrama de Entidad-Relación (Anexo 2 del documento maestro — ver [`docs/REFERENCES.md`](docs/REFERENCES.md)).

### Pendiente

Los componentes que aún no están construidos son los **clientes**: Frontend Web, App Mobile y firmware IoT, cada uno en su propio repo.

En el backend, **las 36 HU están completas**. El plan de mejoras está cerrado: los 10 problemas sistémicos resueltos y las 8 decisiones de producto tomadas.

Lo que queda son pasos de **cada despliegue**, no código pendiente:

- **`npm run db:rol-app`** crea el rol acotado y **`npm run db:verificar-privilegios`** comprueba que quedó bien ([D-017](docs/DECISIONS.md)).
- **`npm run push:diagnostico`** comprueba que Firebase acepta el service account de ese entorno ([D-015](docs/DECISIONS.md)).

Los dos salen con **código 1** si la configuración no sirve, así que conviene encadenarlos al pipeline: convierten un error de credenciales en un despliegue fallido, en vez de en una funcionalidad que calla y no anda.

Aparte, una deuda de dependencias: **6 vulnerabilidades moderadas** en transitivas de `firebase-admin` que `npm audit fix` no resuelve sin `--force`. Asumidas a sabiendas; revisar cuando el SDK publique la corrección.

El detalle por HU está en [`docs/specs/README.md`](docs/specs/README.md), y el cierre del plan en la sección 7 de [`docs/specs/PLAN-MEJORAS.md`](docs/specs/PLAN-MEJORAS.md).

La infraestructura de **Redis + BullMQ** que describe [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) **no es necesaria hoy**: el trabajo diferido se resuelve con `EventEmitter2` y `@nestjs/schedule` ([D-g](docs/DECISIONS.md)). Vuelve a hacer falta al escalar a más de una instancia, porque los cron son in-process.

## Autenticación

Todas las rutas requieren JWT por defecto (guard global). Usar `@Public()` para exponer una ruta sin autenticación, y `@Roles(RolNombre.X)` para restringir por rol.

Los permisos que ven los clientes salen de [`src/common/permisos/permisos.ts`](src/common/permisos/permisos.ts) (D-024). Al cambiar un `@Roles`, actualizar esa tabla: `permisos.spec.ts` falla si no coinciden.

```
POST /api/auth/login          { email, password, cliente?: 'web'|'movil' } → { accessToken, expiresIn, refreshToken, refreshExpiresAt, user: { …, permisos } }
POST /api/auth/refresh        { refreshToken }    → misma respuesta; rota el refresh token (D-023)
POST /api/auth/logout                             (revoca el access token y la sesión)
POST /api/auth/forgot-password
POST /api/auth/reset-password
POST /api/auth/cambiar-password
```

## Notas de diseño

- **Offline-first**: `registro_labor` usa `local_uuid` generado en el dispositivo móvil como clave de idempotencia; reintentar la sincronización de un mismo registro no genera duplicados.
- **Historial de costos**: `costo_insumo` y `costo_labor` son tablas append-only con `valid_from`; el costo vigente se calcula al momento de sincronizar cada registro, preservando el costo histórico aplicado.
- **Catálogos**: la baja de un valor de catálogo en uso se bloquea (se ofrece desactivar en su lugar), replicando el criterio de aceptación de HU-34.
- **Esquema versionado**: el DDL vive en migraciones de TypeORM y `synchronize` está apagado por defecto ([D-007](docs/DECISIONS.md)).
- **Aislamiento multi-empresa**: toda consulta acota por `empresaId` siguiendo la cadena `cuartel → finca → empresa`. Un recurso de otra empresa responde `404`, no `403`: confirmar su existencia ya sería una filtración.
- **RBAC fail-closed**: un handler sin `@Roles(...)` ni `@AnyRole()` se deniega. Agregar un endpoint sin decidir quién lo usa lo deja cerrado, no abierto.
- **Auditoría**: se declara con `@Auditar({accion, entidad})` sobre el handler y la resuelve un interceptor global; la IP viaja por `AsyncLocalStorage` ([D-008](docs/DECISIONS.md)).
- **Correlación de logs**: cada request lleva un `requestId` que viaja por el mismo `AsyncLocalStorage` que la IP, se estampa en cada línea del log y vuelve al cliente en la cabecera `X-Request-Id` y en el cuerpo de todo error. Si el cliente manda la cabecera, se respeta su valor. Es lo que permite reconstruir una operación entera en la VM: `journalctl -u terravid | grep <id>`.
- **Trabajo diferido**: `EventEmitter2` saca la evaluación de umbrales del camino de respuesta de la ingesta y `@nestjs/schedule` corre las purgas y la consolidación nocturna. Sin Redis ni BullMQ — los cron son in-process, así que con más de una instancia hay que moverlos a una cola con lock distribuido.
- **Fechas de negocio en día local**: las columnas `date` representan la jornada de trabajo en la finca. Se calculan con `fechaLocal()`/`hoyLocal()` y se comparan como texto, nunca vía `toISOString()` ([D-009](docs/DECISIONS.md)).
- **Sesiones revocables**: cada JWT lleva `jti` y el logout lo registra en `token_revocado`, que la estrategia consulta en cada request. Un cron purga las revocaciones cuyo token ya venció por su cuenta.
- **Catálogos por empresa**: `catalogo_item`, `insumos` y `tipos_labor` llevan `empresa_id`; las tablas de costos heredan el tenant por la FK ([D-011](docs/DECISIONS.md)).
- **Ingreso**: la única fuente de ingreso es `liquidaciones_bodega`, que cuelga del remito aprobado ([D-010](docs/DECISIONS.md)). El margen bruto se devuelve en `null` —no en 0— mientras no haya liquidaciones cargadas.
- **Estado del cuartel**: el ciclo de vendimia (`pendiente`/`en_cosecha`/`cosechado`) es un enum que solo escribe el sistema al ocurrir hechos del circuito, y es independiente del catálogo de estado de plantación ([D-013](docs/DECISIONS.md)). No es una FK al catálogo a propósito: si se pudiera renombrar el valor desde el ABM, se romperían las transiciones.
- **Campañas**: el eje temporal de los indicadores es la entidad `campanias`, con rango explícito y **sin solapamientos garantizados por un `EXCLUDE` en la base** ([D-014](docs/DECISIONS.md)) — sin eso, «la campaña actual» sería ambigua. Sin campaña cargada cada consumidor decide: la baja de cuartel es conservadora y el dashboard cae al año calendario, avisándolo.
- **Log de auditoría inmutable**: un trigger rechaza `UPDATE`, `DELETE` y `TRUNCATE` sobre `log_auditoria` (HU-07). Se eligió un trigger **además** de `GRANT`/`REVOKE` porque los privilegios no aplican a un superusuario: las dos capas cubren cosas distintas ([D-017](docs/DECISIONS.md)).
- **Privilegios mínimos**: la aplicación y las migraciones usan roles distintos. La API solo hace DML; el DDL queda del lado del rol que migra, así que una inyección SQL no hereda permiso para `DROP TABLE` ([D-017](docs/DECISIONS.md)).
- **Push**: `PushService` manda a FCM con el mismo patrón que el correo (`PUSH_TRANSPORT=log|fcm`) y **nunca tumba la operación que lo disparó** ([D-015](docs/DECISIONS.md)): la notificación in-app se persiste primero y es la fuente de verdad.

## Documentación

Punto de entrada: [`docs/README.md`](docs/README.md) — arquitectura del sistema completo, decisiones de diseño y referencias al documento maestro del proyecto.

- [`docs/specs/`](docs/specs/README.md) — **especificación funcional de cada Historia de Usuario (HU-01 a HU-36)**: criterios de aceptación, endpoints, entidad, pantalla de Figma y estado de implementación. Es el hub de especificaciones de los 4 repos del proyecto, no solo del Backend.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitectura, tecnologías y entornos.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — bitácora de decisiones y discrepancias resueltas.
- [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) — **runbook de despliegue en Google Cloud** (Cloud Run + Cloud SQL): paso a paso con los comandos.
- [`docs/REFERENCES.md`](docs/REFERENCES.md) — puente al documento maestro (UTN FRM).

## Contribuir

Ver [`CONTRIBUTING.md`](CONTRIBUTING.md) para la política de branching (Gitflow) del proyecto.
