# Guía de Contribución

## Política de Branching (Gitflow)

Se implementa el flujo de trabajo **Gitflow** para estructurar la colaboración y el ciclo de vida del código, garantizando que solo el código estable llegue a producción.

### Ramas principales

| Rama | Propósito |
|---|---|
| `main` | Contiene el código productivo y estable. Se utiliza exclusivamente para el despliegue a Producción. Solo se actualiza mediante merges desde `develop` (o desde una rama `hotfix/` en casos urgentes). |
| `develop` | Rama de integración principal. Aquí se consolidan todas las nuevas funcionalidades terminadas. |

### Ramas temporales

| Rama | Propósito | Origen → Destino | Ejemplo |
|---|---|---|---|
| `feature/[ID-Jira]-[descripción]` | Desarrollo de nuevas funcionalidades. | `develop` → `develop` | `feature/TV-45-login-auth` |
| `fix/[ID-Jira]-[descripción]` | Corrección de errores detectados en Pruebas (QA). | `develop` → `develop` | `fix/TV-52-error-validacion-formulario` |
| `hotfix/[descripción]` | Correcciones urgentes que deben ir directo a producción para evitar la interrupción del servicio. | `main` → `main` y `develop` | `hotfix/error-caida-login` |

### Reglas generales

- `main` **nunca** se actualiza directamente: solo recibe merges desde `develop` o desde una rama `hotfix/`.
- Toda rama `feature/` o `fix/` parte de `develop` y se integra nuevamente en `develop` (vía Pull Request).
- Toda rama `hotfix/` parte de `main`, se mergea a `main` para el despliegue urgente y luego se hace back-merge a `develop` para que el fix no se pierda en la siguiente release.
- El nombre de la rama debe incluir el ID de Jira cuando corresponda (`feature/` y `fix/`), para trazabilidad entre el código y el ticket.

## Mensajes de commit

Se usa [Conventional Commits](https://www.conventionalcommits.org/es/): el historial ya lo respetaba, faltaba escribirlo.

```
<tipo>(<alcance>): <qué cambia, en imperativo y en minúscula>

<por qué cambia: el problema que había antes, no el resumen del diff>
```

Tipos en uso: `feat`, `fix`, `refactor`, `test`, `docs`, `ci`, `chore`, `perf`.
El alcance es el módulo (`auth`, `vendimia`, `openapi`, `despliegue`…).

El cuerpo es lo que importa y no es opcional cuando el cambio no es trivial. El diff ya dice **qué** se hizo; lo que se pierde para siempre si no se escribe es **por qué**, qué alternativa se descartó y qué se rompía antes. Si eso implica una decisión de arquitectura, además va a [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Verificación

El CI corre en cada Pull Request a `main` y a `develop`, y es obligatorio que pase:

| Comando | Qué cubre | Necesita |
|---|---|---|
| `npx tsc --noEmit` | Tipos, en modo `strict` | — |
| `npx eslint "{src,test}/**/*.ts"` | Lint (sin `--fix`, a diferencia de `npm run lint`) | — |
| `npm test` | Unitarios, con umbrales de cobertura por archivo | — |
| `npm run test:e2e` | Perímetro de la app e integración contra la base | Base levantada y migrada |
| `npm run test:smoke` | 185 casos end-to-end | Además, la API corriendo |

Localmente, para los dos últimos:

```bash
docker compose up -d
npm run migration:run && npm run seed
npm run test:e2e
npm run start:prod   # en otra terminal
npm run test:smoke
```

Un hook de pre-commit (husky + lint-staged) pasa ESLint y Prettier **solo sobre los archivos del commit**. No corre los tests a propósito: un hook lento se saltea con `--no-verify`, y ahí se pierde también el lint.

## Definición de terminado

Antes de pedir revisión, además de que el CI esté en verde:

- **El esquema cambió** → hay migración generada y aplicada. `synchronize` está apagado y no se prende ([D-007](docs/DECISIONS.md)).
- **Endpoint nuevo** → tiene `@Roles(...)` o `@AnyRole()` decidido a conciencia. Sin ninguno de los dos queda denegado para todos: el RBAC es fail-closed a propósito, para que agregar una ruta sin pensar quién la usa no la deje abierta.
- **Endpoint nuevo** → acota por empresa, y un recurso de otra responde **404, no 403**.
- **Variable de entorno nueva** → está en `.env.example` y en `validarEntorno` (`src/config/validar-entorno.ts`), o la aplicación va a arrancar sin ella y fallar más tarde y en otro lado.
- **Cambió el contrato de la API** → el OpenAPI sale de los DTOs, así que se actualiza solo; verificalo con `npm run openapi:generar`.
- **Cerraste o moviste una HU** → actualizá el campo **Estado** de su spec en [`docs/specs/`](docs/specs/README.md) y la fila del índice.
