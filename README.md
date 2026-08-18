# TerraVid — Backend

ERP agrícola para la trazabilidad integral desde la plantación hasta la vendimia. API REST construida con **NestJS + TypeORM + PostgreSQL/PostGIS**, siguiendo el modelo de datos y las historias de usuario definidas en el documento del proyecto final (UTN FRM).

> **Nota de alcance:** este repositorio contiene el código y la documentación del **Backend**. No se encontró código de Frontend en ninguna rama del repo al momento de escribir esto; si existe en otro repositorio, actualizar esta nota con el enlace correspondiente.

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
cp .env.example .env   # ajustar credenciales si hace falta
docker compose up -d   # levanta Postgres + PostGIS en localhost:5432
npm run seed            # crea roles, empresa demo, catálogos maestros y usuario Propietario
npm run start:dev
```

La API queda expuesta en `http://localhost:3000/api`.

Usuario demo creado por el seed:

- **email:** `propietario@terravid.demo`
- **password:** `Terravid123!`

## Estructura de módulos implementados (primera entrega)

| Módulo | HUs cubiertas | Descripción |
|---|---|---|
| `auth` | HU-01, HU-02, HU-03, HU-04 (cambio pass) | Login con bloqueo por intentos fallidos, logout, recuperación de contraseña por token, cambio de contraseña |
| `usuarios` / `roles` | HU-04, HU-05, HU-06 | ABM de usuarios, perfil propio, roles (Propietario, Capataz, Agrónomo, Auditor) |
| `log-auditoria` | HU-07 | Registro y consulta de logs de auditoría |
| `empresas` | — | Entidad raíz multi-tenant (aislamiento por `empresaId`) |
| `fincas` / `cuarteles` | HU-08, HU-09 | ABM de fincas y cuarteles (jerarquía espacial) |
| `catalogo-item` | HU-34 (parcial) | Catálogos maestros genéricos: variedades, sistemas de conducción, estados de cuartel, unidades de medida |
| `insumos` / `tipo-labor` | HU-16 | ABM de insumos y tipos de labor con historial de costos (`valid_from`) |
| `registro-labor` | HU-12, HU-13, HU-14, HU-15, HU-17 | Registro de labores e insumos con **sincronización offline idempotente** (`local_uuid`), cálculo de margen bruto por cuartel |

### Pendiente para siguientes entregas

Telemetría IoT (sensores, lecturas, umbrales, alertas), logística de vendimia (cuadrillas, pesajes, remitos), notificaciones, configuración del sistema, dashboards y los módulos de inteligencia agronómica (MVP). Las entidades ya están mapeadas en el diagrama de Entidad-Relación (Anexo 2 del documento maestro — ver [`docs/REFERENCES.md`](docs/REFERENCES.md)) y siguen el mismo patrón de los módulos ya construidos.

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
- `synchronize: true` sólo aplica fuera de producción; para producción se recomienda migrar a `migrations` de TypeORM.

## Documentación

Punto de entrada: [`docs/README.md`](docs/README.md) — arquitectura del sistema completo, decisiones de diseño y referencias al documento maestro del proyecto.

## Contribuir

Ver [`CONTRIBUTING.md`](CONTRIBUTING.md) para la política de branching (Gitflow) del proyecto.
