# Registro de Decisiones

Bitácora de decisiones de arquitectura y discrepancias entre el diseño documentado y la implementación real, para que no se pierdan en el historial de commits ni en conversaciones. Cada entrada: contexto, decisión y estado.

---

## D-001 — Framework de Backend: Express → NestJS

**Contexto:** el diseño original de [`ARCHITECTURE.md`](ARCHITECTURE.md) especificaba **Node.js + Express.js** como framework del Backend API.

**Decisión:** la implementación real, ya construida en la rama `backend` (5 commits, módulos de auth/usuarios/fincas/cuarteles/registro de labores funcionando), usa **NestJS (v11) + TypeORM** en su lugar. Se adopta el código como fuente de verdad: `ARCHITECTURE.md` fue actualizado para reflejar NestJS/TypeORM.

**Estado:** ✅ Vigente.

---

## D-002 — Rama `backend` fuera del flujo Gitflow

**Contexto:** [`CONTRIBUTING.md`](../CONTRIBUTING.md) establece que toda rama `feature/` parte de `develop` y se integra de nuevo en `develop` vía Pull Request. La rama `backend` (con el scaffold NestJS y los módulos ya mencionados en D-001) se ramificó directamente del *Initial commit* del repositorio, no de `develop`, y sus commits nunca se integraron vía PR.

**Decisión:** se abrió y mergeó el Pull Request `backend → develop` ([#4](https://github.com/TerraVidMza/Backend/pull/4)), integrando los 5 commits de `backend` a `develop`.

**Estado:** ✅ Resuelto. Nota post-merge: el merge automático de `README.md` concatenó ambas versiones del archivo en vez de reconciliarlas (quedó una sección "Stack" duplicada y una nota desactualizada); se corrigió aparte consolidando el contenido en un único README coherente.

---

## D-003 — Especificaciones funcionales por HU en `docs/specs/`

**Contexto:** el documento maestro (Google Docs, UTN FRM) contiene las 36 Historias de Usuario con sus criterios de aceptación, pero es de acceso restringido y no está versionado junto al código. No había forma de saber, desde el repo, qué criterios cumple cada funcionalidad ni qué pantalla de Figma le corresponde.

**Decisión:** se creó [`docs/specs/`](specs/README.md) con un archivo por HU (HU-01 a HU-36), que replica los criterios de aceptación del documento maestro y agrega la trazabilidad al código real (módulo, entidad, endpoints verificados contra los `*.controller.ts`) y a Figma. Es el **hub de especificaciones de los 4 repos** del proyecto (Backend, Web, Mobile, IoTSensor), no solo de este. El documento maestro sigue siendo la fuente de verdad académica; `docs/specs/` es la fuente de verdad operativa para el desarrollo.

**Estado:** ✅ Vigente.

---

## D-004 — Numeración de pantallas (`PAN-XX`): se usa la de la Matriz de Trazabilidad

**Contexto:** existen **dos numeraciones de pantalla incompatibles** en la documentación del proyecto:

- La **Matriz de Trazabilidad** (§20.3 del documento maestro) usa un esquema resumido de **PAN-01 a PAN-19**, donde una pantalla puede agrupar varias HU (ej. PAN-17 cubre HU-20, HU-21 y HU-22).
- El documento de **Historias de Usuario** (§17.1) usa un esquema más granular que llega hasta **PAN-39**, con una o más pantallas por HU.

Las dos no coinciden entre sí. Ejemplos de la colisión: HU-14 es `PAN-05` en la matriz pero `PAN-13` en las HU; HU-23 es `PAN-12` en la matriz pero `PAN-25` en las HU; HU-29 no tiene número en la matriz y es `PAN-37` en las HU.

**Decisión:** las specs usan la numeración de la **Matriz de Trazabilidad (PAN-01 a PAN-19)**, por ser la que coincide con los nombres reales de los frames en el [archivo de Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1). La numeración del documento de HU se considera obsoleta y **no debe usarse** para referenciar pantallas.

**Consecuencia abierta:** la matriz no asigna pantalla a 8 HUs (04, 17, 25, 28, 32, 34, 35, 36) — no tienen wireframe diseñado todavía. Esas specs quedan con la pantalla marcada como pendiente hasta que se diseñen.

**Estado:** ✅ Vigente, con pendiente de diseño de 8 pantallas.

---

## D-005 — El modelo de datos incorporará una fuente de ingreso

**Contexto:** la auditoría de código (ver [`specs/PLAN-MEJORAS.md`](specs/PLAN-MEJORAS.md)) detectó que el "margen bruto" de HU-31 se calcula como `Σ monto_liquidacion − costo_total`, pero `monto_liquidacion` es `tarifa_por_kg × kg_totales`: **lo que se le paga a la cuadrilla de vendimia**, es decir un costo de cosecha, no un ingreso. El indicador resultante (`costoCosecha − costoLabores − costoInsumos`) no tiene sentido económico y su signo es arbitrario.

La causa de fondo es que **no existe ninguna fuente de ingreso en el modelo de datos**: ni precio de venta por kg, ni liquidación de bodega. Por eso HU-15 también devuelve solo costos pese a llamarse "margen bruto".

**Decisión:** se modelará el ingreso como entidad nueva (precio de venta por kg o liquidación de bodega por remito), en lugar de descopear el indicador y renombrar todo a "costeo". El margen bruto se mantiene como objetivo funcional de HU-15, HU-31 y HU-32.

**Pendiente de definir:** si el ingreso se registra por remito aprobado (liquidación de bodega) o como precio por kg y variedad. Hasta que exista, el cálculo actual **no debe publicarse como margen**.

**Estado:** 🟡 Decidido, no implementado.

---

## D-006 — El cambio de rol aplica de inmediato, no en el próximo login

**Contexto:** HU-06 especifica que al cambiar el rol de un usuario "la sesión activa NO se invalida" y que el nuevo rol "aplica en el próximo inicio de sesión". La implementación real hace lo contrario: `jwt.strategy.ts` recarga el usuario desde la base en cada request y toma el rol de ahí, no del payload del JWT, así que el cambio surte efecto en la request siguiente.

**Decisión:** se adopta el comportamiento del código y **se corrige la especificación**. Es la opción más segura: si se degrada a un usuario, pierde los permisos en el acto en vez de seguir operando con el rol anterior hasta 8 horas (la vigencia del token).

**Consecuencia:** HU-06 fue actualizada. El criterio de aceptación que describía el comportamiento diferido ya no aplica.

**Estado:** ✅ Vigente.

---

## D-007 — El esquema lo gobiernan las migraciones, no `synchronize`

**Contexto:** hasta la Fase 2 el esquema se deducía de las entidades en cada arranque (`synchronize: NODE_ENV !== 'production'`). Sin control de versión del DDL, sin forma de revertir, y con un modo de falla silencioso: TypeORM traduce un renombre de columna a `DROP` + `ADD`, es decir pérdida de datos sin aviso.

Durante la propia implementación de la fase el problema se manifestó: un `dist/` compilado antes de los cambios arrancó con `synchronize: true` y **revirtió el esquema, borrando los UNIQUE, CHECK e índices que acababa de crear la migración inicial**. La detección fue accidental — el smoke test aceptó dos costos con la misma `valid_from`.

**Decisión:** el esquema se versiona en `src/database/migrations`. `synchronize` queda apagado por defecto y detrás de `DB_SYNCHRONIZE=true`; en producción la variable se ignora. Las migraciones se corren explícitamente con `npm run migration:run`, nunca al arrancar la app: con varias instancias, un arranque que migra hace que todas compitan por el mismo DDL.

**Consecuencia:** cambiar una entidad ahora exige generar la migración correspondiente. `npm run migration:generate -- src/database/migrations/<Nombre>` diffea entidades contra la base; si no reporta cambios, el modelo y el esquema coinciden.

**Estado:** ✅ Vigente.

---

## D-008 — Auditoría por decorador, e IP por contexto de request

**Contexto:** la auditoría estaba en 3 endpoints de 43. El patrón previsto —importar `LogAuditoriaModule` en cada módulo y llamar a `registrar()` en cada service— falla en silencio: el módulo que se olvida del import simplemente deja de auditar, y eso no rompe ningún test ni se nota en la respuesta.

Registrar la IP tenía un problema análogo: exigía sumar un parámetro `ip` a unas 40 firmas encadenadas de controller a service, donde omitirlo tampoco rompe nada y solo deja la columna en `null`.

**Decisión:**
1. `LogAuditoriaModule` y `MailModule` pasan a `@Global`, igual que `AlcanceEmpresaModule`.
2. La auditoría se declara con `@Auditar({accion, entidad})` sobre el handler y la resuelve un interceptor global que corre **después** de los guards, de modo que solo se audita lo que pasó autenticación y permisos.
3. La IP viaja por `AsyncLocalStorage` (`common/audit/request-context.ts`), poblado por un middleware. Sin dependencias nuevas y sin tocar firmas.
4. `registrar()` sanitiza contraseñas y tokens antes de persistir: el log es consultable por el rol Auditor, así que un hash guardado ahí es una filtración con retención indefinida.

**Consecuencia:** auditar un endpoint nuevo es una línea. Los endpoints de sincronización usan `datos: 'ninguno'` — un lote de 200 registros por request convertiría la columna `jsonb` en la tabla más pesada del sistema, duplicando datos que ya viven en su propia tabla.

**Estado:** ✅ Vigente.

---

## D-009 — Las fechas de negocio son locales, no UTC

**Contexto:** al verificar los criterios por bloque contra la base aparecieron tres bugs distintos con la misma raíz, y todos **solo se manifiestan entre las 21:00 y la medianoche** en Mendoza (UTC−3), que es por qué ninguna corrida anterior los había expuesto:

1. `new Date().toISOString().slice(0, 10)` se usaba en ocho lugares para calcular "hoy". A las 21:30 devuelve **mañana**: un costo cargado a esa hora quedaba vigente recién al día siguiente, y las labores de esa misma jornada se rechazaban por "sin costo vigente".
2. `new Date('2026-08-24')` se parsea como medianoche **UTC**; convertirlo de vuelta a fecha local retrocede un día. Afectaba a las tres búsquedas de costo y tarifa vigente.
3. El helper del test de `EsFechaNoRetroactiva` tenía el mismo defecto, así que **el test pasaba por casualidad**.

A esto se suma el bucketing de las series de sensores, que agrupaba un `timestamptz` en UTC contra fechas de labor locales y desalineaba los pares de correlación (F1-10).

**Decisión:**

1. Toda columna `date` del sistema —fecha de labor, de pesaje, `valid_from` de un costo— representa **el día de trabajo en la finca**, que es local. Se calcula con `fechaLocal()` / `hoyLocal()` de `common/fechas/rango-fechas.ts`. **`toISOString().slice(0, 10)` no se usa para esto.**
2. Las comparaciones sobre columnas `date` son **texto contra texto** en formato ISO, sin pasar por `Date`. Una columna `date` no tiene hora ni huso, así que el round-trip solo puede introducir corrimientos; y en ISO el orden lexicográfico coincide con el cronológico.
3. Al agrupar un `timestamptz` por día o por hora se usa `AT TIME ZONE` con la clave `zona_horaria` de la empresa (HU-33), validada contra `pg_timezone_names`.

**Consecuencia:** los filtros por rango de fechas de la API son inclusive y en día local. Un cliente que envíe fechas calculadas en UTC verá resultados corridos un día durante esas horas — el contrato es la fecha local.

**Estado:** ✅ Vigente.

---

## D-010 — El ingreso se modela como liquidación de bodega por remito

**Contexto:** cierra [D-005](#d-005--el-modelo-de-datos-incorporará-una-fuente-de-ingreso). No existía ninguna fuente de ingreso, así que el "margen bruto" de HU-15 y HU-31 era inexpresable: lo que se venía usando como ingreso era `monto_liquidacion`, que es lo que se le **paga** a la cuadrilla de vendimia —un costo de cosecha—.

Las opciones evaluadas fueron (a) liquidación de bodega por remito, (b) precio de venta por kg y variedad, (c) ambas.

**Decisión:** entidad `liquidaciones_bodega` colgando del **remito aprobado**, con bodega, kilos aceptados, precio por kg, descuentos, monto neto y comprobante.

Se eligió el remito porque HU-27 ya lo define como *"el documento oficial para la bodega"*: el ingreso entra por el punto donde la trazabilidad ya existe, y la cadena `remito → pesajes → cuartel` lo atribuye a un cuartel concreto sin prorratear nada. Un precio por variedad habría dado un ingreso *estimado*, que no refleja lo que la bodega efectivamente pagó ni sus descuentos por calidad.

**Consecuencias:**
- Los kilos aceptados se guardan aparte de los despachados: la bodega descuenta por materia extraña, sanidad o diferencia de balanza, y perder esa diferencia sería perder información real.
- `monto_neto` se persiste en vez de derivarse, con el mismo criterio append-only que los costos: el ingreso histórico no cambia si mañana cambia la fórmula.
- Un remito se liquida una sola vez (UNIQUE); volver a llamar al endpoint **corrige** la liquidación existente, que es lo que hace falta cuando la bodega emite un ajuste.
- Solo se liquidan remitos **aprobados**: un borrador puede rechazarse todavía, y un rechazado nunca llegó a la bodega.
- El margen sigue devolviéndose en `null` —no en 0— cuando no hay ninguna liquidación cargada: "todavía no se sabe" y "no ganó nada" son afirmaciones distintas.

**Estado:** ✅ Vigente e implementado.

---

## D-011 — Los catálogos maestros son por empresa

**Contexto:** cierra [D-h](specs/PLAN-MEJORAS.md), el residuo de S1 que la Fase 0 no pudo resolver. `catalogo_item`, `insumos` y `tipos_labor` no tenían forma de llegar a una empresa: eran globales a la instancia, así que **un Propietario que corregía el costo de un insumo lo cambiaba para todas las empresas**, y el ABM de HU-34 operaba sobre datos de terceros sin saberlo.

Se evaluó también un modelo híbrido (taxonomías compartidas, insumos y labores por empresa) y uno de catálogo global con un rol de administración de plataforma.

**Decisión:** `empresa_id` en las tres tablas, con la unicidad de nombre acotada por empresa.

Es la regla uniforme con el resto del sistema, sin casos especiales, y deja HU-34 funcionando tal como está especificada. El modelo híbrido introducía dos reglas distintas de pertenencia según la tabla; el rol de plataforma exigía un nivel que ninguna HU contempla y **no resolvía el problema de los costos**, que son por empresa por naturaleza.

**Consecuencias:**
- Las tablas de costos (`costo_insumo`, `costo_labor`, `tarifa_cuadrilla`) **no** llevan `empresa_id`: heredan el tenant de su padre por la FK. Desnormalizarlo abriría la puerta a que diverjan.
- La sincronización de labores ahora verifica que el tipo de labor y los insumos pertenezcan a la empresa. Antes no hacía falta porque eran globales; sin esa verificación, un registro podría aplicar los costos de otra empresa.
- El seed carga los catálogos **para la empresa demo**, no como valores globales.
- La migración agrega la columna nullable, la rellena y recién después la marca `NOT NULL`. Si hay más de una empresa se detiene con un mensaje explícito en vez de adivinar: la asignación es una decisión de negocio, no algo que una migración pueda inferir.

**Estado:** ✅ Vigente e implementado.

---

## D-012 — La asignación usuario↔finca solo enruta avisos

**Contexto:** HU-22 pide que la alerta de un sensor llegue a los Propietarios y Agrónomos *de la finca afectada*. `Usuario` solo conocía su empresa, así que el criterio era inexpresable y las alertas iban a toda la empresa.

**Decisión:** tabla `usuario_finca`, usada **exclusivamente para decidir destinatarios de avisos**. El control de acceso a datos sigue siendo por empresa (`AlcanceEmpresaService`).

Extenderla al alcance de datos —que un Capataz asignado a una finca no acceda a las demás— sería más correcto en seguridad, pero atraviesa todos los listados y **ninguna HU lo pide hoy**. Se deja como extensión posible, no como alcance actual.

**Consecuencia deliberada:** un usuario **sin ninguna asignación recibe los avisos de todas las fincas de su empresa**. Se eligió ese default porque el modo de falla opuesto —dejar de notificar en silencio mientras nadie configure las asignaciones— es el peligroso en un sistema de alertas.

**Estado:** ✅ Vigente e implementado.

---

## D-013 — El cuartel tiene dos estados, no dos fuentes de verdad en conflicto

**Contexto:** la discrepancia `D-f`. Las specs de HU-09, HU-10 y HU-28 hablan de estados **Pendiente / En cosecha / Cosechado**, el seed cargaba un catálogo `ESTADO_CUARTEL` con **Productivo / En implantación**, y `Cuartel.estado` era un `varchar` libre que ningún código escribía ni leía. Parecía que había que elegir una de las dos listas y descartar la otra.

**Decisión:** no se descarta ninguna, porque **describen ciclos distintos y ortogonales**:

- **Ciclo de vendimia** — enum `EstadoCuartel` (`pendiente` → `en_cosecha` → `cosechado`), en la columna `estado`. Es una máquina de estados **derivada de hechos**: la escribe el sistema al sincronizarse el primer pesaje y al aprobarse o rechazarse un remito. No hay transición manual, y por eso es un enum de código y no una FK a un catálogo editable: si un usuario pudiera renombrar o borrar el valor, rompería las transiciones.
- **Ciclo de plantación** — catálogo `ESTADO_CUARTEL` (Productivo, En implantación). Describe la madurez de la planta, cambia cada varios años y es propio de cada empresa, así que sí corresponde que sea un catálogo editable ([D-011](#d-011--los-catálogos-maestros-son-por-empresa)).

Un cuartel en implantación puede estar `pendiente` de cosecha, y uno productivo puede estar `cosechado`: son dimensiones independientes.

**Consecuencia:** el catálogo `ESTADO_CUARTEL` **queda sin vincular a ninguna columna** hasta que alguna HU pida el ciclo de plantación. Se deja seedeado y no se borra para no perder el dato, pero hoy no lo consume nadie — está anotado en `estado-cuartel.enum.ts` para que no se confunda con el enum de vendimia.

**Estado:** ✅ Vigente e implementado (F1-8).
