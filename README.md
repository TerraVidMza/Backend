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

Usuario demo creado por el seed:

- **email:** `propietario@terravid.demo`
- **password:** `Terravid123!`

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

### Pruebas

```bash
npm test              # 71 tests unitarios
npm run test:smoke    # 133 casos end-to-end contra la API y la base reales
```

El smoke test necesita la API corriendo (`npm run start:prod` en otra terminal) y verifica de punta a punta las correcciones de seguridad, correctitud de datos, paginación y auditoría.

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
| `inteligencia-agronomica` | HU-29, HU-30, HU-31 | Correlación sensor-costos, recomendaciones por reglas, comparación entre campañas |
| **Dashboard, configuración y soporte** | | |
| `dashboard` | HU-32 | Indicadores clave |
| `configuracion` | HU-33 | Parámetros generales (clave-valor): organización, moneda, unidades, zona horaria |
| `catalogo-item` | HU-34 | Catálogos maestros genéricos: variedades, sistemas de conducción, estados de cuartel, unidades de medida |
| `notificaciones` | HU-35 | Notificaciones in-app por rol |
| `ayuda` | HU-36 | Artículos de ayuda y tickets de soporte |

> El estado por HU (🟢 completa / 🟠 parcial / 🔴 incompleta), con el motivo puntual de cada una que no está cerrada, se lleva en [`docs/specs/README.md`](docs/specs/README.md). Las entidades siguen el diagrama de Entidad-Relación (Anexo 2 del documento maestro — ver [`docs/REFERENCES.md`](docs/REFERENCES.md)).

### Pendiente

Los componentes que aún no están construidos son los **clientes**: Frontend Web, App Mobile y firmware IoT, cada uno en su propio repo.

En el backend, **27 de las 36 HU están completas**; quedan 8 parciales y 1 incompleta. Casi todo lo que falta espera una definición, no código:

- **Concepto de campaña** (`D-c`): no existe en el modelo. HU-31 delega los rangos al cliente y el dashboard usa año calendario, así que **ya divergen**. Bloquea HU-09, HU-31 y HU-32, y es el pendiente que más cuesta postergar: cada indicador nuevo elige su propio corte.
- **Entidad `recomendaciones`** con aplicar/descartar (HU-30): falta definir qué reglas agronómicas se aplican, que ninguna HU especifica todavía.
- **Maestro de transportes** (`D-b`) y **push FCM** (`D-e`): hay que implementarlos o descopear el criterio. Mientras tanto HU-24 y HU-35 no pueden cerrarse ni descartarse.
- **Endurecimiento de base para producción**: GRANT/REVOKE que garanticen el append-only del log de auditoría (cierra HU-07) y dejar de conectar con el superusuario `postgres`.
- **Trabajo suelto sin bloqueos**: lista blanca de roles asignables (HU-06), aviso al guardar un umbral ya superado (HU-21), promedios IoT (HU-31), estado de cosecha global (HU-32) y notificación por error de sincronización (HU-35).

El detalle por HU está en [`docs/specs/README.md`](docs/specs/README.md), y el orden sugerido en la sección 7 de [`docs/specs/PLAN-MEJORAS.md`](docs/specs/PLAN-MEJORAS.md).

La infraestructura de **Redis + BullMQ** que describe [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) **no es necesaria hoy**: el trabajo diferido se resuelve con `EventEmitter2` y `@nestjs/schedule` ([D-g](docs/DECISIONS.md)). Vuelve a hacer falta al escalar a más de una instancia, porque los cron son in-process.

## Autenticación

Todas las rutas requieren JWT por defecto (guard global). Usar `@Public()` para exponer una ruta sin autenticación, y `@Roles(RolNombre.X)` para restringir por rol.

```
POST /api/auth/login          { email, password }
POST /api/auth/logout
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
- **Trabajo diferido**: `EventEmitter2` saca la evaluación de umbrales del camino de respuesta de la ingesta y `@nestjs/schedule` corre las purgas y la consolidación nocturna. Sin Redis ni BullMQ — los cron son in-process, así que con más de una instancia hay que moverlos a una cola con lock distribuido.
- **Fechas de negocio en día local**: las columnas `date` representan la jornada de trabajo en la finca. Se calculan con `fechaLocal()`/`hoyLocal()` y se comparan como texto, nunca vía `toISOString()` ([D-009](docs/DECISIONS.md)).
- **Sesiones revocables**: cada JWT lleva `jti` y el logout lo registra en `token_revocado`, que la estrategia consulta en cada request. Un cron purga las revocaciones cuyo token ya venció por su cuenta.
- **Catálogos por empresa**: `catalogo_item`, `insumos` y `tipos_labor` llevan `empresa_id`; las tablas de costos heredan el tenant por la FK ([D-011](docs/DECISIONS.md)).
- **Ingreso**: la única fuente de ingreso es `liquidaciones_bodega`, que cuelga del remito aprobado ([D-010](docs/DECISIONS.md)). El margen bruto se devuelve en `null` —no en 0— mientras no haya liquidaciones cargadas.
- **Estado del cuartel**: el ciclo de vendimia (`pendiente`/`en_cosecha`/`cosechado`) es un enum que solo escribe el sistema al ocurrir hechos del circuito, y es independiente del catálogo de estado de plantación ([D-013](docs/DECISIONS.md)). No es una FK al catálogo a propósito: si se pudiera renombrar el valor desde el ABM, se romperían las transiciones.

## Documentación

Punto de entrada: [`docs/README.md`](docs/README.md) — arquitectura del sistema completo, decisiones de diseño y referencias al documento maestro del proyecto.

- [`docs/specs/`](docs/specs/README.md) — **especificación funcional de cada Historia de Usuario (HU-01 a HU-36)**: criterios de aceptación, endpoints, entidad, pantalla de Figma y estado de implementación. Es el hub de especificaciones de los 4 repos del proyecto, no solo del Backend.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitectura, tecnologías y entornos.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — bitácora de decisiones y discrepancias resueltas.
- [`docs/REFERENCES.md`](docs/REFERENCES.md) — puente al documento maestro (UTN FRM).

## Contribuir

Ver [`CONTRIBUTING.md`](CONTRIBUTING.md) para la política de branching (Gitflow) del proyecto.
