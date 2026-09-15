# Plan de buenas prácticas — TerraVid Backend

> **Estado:** en ejecución. Abierto el 15/09/2026 sobre `develop` (`a951a89`).
>
> Este plan es distinto de [`specs/PLAN-MEJORAS.md`](specs/PLAN-MEJORAS.md), que está cerrado.
> Aquél auditaba el **código contra los criterios de aceptación** de las 36 HU: qué
> funcionalidad faltaba. Éste audita el **proceso alrededor del código**: qué impide
> que lo que ya funciona siga funcionando cuando entren más manos y el repositorio
> siga creciendo. Ninguno de los puntos de acá es una HU sin cerrar.

---

## 1. Punto de partida

Todo lo que sigue está medido, no estimado. Ejecutado el 15/09/2026 sobre `develop`:

| Verificación | Comando | Resultado |
|---|---|---|
| Compilación de tipos | `npx tsc --noEmit` | ✅ 0 errores |
| Lint (sin `--fix`) | `npx eslint "{src,test}/**/*.ts"` | ✅ 0 problemas |
| Tests unitarios | `npm test` | ✅ 184/184 en 19 suites |
| Smoke end-to-end | `npm run test:smoke` | ✅ **185 OK, 0 fallas** |
| Cobertura | `npm run test:cov` | ⚠️ 22 % líneas · 11 % funciones |
| Tests e2e | `npm run test:e2e` | ❌ **1 falla** |

El smoke corrió contra la API compilada (`npm run start:prod`) y una base
PostgreSQL 16 + PostGIS real, con las cuatro migraciones aplicadas y el seed
cargado. Es la única de las seis verificaciones que ejerce constraints, triggers
y aislamiento multi-empresa de verdad.

**Trazabilidad funcional.** Se extrajeron las **111 rutas** reales de los 23
controladores y se cruzaron contra las **90 rutas** que declaran las 36 specs de
[`specs/`](specs/README.md): están todas implementadas. La única diferencia
—`POST /api/iot/readings` del documento maestro frente a `POST /api/lecturas-iot`
del código— ya estaba registrada como intencional en
[HU-19](specs/HU-19-ingesta-lecturas-sensores.md). **No hay funcionalidad
faltante:** lo que este plan corrige es el proceso, no el producto.

### 1.1. Lo que ya está bien y no hay que tocar

Vale escribirlo para que ninguna fase de abajo lo "mejore" por inercia:

- **Cero deuda de tipos.** 0 ocurrencias de `: any`, 0 de `as any`, 0 de
  `@ts-ignore`, 0 de `TODO`/`FIXME` en todo `src/`. Es lo que hace barata la
  fase 3.
- **RBAC fail-closed**, aislamiento multi-tenant que responde 404 y no 403, log
  de auditoría inmutable por trigger *y* por privilegios, rol de base acotado
  para la aplicación ([D-017](DECISIONS.md)).
- **El filtro de excepciones** traduce nueve códigos de error de PostgreSQL a
  mensajes de dominio, en vez de filtrar nombres de tablas al cliente.
- **El despliegue** verifica que la API responda antes de darse por bueno, y
  vuelve atrás sola si no responde.

---

## 2. Los dos defectos concretos

Todo lo demás en este plan es prevención. Estos dos son fallas presentes.

### 2.1. El CI no corre en pull requests ni en `develop`

`.github/workflows/desplegar.yml` dispara con `push: branches: [main]` y
`workflow_dispatch`. El job `verificar` (tipos, lint, tests) se ejecuta
**después** del merge a `main`, es decir, cuando el código ya está camino a
producción y la imagen se va a publicar en el mismo workflow.

El choque con [`CONTRIBUTING.md`](../CONTRIBUTING.md) es directo: toda rama
`feature/` y `fix/` se integra a `develop` por Pull Request, y hoy **ese PR no
tiene ninguna verificación automática**. Un merge a `develop` que rompa los
tests no se entera nadie hasta el siguiente merge a `main`, con varias features
encima y sin saber cuál fue.

### 2.2. `npm run test:e2e` falla

`test/app.e2e-spec.ts` es el boilerplate que genera `nest new`, nunca adaptado:
pide `GET /` esperando `200 "Hello World!"`, pero la aplicación tiene prefijo
global `api` y un `JwtAuthGuard` global. Falla además en el `afterEach` con
`Cannot read properties of undefined (reading 'close')`, porque el `beforeEach`
ya venía roto.

Nadie lo notó **porque el CI no lo ejecuta** — el mismo defecto de 2.1. Un test
roto y desatendido en el repositorio es peor que no tener ninguno: entrena al
equipo a ignorar el rojo.

---

## 3. Plan por fases

Ordenado por retorno. La prioridad de entrega es académica y con fecha, así que
la trazabilidad y la documentación pesan más que la robustez operativa; por eso
OpenAPI (fase 2) va antes que el endurecimiento (fase 4), aunque técnicamente el
segundo sea más urgente.

| # | Fase | Qué resuelve | Esfuerzo |
|---|---|---|---|
| 0 | Cerrar el ciclo de verificación | Los dos defectos de §2 | ½ día |
| 1 | Cobertura donde duele | Dinero y multi-tenant sin red | 2–3 días |
| 2 | Contrato de API (OpenAPI) | Tres repos cliente sin contrato | 1–2 días |
| 3 | Higiene del repositorio | Deriva entre entornos y manos | ½ día |
| 4 | Endurecimiento | Fallos tardíos y opacos | 1 día |

### Fase 0 — Cerrar el ciclo de verificación

1. **CI en pull requests y en `develop`.** Agregar `pull_request` sobre `main` y
   `develop`, y `push` sobre `develop`. El job `publicar` queda condicionado a
   `main` con un `if`, así un PR verifica pero no publica. Sin esto, todo lo
   demás de este plan es opcional en la práctica: lo que el CI no ejecuta, se
   pudre.
2. **Reemplazar `test/app.e2e-spec.ts`.** Un e2e mínimo y honesto que ejerza lo
   que la aplicación realmente promete: prefijo `api`, guard global que rechaza
   sin token, y el filtro de excepciones dando forma al error. Con la base real
   por detrás, porque `AppModule` levanta TypeORM y un e2e que la mockea no
   prueba nada que los unitarios no prueben ya.
3. **El smoke en el CI.** Postgres+PostGIS como `services:`, migraciones, seed,
   arrancar la API y disparar `npm run test:smoke`. Son 185 casos ya escritos
   que hoy dependen de que alguien se acuerde de cuatro comandos manuales.

### Fase 1 — Cobertura donde duele

El 22 % global no es el problema; el problema es **cuál** 22 %. Las reglas que
manejan plata y las que separan empresas descansan hoy enteramente en el smoke.

4. **Tests de integración contra PostgreSQL real**, no unitarios con el
   repositorio mockeado. La decisión es deliberada: los bugs que importan en
   este backend viven en el SQL, en las constraints y en el `EXCLUDE` de
   campañas. Un mock del repositorio devuelve lo que el test le diga y esconde
   exactamente la clase de error que se quiere cazar.
5. **Orden de ataque**, por consecuencia de un error:
   liquidación de cuadrillas (HU-25) → margen bruto (HU-15) → costeo con
   vigencias históricas → circuito de aprobación de remitos (HU-26/27) →
   `AlcanceEmpresaService` (la frontera multi-tenant).
6. **Umbral de cobertura por carpeta, no global.** `coverageThreshold` con globs
   sobre esos módulos. Un umbral global del 80 % bloquea el repositorio mañana;
   uno del 22 % no protege nada.

### Fase 2 — Contrato de API (OpenAPI/Swagger)

7. **`@nestjs/swagger` con el plugin del CLI.** Es la pieza de mayor impacto que
   falta: hay **111 endpoints** y **tres repos cliente por construir** (Web,
   Mobile, IoTSensor) a cargo del mismo equipo. Sin contrato publicado, cada
   cliente reconstruye los DTOs leyendo el código del backend a mano, y las tres
   copias divergen apenas cambie un campo.
8. El plugin deriva tipos, opcionalidad y `enum` de los DTOs que **ya existen**,
   así que el trabajo manual se reduce a `@ApiTags` por controlador, el esquema
   de seguridad `bearer` y las respuestas de error. Los mensajes de dominio del
   filtro de excepciones se documentan una vez y valen para todos.
9. **La UI queda fuera de producción** salvo que se habilite explícitamente: la
   documentación describe el perímetro de ataque completo, y no hay razón para
   publicarla junto a la API.

### Fase 3 — Higiene del repositorio

10. **`engines` + `.nvmrc`.** Node 24 está fijado hoy en dos lugares
    independientes —el `FROM node:24-slim` del Dockerfile y el `node-version` del
    CI— y nada los ata. Van a divergir.
11. **Dependabot** para npm y para GitHub Actions. El segundo importa: el repo
    ya sufrió una vez la migración forzada de acciones a node24.
12. **`husky` + `lint-staged`**, para que formato y lint se apliquen antes del
    commit y no en una corrida manual de `npm run lint --fix` que reescribe
    archivos ajenos al cambio.
13. **Plantilla de PR y convención de commits escrita.** El historial ya usa
    Conventional Commits con rigor, pero no está documentado en
    [`CONTRIBUTING.md`](../CONTRIBUTING.md), que hoy cubre solo el branching.
14. **`package.json`:** `name: "Backend"` y `description` vacía.

### Fase 4 — Endurecimiento

15. **Validación del entorno al arrancar.** Si falta `JWT_SECRET` o
    `IOT_API_KEY`, hoy el fallo llega tarde y con un mensaje que no nombra la
    variable. Un esquema de validación en `ConfigModule.forRoot` corta el
    arranque diciendo qué falta.
16. **Endpoint de salud real** (`GET /api/salud`, público, con ping a la base).
    Hoy `deploy/actualizar.sh` da el despliegue por bueno cuando el
    `"Hello World!"` del boilerplate devuelve 401 por el guard. Funciona, pero
    prueba que Nest arrancó, no que la aplicación puede servir.
17. **`app.enableShutdownHooks()`.** Sin eso, parar el contenedor corta los
    requests en vuelo y no cierra el pool de TypeORM.
18. **CORS que falle cerrado.** `CORS_ORIGIN?.split(',') ?? true` junto a
    `credentials: true` significa que, si falta la variable, cualquier sitio
    puede hacer requests autenticados. Ya está advertido en
    [`DESPLIEGUE.md` A.12](DESPLIEGUE.md), pero una advertencia en un runbook no
    es un control: el fallback tiene que ser cerrado.
19. **`helmet` y `compression` en la aplicación.** Caddy ya pone los headers y
    comprime en la VM del Apéndice A, pero el runbook principal despliega en
    Cloud Run sin Caddy delante, y ahí no los pone nadie.
20. **Subir el estándar de tipos ahora que es gratis:** `strict: true` completo
    en `tsconfig.json` (faltan `strictFunctionTypes`,
    `strictPropertyInitialization`, `useUnknownInCatchVariables`, `alwaysStrict`)
    y en ESLint pasar `no-explicit-any` y `no-floating-promises` a `error`. El
    código hoy tiene **cero `any`**: adoptarlo no cuesta refactor, solo evita la
    deriva cuando entren más manos.
21. **Correlación de request en los logs.** Ya existe un `AsyncLocalStorage` para
    la IP de auditoría ([D-008](DECISIONS.md)); colgarle un `requestId` es barato
    y hace que los logs de la VM sirvan para seguir una operación.

---

## 4. Qué queda deliberadamente afuera

- **Redis + BullMQ.** Sigue sin hacer falta, por el mismo motivo de
  [D-g](DECISIONS.md): con una sola instancia, `EventEmitter2` y
  `@nestjs/schedule` alcanzan. Vuelve a la mesa al escalar horizontalmente.
- **Configuración del repositorio en GitHub** (branch protection, required
  checks). Es lo que debería impedir mergear con el CI en rojo, pero se decide
  fuera del código y queda como acción manual del equipo. Este plan solo toca
  archivos versionados.
- **Reescribir el smoke como suite de Jest.** Son 1873 líneas que funcionan y
  185 casos que pasan. Migrarlas es riesgo sin beneficio: lo que le falta no es
  framework, es que el CI lo ejecute (fase 0).

---

## 5. Cierre

Se cierra cuando las seis verificaciones de §1 pasen **en CI, sobre un pull
request**, y no en la máquina de quien lo escribió.
