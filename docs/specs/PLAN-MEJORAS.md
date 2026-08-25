# Plan de mejoras — Auditoría de las 36 Historias de Usuario

Resultado de auditar el código real de los 24 módulos del backend contra los criterios de aceptación de cada HU (ver [`README.md`](README.md) para las especificaciones).

**Veredicto original (2026-08-24): ninguna de las 36 HU cumplía el 100% de sus criterios de aceptación.** 12 sustancialmente incompletas, 24 parciales. Los endpoints existían y respondían — lo que faltaba eran reglas de negocio, validaciones, aislamiento entre empresas y auditoría.

**Estado hoy (2026-08-26): 35 completas, 1 parcial.** Cerradas las Fases 0 (10/10), 1 (14/14) y 2 (cimientos, criterios por bloque y tests), y resueltas **las ocho decisiones de producto** de la sección 6. Verificado con 88 tests unitarios y un smoke test de 172 casos end-to-end contra PostgreSQL real, desde una base recreada desde cero y sin deriva entre las entidades y el esquema.

Lo único abierto es **HU-35**: el push FCM está implementado, pero el envío real contra Firebase no se pudo verificar sin un service account ([D-015](../DECISIONS.md)). Todo lo demás del criterio —los tres productores de evento, la tabla de device tokens, el alta idempotente— sí está probado.

> **Importante:** la mayoría de los problemas **no eran de las HU individuales sino transversales**. Arreglar los 10 problemas sistémicos de la sección 2 cerró criterios de aceptación en casi las 36 HU a la vez. Ir HU por HU habría sido mucho más caro y habría dejado los agujeros de seguridad abiertos más tiempo.
>
> Se cumplió: **los 10 problemas sistémicos están cerrados.** El último en caer fue S3 en su parte de base — el log de auditoría es ahora append-only por trigger, verificado contra PostgreSQL — y S10, con los tres huecos de test que faltaban.
>
> También quedó cerrado el endurecimiento de despliegue: la aplicación ya puede correr con un **rol acotado sin privilegios de DDL** ([D-017](../DECISIONS.md)), creado por `npm run db:rol-app` y comprobado por `npm run db:verificar-privilegios`. Con la API conectada así, el smoke test pasa 172/172.

---

## 1. Veredicto por HU

La columna **Motivo principal detectado** es el hallazgo original y se deja tal cual: vale como registro de qué había. La columna **Hoy** es el estado verificado contra el código, y coincide con el campo `Estado` de cada spec.

| HU | Veredicto original | Motivo principal detectado | Hoy |
|---|---|---|---|
| HU-01 Iniciar sesión | 🟠 PARCIAL | bcrypt costo 10 (no 12), 403 en vez de 429, sin auditoría de login fallido, enumeración por timing | 🟢 Completa |
| HU-02 Cerrar sesión | 🔴 INCOMPLETA | El logout **no invalida el token**: solo escribe auditoría. Sin blacklist ni refresh tokens | 🟢 Completa |
| HU-03 Recuperar contraseña | 🟠 PARCIAL | **No se envía ningún email** → flujo inejecutable. Sin rate limiting, sin validación de complejidad server-side | 🟢 Completa |
| HU-04 Datos personales + password | 🟠 PARCIAL | **Escalada de privilegios** (ver F0-1). Sin auditoría de cambio de contraseña | 🟢 Completa |
| HU-05 ABM Usuarios | 🔴 INCOMPLETA | Sin contraseña temporal ni email de bienvenida, sin listado paginado/filtrado, **sin check de "último Propietario"**, sin auditoría | 🟢 Completa |
| HU-06 Modificar rol | 🔴 INCOMPLETA | **Sin bloqueo de auto-cambio de rol**, sin lista blanca de roles asignables, sin auditoría | 🟢 Completa |
| HU-07 Logs de auditoría | 🔴 INCOMPLETA | Solo 3 eventos auditados en todo el sistema. Sin paginación ni filtros, sin append-only real en BD | 🟢 Completa |
| HU-08 ABM fincas | 🟠 PARCIAL | Baja **no verifica cuarteles activos** (cuarteles huérfanos), sin contador de cuarteles, sin auditoría | 🟢 Completa |
| HU-09 ABM cuarteles | 🟠 PARCIAL | Baja no verifica labores/pesajes, `estado` nunca se setea, año sin validar rango | 🟢 Completa |
| HU-10 Cuarteles en mapa | 🔴 INCOMPLETA | **`Cuartel` no tiene lat/lng** → imposible posicionar marcadores. `estado` siempre `null` → sin colores | 🟢 Completa |
| HU-11 Búsqueda fincas/cuarteles | 🔴 INCOMPLETA | Sin búsqueda en cuarteles, sin filtros por variedad/estado/año, sin ordenamiento, sin paginación | 🟢 Completa |
| HU-12 Registrar labor | 🟠 PARCIAL | No se persiste el timestamp de creación local | 🟢 Completa |
| HU-13 Registrar insumos | 🟠 PARCIAL | **Insumo duplicado dobla el costo** sin validación. No existe inventario/stock | 🟢 Completa |
| HU-14 Sincronización offline | 🟠 PARCIAL | **Rama de error rota** (ver F1-2), sin flag "Inconsistencia de Catálogo", sin límite de lote, sin auditoría | 🟢 Completa |
| HU-15 Margen bruto | 🔴 INCOMPLETA | **No calcula margen** (no hay ingresos). Un solo cuartel, sin filtros, sin `/ha`, sin filtro de `estado_sync` | 🟢 Completa |
| HU-16 ABM labores/insumos | 🟠 PARCIAL | Unidades sin enum, unicidad global (no "entre activos"), baja sin verificar histórico, sin auditoría | 🟢 Completa |
| HU-17 Historial por cuartel | 🔴 INCOMPLETA | Sin paginación ni filtros, **no trae los insumos**, sin restricción de rol, expone la entidad `usuario` completa | 🟢 Completa |
| HU-18 Registro de sensores | 🟠 PARCIAL | **El listado no trae la última lectura** (requisito central), 400 en vez de 409, `update` no revalida unicidad | 🟢 Completa |
| HU-19 Ingesta de lecturas | 🔴 INCOMPLETA | **Sin API key** (ver F0-3), no rechaza sensores inactivos, sin validación de rango físico, evaluación inline | 🟢 Completa |
| HU-20 Monitoreo y gráficos | 🟠 PARCIAL | Sin `desde`/`hasta` (solo `limit`), sin agregación por hora/día, sin índice en la tabla de lecturas | 🟢 Completa |
| HU-21 Umbrales | 🟠 PARCIAL | **Bug: imposible borrar un umbral** (ver F1-6). Sin aviso de "ya supera el umbral", sin auditoría | 🟢 Completa |
| HU-22 Alertas por umbral | 🟠 PARCIAL | **Sin deduplicación** → una alerta por lectura. **No se envía email**. Destinatarios por empresa, no por finca | 🟢 Completa |
| HU-23 Cuadrillas | 🟠 PARCIAL | **La regla tarifa-por-rol no existe** (ver F0-6). Tarifa retro-datable, desempate no determinista | 🟢 Completa |
| HU-24 Pesaje diario | 🟠 PARCIAL | Sin CHECK en BD, **el maestro de transportes no existe** → criterio inimplementable | 🟢 Completa |
| HU-25 Liquidación | 🟠 PARCIAL | Write-once correcto, pero **pesaje sin tarifa se guarda con monto `null` y estado SINCRONIZADO** | 🟢 Completa |
| HU-26 Borrador de remito | 🔴 INCOMPLETA | **Sin fecha** (agrupa todo el histórico), **incluye pesajes no sincronizados**, sin control de concurrencia, sin notificación | 🟢 Completa |
| HU-27 Aprobación de remitos | 🟠 PARCIAL | **Ningún criterio al 100%.** Motivo de rechazo acepta 2 chars, numeración con race condition, no existe estado "Observado" | 🟢 Completa |
| HU-28 Estado de cosecha | 🔴 INCOMPLETA | **La máquina de estados del cuartel no existe** (ver F1-8). Sin tabla por finca, sin estado del último remito | 🟢 Completa |
| HU-29 Correlación sensor-costos | 🟠 PARCIAL | **Pearson con umbral `n<2`** → correlaciones falsas de ±1.0. Sin interpretación textual, sin `@Roles` | 🟢 Completa |
| HU-30 Recomendaciones | 🔴 INCOMPLETA | **No existe la tabla `recomendaciones`** — se calculan al vuelo y no tienen `id`. Sin gate de 30 días, reglas hardcodeadas | 🟢 Completa |
| HU-31 Comparar campañas | 🟠 PARCIAL | **El "margen bruto" no es un margen** (ver F1-9). Faltan `costo/ha`, promedios IoT, y distinguir 0 de "sin datos" | 🟢 Completa |
| HU-32 Dashboard | 🔴 INCOMPLETA | **No diferencia por rol en absoluto** → el Auditor recibe costos (ver F0-5) | 🟢 Completa |
| HU-33 Configuración | 🟠 PARCIAL | **`configuracion` no tiene `empresaId`** → global a la instancia. **`smtp_pass` en texto plano**. Sin claves seedeadas | 🟢 Completa |
| HU-34 Tablas maestras | 🟠 PARCIAL | `update()` no revalida unicidad, sin auditoría, chequeo de referencias hardcodeado | 🟢 Completa |
| HU-35 Notificaciones | 🔴 INCOMPLETA | Solo 1 de 3 productores de evento → **el Capataz nunca recibe notificaciones**. Sin FCM, sin purga, sin paginación | 🟠 Parcial — el envío push real no se pudo verificar sin credenciales de Firebase |
| HU-36 Centro de ayuda | 🟠 PARCIAL | El email funciona pero **nunca se envía** (claves SMTP no seedeadas). Tickets sin filtrar por empresa | 🟢 Completa |

Leyenda: 🔴 INCOMPLETA (criterios centrales ausentes) · 🟠 PARCIAL (funciona pero incumple algún criterio) · 🟢 COMPLETA (criterios cubiertos)

---

## 2. Los 10 problemas sistémicos

Cada uno de estos rompe criterios de aceptación en **muchas HU a la vez**. Son la unidad de trabajo real.

| # | Problema | HU afectadas |
|---|---|---|
| **S1** ✅ | ~~**Sin aislamiento multi-tenant.**~~ **Resuelto en Fase 0** (F0-4), salvo el residuo de catálogos globales (ver `D-h`). Descripción original: El JWT trae `empresaId` pero casi ningún service filtra por él. `usuarios`, `cuarteles`, `registro-labor`, `sensores`, `lecturas-iot`, `alertas-iot`, `umbral-sensor`, `inteligencia-agronomica`, `cuadrillas`, `pesaje-vendimia`, `remitos` y los tickets de ayuda son todos IDOR cross-tenant. Un Propietario de la empresa B puede **aprobar un remito de la empresa A**. `configuracion` no tiene `empresaId` en absoluto. | Casi todas |
| **S2** ✅ | ~~**RBAC permisivo por default.**~~ **Resuelto en Fase 0** (F0-8): el guard es fail-closed y los 30 handlers descubiertos quedaron cubiertos. Descripción original: `RolesGuard` devuelve `true` cuando el handler no tiene `@Roles` ([roles.guard.ts:21](../../src/common/guards/roles.guard.ts#L21)). Muchos GET quedan abiertos: el Auditor lee fincas, cuarteles, labores y **margen bruto**; todo `inteligencia-agronomica` no tiene ni un `@Roles`. | HU-07, 15, 17, 29-31 |
| **S3** | **Auditoría casi inexistente.** `LogAuditoriaService.registrar()` se invoca en 3 lugares, todos en `auth`. Ningún otro módulo importa `LogAuditoriaModule`, y `datosAnteriores`/`datosNuevos` nunca se pueblan. Además `registrar()` no acepta un `EntityManager`, así que es estructuralmente imposible correrlo dentro de la transacción de la operación principal como pide HU-07. | HU-05, 06, 07, 08, 09, 14, 16, 18, 21, 23, 27, 33, 34 |
| **S4** | **Sin paginación en ningún endpoint del repo.** Los listados devuelven arrays planos completos: `take: 200` fijo en auditoría, `take: 50` en notificaciones, sin límite en el resto. | HU-05, 07, 08, 09, 11, 17, 35 |
| **S5** | **Sin migraciones.** El esquema depende de `synchronize`, desactivado en producción. **En producción no existen las tablas ni los constraints** — incluido el UNIQUE de `local_uuid` del que depende toda la idempotencia offline. Tampoco se pueden aplicar GRANTs/RLS para el append-only de HU-07 ni los CHECK/índices que piden varias HU. | HU-07, 14, 19, 24, y el despliegue entero |
| **S6** | **Sin infraestructura asíncrona.** No hay `bullmq`, `redis` ni `@nestjs/schedule`. Todo corre inline: la evaluación de umbrales bloquea la respuesta de ingesta, no hay cron de consolidación nocturna (`LecturaIotHistorico` es una **tabla muerta** que nada escribe ni lee), no hay purga de notificaciones ni de tokens vencidos. | HU-03, 19, 22, 35 |
| **S7** | **Sin envío de emails** (salvo tickets de soporte, que tampoco se envían por falta de configuración seedeada). El "recuperar contraseña" genera el token y **el controller lo descarta**. No hay email de bienvenida ni de alerta IoT ni de remito pendiente. | HU-03, 05, 22, 26, 36 |
| **S8** | **Dinero que se pierde en silencio.** El mismo patrón en dos módulos: si no hay costo/tarifa vigente, se persiste `null` y el registro se marca **SINCRONIZADO**. Una labor cuesta $0 o un pesaje entra al remito con kilos y sin liquidación, sin ninguna señal de error. | HU-14, 16, 24, 25, 26 |
| **S9** | **Versionado `valid_from` frágil, replicado 3 veces** (insumos, tipos de labor, cuadrillas): (a) `validFrom` lo manda el cliente sin validar → **retro-datado** que reescribe el costo vigente del pasado; (b) el desempate ordena solo por `validFrom DESC`, así que con dos registros del mismo día **el monto depende del optimizador de Postgres**. | HU-16, 23, 25 |
| **S10** | **Casi cero tests.** Solo `app.controller.spec.ts` y el e2e "Hello World". Sin tests para idempotencia del sync, costo vigente a fecha, escalada de privilegios, bloqueo por intentos, ni Pearson. | Todas |

---

## 3. Fase 0 — Seguridad (bloqueante, antes de cualquier despliegue)

Estos son explotables hoy contra la instancia tal como está.

> **Estado: 10 de 10 cerrados.** Verificado con `tsc`, `eslint`, `nest build` y 27 tests unitarios; **no** con una prueba end-to-end contra la base (Docker no estaba disponible en la máquina de desarrollo).
>
> **Queda un residuo de S1 que necesita decisión de modelo** (ver `D-h` en la sección 6): `catalogo_item`, `insumos`, `tipos_labor` y sus tablas de costos **no tienen `empresaId` ni forma de llegar a una empresa**, así que son globales a la instancia. Un Propietario que edita el costo de un insumo lo cambia para todas las empresas. Cerrarlo exige agregar la columna y decidir si los catálogos maestros son por empresa o compartidos.

| # | Acción | Archivo |
|---|---|---|
| **F0-1** | ✅ **Cerrar la escalada de privilegios.** `PATCH /usuarios/me` acepta `rolId`, `empresaId`, `activo` y `email` porque `UpdateUsuarioDto` = `PartialType(OmitType(Create,['password']))`. Con el UUID que da `GET /roles` (sin `@Roles`), **cualquier usuario se hace Propietario en 2 requests**. Crear un `UpdatePerfilDto` con solo `nombre` y un `updatePerfil()` que no haga `Object.assign` del DTO completo. | [usuarios.controller.ts:37](../../src/modules/usuarios/usuarios.controller.ts#L37), [update-usuario.dto.ts](../../src/modules/usuarios/dto/update-usuario.dto.ts), [roles.controller.ts:10](../../src/modules/roles/roles.controller.ts#L10) |
| **F0-2** | ✅ **Dejar de devolver `passwordHash`.** El `@Exclude()` es inerte: no hay `ClassSerializerInterceptor` registrado. Agregarlo globalmente y marcar la columna `select: false`. | [main.ts:15](../../src/main.ts#L15), [usuario.entity.ts:28](../../src/modules/usuarios/entities/usuario.entity.ts#L28) |
| **F0-3** | ✅ **API key para la ingesta IoT.** Hoy el endpoint está bajo el guard JWT global y sin `@Roles`: cualquier usuario autenticado de cualquier empresa inyecta telemetría falsa y dispara alertas. Y el firmware no puede publicar. Crear `ApiKeyGuard` (comparación con `crypto.timingSafeEqual`) + `IOT_API_KEY` en `.env`. | [lecturas-iot.controller.ts:31](../../src/modules/lecturas-iot/lecturas-iot.controller.ts#L31) |
| **F0-4** | ✅ **Aislamiento multi-tenant (S1).** Resuelto con un `AlcanceEmpresaService` global que verifica la cadena `empresa → finca → cuartel/sensor/cuadrilla` y lanza **404** (no 403, que confirmaría la existencia del recurso en otro tenant). Aplicado en fincas, cuarteles, sensores, umbrales, lecturas, alertas, inteligencia agronómica, cuadrillas, labores, pesajes, remitos, tickets y log de auditoría. `empresaId` salió de `CreateFincaDto` y `CreateUsuarioDto` (sale del token) y `configuracion` pasó a clave primaria compuesta `(empresa_id, clave)`. | [alcance-empresa.service.ts](../../src/common/tenant/alcance-empresa.service.ts) |
| **F0-5** | ✅ **Dashboard por rol.** El controller recibe el `user` completo pero pasa solo `empresaId`; los 4 roles reciben el mismo payload. **El Auditor recibe `costoLaboresTotal`, `costoInsumosTotal` y `kgCosechadosCampaniaActual`.** Implementar la rama Auditor primero (solo log de auditoría). | [dashboard.controller.ts:14](../../src/modules/dashboard/dashboard.controller.ts#L14) |
| **F0-6** | ✅ **Regla tarifa-por-rol en cuadrillas.** El criterio "el backend ignora el campo tarifa si lo manda un Capataz" **no existe**. Además el Capataz no puede crear cuadrillas (403, contra la spec) y el Agrónomo sí puede fijar tarifas (la spec lo reserva al Propietario). | [cuadrillas.controller.ts:44](../../src/modules/cuadrillas/cuadrillas.controller.ts#L44), [cuadrillas.service.ts:34](../../src/modules/cuadrillas/cuadrillas.service.ts#L34) |
| **F0-7** | ✅ **`smtp_pass` en texto plano** vía `GET /api/configuracion`. Enmascarar secretos o moverlos a variables de entorno. Whitelist de claves en `SetConfiguracionDto` (hoy acepta cualquier clave). | [configuracion.service.ts:14](../../src/modules/configuracion/configuracion.service.ts#L14) |
| **F0-8** | ✅ **Proteger los GET sin `@Roles` (S2).** Recomendado: **invertir el default de `RolesGuard`** para que la ausencia de `@Roles` deniegue, con un `@AnyRole()` explícito donde corresponda. Es más robusto que ir agregando decoradores de a uno. | [roles.guard.ts:21](../../src/common/guards/roles.guard.ts#L21) |
| **F0-9** | ✅ **Candados de administración.** Bloquear el auto-cambio de rol y la baja del último Propietario. Sin esto el sistema puede quedar **sin ningún Propietario activo y sin forma de recuperarse por API**. | [usuarios.service.ts:64](../../src/modules/usuarios/usuarios.service.ts#L64), [usuarios.service.ts:111](../../src/modules/usuarios/usuarios.service.ts#L111) |
| **F0-10** | ✅ bcrypt a costo 12 (hoy 10). Ojo: `usuarios.service.ts:14` lee la env var **en tiempo de import**, antes de que `ConfigModule` cargue `.env` — moverla a runtime. Rate limiting (`@nestjs/throttler`) en login y forgot-password. Eliminar la enumeración por timing en login. | [auth.service.ts:29](../../src/modules/auth/auth.service.ts#L29), [usuarios.service.ts:14](../../src/modules/usuarios/usuarios.service.ts#L14) |

---

## 4. Fase 1 — Correctitud de datos y dinero

> **Estado: 14 de 14 cerrados.** F1-10 se completó con los criterios por bloque y F1-9 con la liquidación de bodega ([D-010](../DECISIONS.md)). Verificado con `tsc`, `eslint`, `nest build` y 36 tests unitarios; **no** con una prueba end-to-end contra la base.
>
> Quedan dos parciales:
> - **F1-9** — se dejó de publicar el número falso (`margenBruto: null` + `margenBrutoDisponible: false`, y el campo pasó a llamarse `costoCosecha`, que es lo que realmente es). El margen real depende de modelar el ingreso, decidido en [D-005](../DECISIONS.md) y todavía sin implementar.
> - **F1-10** — ✅ **cerrado**. El umbral de Pearson subió a 7 pares con interpretación textual, y el bucketing por zona horaria se corrigió al implementar los criterios por bloque: la serie agrupa con `AT TIME ZONE` sobre la clave `zona_horaria`, que ahora sí se seedea.

| # | Acción | Archivo |
|---|---|---|
| **F1-1** | ✅ **Costo $0 silencioso (S8).** Si `getCostoVigente` devuelve `null`, la labor se guarda SINCRONIZADA valiendo $0. No es un caso raro: el alta de catálogo fija `valid_from = hoy`, así que **toda labor con fecha anterior al alta queda sin costo**. Debe marcarse ERROR o rechazarse. | [registro-labor.service.ts:84](../../src/modules/registro-labor/registro-labor.service.ts#L84) |
| **F1-2** | ✅ **Rama de error del sync rota.** El `catch` inserta el registro de error **dentro de la transacción ya abortada** — en Postgres eso siempre falla. Como los errores probables son de BD (FK, UNIQUE), la rama relanza; y al no haber try/catch por ítem, **un registro malo devuelve 500 y descarta el lote entero**. Mismo bug en pesajes. | [registro-labor.service.ts:109](../../src/modules/registro-labor/registro-labor.service.ts#L109), [pesaje-vendimia.service.ts:92](../../src/modules/pesaje-vendimia/pesaje-vendimia.service.ts#L92) |
| **F1-3** | ✅ **Pesaje sin tarifa (S8).** Se persiste `montoLiquidacion = null` y estado SINCRONIZADO; después suma kg al remito sin sumar liquidación. | [pesaje-vendimia.service.ts:77](../../src/modules/pesaje-vendimia/pesaje-vendimia.service.ts#L77) |
| **F1-4** | ✅ **El remito incluye pesajes no sincronizados.** Agregar `estadoSync: SINCRONIZADO` al `where`. Hoy los pesajes en error entran al remito: kilos que nadie liquida. | [remitos.service.ts:42](../../src/modules/remitos/remitos.service.ts#L42) |
| **F1-5** | ✅ **Insumo duplicado dobla el costo.** Sin validación en el DTO ni constraint UNIQUE `(registro_labor_id, insumo_id)`. | [detalle-insumo-labor.entity.ts](../../src/modules/registro-labor/entities/detalle-insumo-labor.entity.ts) |
| **F1-6** | ✅ **Imposible borrar un umbral.** `umbral.umbralMinimo = dto.umbralMinimo ?? umbral.umbralMinimo ?? null` — el `??` conserva el valor anterior. Usar `'umbralMinimo' in dto`. | [umbral-sensor.service.ts:27](../../src/modules/umbral-sensor/umbral-sensor.service.ts#L27) |
| **F1-7** | ✅ **Concurrencia y numeración de remitos.** (a) Dos requests concurrentes leen el mismo set de pesajes y **crean dos remitos**; el primero queda con totales de pesajes que ya no le pertenecen. Falta `SELECT … FOR UPDATE` sobre el cuartel + 409. (b) El número usa `count()+1`: colisión concurrente garantizada bajo carga (→500, no 409), no reinicia por año, y **reutiliza números** tras un borrado. Usar una `SEQUENCE`. | [remitos.service.ts:36](../../src/modules/remitos/remitos.service.ts#L36), [remitos.service.ts:145](../../src/modules/remitos/remitos.service.ts#L145) |
| **F1-8** | ✅ **Implementar la máquina de estados del cuartel.** La columna `estado` existe pero **ningún código la escribe ni la lee**, y no está en los DTO. Bloquea HU-28 por completo, los colores de HU-10 y el chequeo de baja de HU-09. Transiciones: `pendiente → en_cosecha` (primer pesaje sincronizado) → `cosechado` (remito aprobado) → vuelta a `en_cosecha` (rechazo). Y rechazar pesajes sobre cuarteles cosechados. **Antes hay que reconciliar los valores**: la spec dice Pendiente/En cosecha/Cosechado, el seed carga Productivo/En implantación. | [cuartel.entity.ts:51](../../src/modules/cuarteles/entities/cuartel.entity.ts#L51), [seed.ts:79](../../src/database/seeds/seed.ts#L79) |
| **F1-9** | 🟡 **El "margen bruto" no es un margen.** `margenBruto = Σ montoLiquidacion − costoTotal`, pero `montoLiquidacion` es lo que se **paga** a la cuadrilla: un costo, no un ingreso. El indicador es `costoCosecha − (costoLabores + costoInsumos)`: sin sentido económico y de signo arbitrario. **Requiere decisión de producto** (ver sección 6). Mientras tanto: renombrar a `costoCosecha` y devolver `margenBruto: null`, para no publicar un número falso. | [inteligencia-agronomica.service.ts:219](../../src/modules/inteligencia-agronomica/inteligencia-agronomica.service.ts#L219) |
| **F1-10** | ✅ **Pearson.** Umbral subido a `n < 7` con interpretación textual y motivo (Fase 1). El **bucketing por zona horaria se cerró junto con los criterios por bloque**: la serie del sensor ahora agrupa con `AT TIME ZONE` usando la clave `zona_horaria` de la empresa, así que los pares se alinean contra las fechas locales de las labores en vez de contra UTC. | [inteligencia-agronomica.service.ts](../../src/modules/inteligencia-agronomica/inteligencia-agronomica.service.ts) |
| **F1-11** | ✅ **Bloqueo permanente de cuenta.** `registrarIntentoFallido` nunca resetea el contador al vencer la ventana: pasados los 15 min, el siguiente fallo evalúa `6 >= 5` y re-bloquea. La cuenta queda inutilizable hasta un login exitoso, que es justo lo que no se puede hacer. | [usuarios.service.ts:90](../../src/modules/usuarios/usuarios.service.ts#L90) |
| **F1-12** | ✅ **Endurecer el versionado `valid_from` (S9)** en los 3 módulos: validar que no sea retroactivo, desempatar por `createdAt DESC`, y agregar UNIQUE `(entidad_id, valid_from)`. | insumos, tipo-labor, cuadrillas |
| **F1-13** | ✅ **Estado "Observado" de pesajes.** No existe. Al rechazar un remito los pesajes vuelven a `pendiente_remito` — el pool exacto de "listos para remito" — así que **el próximo borrador los reincluye automáticamente sin revisión, derrotando el propósito del rechazo**. Además `remitoId: null` borra la trazabilidad al remito rechazado. | [remitos.service.ts:135](../../src/modules/remitos/remitos.service.ts#L135) |
| **F1-14** | ✅ **Filtrar `estado_sync` en todo el costeo y los listados.** Hoy los registros en error entran al margen bruto, al historial, al dashboard y a la comparación de campañas. | registro-labor, dashboard, inteligencia-agronomica, pesaje-vendimia |

---

## 5. Fase 2 — Cimientos y criterios faltantes

> **Estado: los 6 cimientos (F2-1 a F2-6) cerrados, y los criterios por bloque cerrados salvo lo que se detalla abajo.** Verificado con `tsc`, `eslint`, `nest build`, **71 tests unitarios** y un **smoke test end-to-end de 133 casos contra PostgreSQL real** (`npm run test:smoke`).

**Cimientos (habilitan el resto):**

- **F2-1 — Migraciones TypeORM (S5).** ✅ `src/config/data-source.ts` + scripts `migration:generate|run|revert|show`. Migración inicial `EsquemaInicial` con las 27 tablas, los UNIQUE de vigencia (`costo_insumo`, `costo_labor`, `tarifa_cuadrilla`), el UNIQUE `(registro_labor_id, insumo_id)`, los CHECK de cantidades positivas y los 12 índices. `synchronize` quedó **apagado por defecto** y detrás de `DB_SYNCHRONIZE`; en producción se ignora la variable.
  > Durante esta fase el problema se manifestó en vivo: un `dist/` viejo con `synchronize: true` **revirtió el esquema y borró las constraints recién creadas**. Es exactamente el modo de falla que S5 describía.
  >
  > ✅ **Cerrado lo que faltaba de F2-1:** el append-only de HU-07 quedó garantizado por un trigger (que aplica también a superusuarios) y la aplicación tiene su rol acotado, con verificación ejecutable ([D-017](../DECISIONS.md)).
- **F2-2 — Utilidad de paginación (S4).** ✅ `PaginationQueryDto` + envelope `{data, total, page, pageSize, totalPages}` con techo duro de 100 filas. Aplicado a usuarios, log de auditoría, notificaciones, lecturas IoT, historial de labores, pesajes por cuartel y remitos. De paso: el listado de remitos **ya no exige `cuartelId`** (el panel de aprobaciones de HU-27 era inexpresable) y `GET /remitos/:id` devuelve el detalle de pesajes que la vista imprimible necesitaba.
- **F2-3 — Auditoría transversal (S3).** ✅ `LogAuditoriaModule` pasó a `@Global` —el import olvidado fallaba en silencio—, `registrar()` acepta un `EntityManager` para ser transaccional (HU-07) y **sanitiza credenciales y tokens** antes de persistir. Decorador `@Auditar` sobre **43 endpoints de 15 módulos**, resuelto por un interceptor que corre después de los guards. La IP se propaga con `AsyncLocalStorage` en vez de cablearla por ~40 firmas, y `trust proxy` quedó configurado. El listado tiene filtros por actor, entidad, acción y rango de fechas.
- **F2-4 — `MailModule` (S7).** ✅ `MailService` global que resuelve el SMTP por empresa desde `configuracion` y cae a variables de entorno, con modo `MAIL_TRANSPORT=log` para desarrollo. **El flujo de recuperación de HU-03 ahora manda el correo** (antes solo generaba el token y lo devolvía en la respuesta HTTP). Tickets dejó de tener su propio `createTransport`. Las claves `smtp_*`, `support_email`, `nombre_organizacion`, `moneda`, `unidades` y `zona_horaria` se seedean.
- **F2-5 — Asincronía (S6).** ✅ Se tomó la opción intermedia de `D-g`: `EventEmitter2` saca la evaluación de umbrales del camino de respuesta de la ingesta, y `@nestjs/schedule` corre los tres cron —purga de notificaciones (30 días), purga de tokens vencidos y consolidación nocturna de lecturas crudas en promedios horarios—. **Sin Redis ni BullMQ.**
  > **Límite conocido:** los cron son in-process, así que con más de una instancia cada una ejecuta su copia. Las tres tareas son idempotentes (borran por rango de fechas), así que hoy el peor caso es trabajo duplicado. Al escalar horizontalmente hay que pasarlas a una cola con lock distribuido.
- **F2-6 — Índices faltantes.** ✅ `(sensor_id, sensor_timestamp)` en lecturas, `created_at`/`actor_id`/`(entidad, entidad_id)` en auditoría, `(empresa_id, activo)` en usuarios —`activo` solo no discrimina lo suficiente—, `token_hash` en tokens, más `(cuartel_id, estado)` y `remito_id` en pesajes, `(cuartel_id, fecha)` en labores y dos en notificaciones.

**Encontrado al verificar contra la base (no estaba en la auditoría original):**

- **La corrección de F1-6 estaba incompleta.** `'umbralMaximo' in dto` da `true` aunque el cliente no mande el campo: con `target: ES2023` los campos declarados de la clase se emiten como propiedades propias, así que `plainToInstance` los materializa en `undefined`. Omitir un umbral lo borraba igual que enviarlo en `null`. Corregido comparando contra `undefined`, con test de regresión a nivel de servicio (el test del DTO solo no lo detectaba).
- **Una violación de constraint devolvía 500.** Ahora el filtro global traduce los códigos de PostgreSQL (`23505`, `23514`, `23503`, `23502`) a 409/400 con un mensaje por constraint, sin filtrar nombres de tablas al cliente.
- **`GET /registro-labor/cuartel/:id/margen-bruto` seguía publicando un margen inexistente.** F1-9 se había corregido solo en `inteligencia-agronomica`; este segundo endpoint devolvía costos bajo un nombre que promete un margen. Alineado con `margenBruto: null` y `margenBrutoDisponible: false`.
- **Bug de zona horaria en los filtros de fecha** (introducido al implementar F2-2): `new Date('2026-08-24')` es medianoche **UTC**, que en Mendoza cae el día anterior, así que filtrar por "hoy" devolvía cero resultados. Extraído a `common/fechas/rango-fechas.ts` con tests. **Es el mismo error de fondo que F1-10**, y aparecieron tres casos más al implementar los criterios por bloque (ver sección 5).

**Criterios de aceptación por bloque**

> **Estado: cerrados casi por completo.** Lo que queda está listado como "pendiente" en cada bloque y depende de decisiones de producto abiertas o de trabajo de despliegue.

- **Auth.** ✅ Invalidación de token en logout con `jti` y tabla `token_revocado` —el logout solo escribía auditoría y el JWT seguía sirviendo sus 8 horas—; alta con **contraseña temporal** y correo de bienvenida de 48 h, con `debe_cambiar_password` para que el cliente fuerce el cambio; política de contraseñas server-side en un decorador único (`EsPasswordSegura`) aplicado a las tres puertas de entrada; listado de usuarios y log de auditoría con búsqueda, filtros y paginación (cerrado en F2-2/F2-3). Los códigos HTTP ya se habían corregido en Fase 0.
  > El tope de 72 caracteres no es cosmético: **bcrypt trunca en silencio a 72 bytes**, así que aceptar más largo da una falsa sensación de fortaleza.
- **Cartografía.** ✅ `latitud`/`longitud` en `Cuartel` —HU-10 no tenía dónde poner los marcadores—; 409 en la baja de finca con cuarteles activos y en la de cuartel con labores o pesajes; contador de cuarteles activos en el listado, resuelto con **una** consulta agrupada y no con un N+1; HU-11 completa (`GET /cuarteles/buscar` a nivel de empresa con filtros de variedad, estado y año, y orden por lista blanca); `GET /cuarteles/variedades` para poblar el filtro; validaciones de rango.
  > El año de implantación usa un validador propio y no `@Max(new Date().getFullYear())`: ese argumento se evalúa una sola vez al cargar el módulo, así que un proceso vivo el 1 de enero seguiría rechazando el año nuevo.
- **Operaciones.** ✅ Flag `inconsistencia_catalogo` —el registro se acepta y se marca, porque el trabajo físico ocurrió—; lote de 10 registros por request y **200 en el reenvío del mismo `local_uuid`**, 201 al crear; `created_at_local` con orden del lote por ese campo; HU-15 real (`GET /registro-labor/costeo`: todos los cuarteles, `SUM` en SQL, costo por hectárea y filtros); HU-17 real (filtros por tipo, usuario y rango, y **el Capataz acotado a sus registros del día**); unidades como enum; unicidad de nombre **entre activos** mediante índice parcial.
  > Los insumos se agregan en una subconsulta separada: unirlos a las labores en la misma agregación multiplica cada labor por su cantidad de insumos e **infla el costo de mano de obra**.
- **IoT.** ✅ Última lectura en el listado de sensores con un único `DISTINCT ON` —era el N+1 que HU-18 señalaba—; serie agregada por hora o día en la zona horaria de la empresa; sensor dado de baja rechaza lecturas (403); rango físico por variable con tabla `lecturas_anomalas` aparte; deduplicación de alertas por sensor, tipo y ventana configurable; correo de alerta; contrato de ingesta por `codigoSensor`, con el UUID aceptado por compatibilidad.
  > ✅ **Destinatarios por finca resueltos** con la tabla `usuario_finca` ([D-012](../DECISIONS.md)), usada solo para enrutar avisos: el alcance de datos sigue siendo por empresa.
- **Vendimia.** ✅ El borrador de remito se acota a **una jornada** —antes arrastraba todo el histórico pendiente del cuartel—; `GET /remitos/:id` con cuartel, finca y detalle de pesajes; listado por estado sin `cuartelId` obligatorio; tabla de estado de cosecha por finca con rendimiento kg/ha, agregada en SQL; notificaciones al generar y al resolver un remito; unicidad de nombre de cuadrilla por finca y entre activas.
- **Inteligencia.** 🟡 Parcial. ✅ **Bucketing por zona horaria corregido — cierra F1-10**; `costo/ha` y variaciones ya estaban en Fase 1; el margen bruto ya es real con la liquidación de bodega ([D-010](../DECISIONS.md)).
  > **Pendiente:** la entidad `recomendaciones` con aplicar/descartar, el gate de 30 días con `diasFaltantes` y las reglas sobre lecturas reales. Depende de definir qué reglas agronómicas se aplican, que no está especificado.
- **Dashboard.** ✅ `SUM` en SQL —materializaba en memoria todos los `RegistroLabor` y `DetalleInsumoLabor` históricos de la empresa contra un objetivo de P95 < 3 s—; payload enriquecido con costos por finca, las 3 alertas más recientes y el conteo de registros en error de sincronización; ramas por rol y purga a 30 días ya estaban cerradas.

**Encontrado al verificar (no estaba en la auditoría original): tres bugs de fecha de la misma familia.**

Todos son el mismo error de fondo — usar UTC donde el dominio es local— y **solo se manifiestan entre las 21:00 y la medianoche** en Mendoza, que es por qué ninguna corrida anterior los había expuesto:

1. `new Date().toISOString().slice(0, 10)` se usaba en 8 lugares para calcular "hoy". A las 21:30 devuelve **mañana**: un costo cargado a esa hora quedaba vigente recién al día siguiente y las labores de esa misma jornada se rechazaban por "sin costo vigente".
2. `new Date('2026-08-24')` se parsea como medianoche **UTC**, así que convertirlo de vuelta a fecha local retrocede un día. Afectaba a las tres búsquedas de costo/tarifa vigente.
3. El helper del test de `EsFechaNoRetroactiva` tenía el mismo defecto, así que **el test pasaba por casualidad**: "ayer" a las 21:30 devolvía la fecha de hoy.

Corregido centralizando en `common/fechas/rango-fechas.ts` (`fechaLocal`, `hoyLocal`), y las comparaciones de vigencia pasaron a ser **texto contra texto** sobre columnas `date` —que no tienen hora ni huso— en vez de round-trips por `Date`. Con tests de regresión.

**F2-7 — Tests (S10).** ✅ **Cerrado.** Hay **88 tests unitarios** (guards, DTOs, alcance multi-empresa, umbrales, paginación, rangos y fechas locales, bloqueo por intentos, lote parcialmente fallido y Pearson) y un **smoke test end-to-end de 172 casos** contra la API y PostgreSQL reales.

Cubre: la escalada vía `PATCH /me`, la invalidación de token en logout, la política de contraseñas, el doble envío del mismo `local_uuid` con su 200, el límite de lote, el costo vigente a fecha vs. el costo actual, la máquina de estados del cuartel, el circuito completo de remitos, el rango físico y la ingesta por código, las bajas con dependencias y el costeo agregado.

Falta: bloqueo por intentos y su expiración, lote parcialmente fallido, y Pearson (r=1, r=−1, r=0, serie constante, n<7).

```bash
docker compose up -d
npm run migration:run && npm run seed
npm run start:prod          # en otra terminal
npm run test:smoke
```

---

## 6. Decisiones de producto pendientes

No son bugs: son definiciones que faltan y que bloquean trabajo.

| # | Decisión | Impacto |
|---|---|---|
| **D-a** | ✅ **Resuelta e implementada.** Entidad `liquidaciones_bodega` colgando del remito aprobado ([D-010](../DECISIONS.md)). El margen bruto de HU-15 y HU-31 ya es real: `ingresos − costoTotal`, y sigue devolviéndose en `null` cuando no hay liquidación cargada. | HU-15, HU-31, HU-32 |
| **D-b** | ✅ **Resuelta: criterio descopeado** ([D-016](../DECISIONS.md)). El criterio mezclaba dos conceptos —el pesaje es el total de la jornada, no un viaje— y contradecía al criterio vecino, que admite varios pesajes por cuartel y día. Si más adelante hace falta, el lugar es el **remito**, que sí representa un despacho concreto. | HU-24 |
| **D-c** | ✅ **Resuelta e implementada.** Entidad `campanias` con **rango explícito** por empresa y sin solapamientos, garantizado por un `EXCLUDE` en la base ([D-014](../DECISIONS.md)). Se eligió el rango sobre una clave `anio_agricola_inicio` porque la vendimia no termina el mismo día todos los años. Sin campaña cargada cada consumidor decide su comportamiento, y la respuesta no es la misma en todos: la baja de cuartel es conservadora, el dashboard cae al año calendario y lo informa. | HU-09, HU-31, HU-32 |
| **D-d** | ✅ **Resuelta: se corrigió la especificación, no el código** ([D-006](../DECISIONS.md)). El rol se recarga de la base en cada request, así que aplica de inmediato; que un rol revocado siguiera vigente hasta el próximo login es peor postura de seguridad que lo que pedía la HU. | HU-06 |
| **D-e** | ✅ **Resuelta: se implementó FCM completo** ([D-015](../DECISIONS.md)). Tabla `device_tokens`, alta idempotente, baja al cerrar sesión y desactivación de los tokens que FCM rechaza. Las credenciales salen de variables de entorno, nunca de un JSON en el repo. **`PUSH_TRANSPORT=log` está verificado; el envío real contra Firebase no**, porque hace falta un service account. | HU-35 |
| **D-f** | ✅ **Resuelta e implementada** ([D-013](../DECISIONS.md)). No eran dos fuentes de verdad en conflicto sino **dos ciclos distintos**: el enum `EstadoCuartel` (`pendiente`/`en_cosecha`/`cosechado`) gobierna la vendimia y lo escribe solo el sistema; el catálogo `ESTADO_CUARTEL` (Productivo / En implantación) describe el ciclo de plantación y hoy no está vinculado a ninguna columna. | HU-09, HU-10, HU-28 |
| **D-g** | ✅ **Resuelta en Fase 2: se tomó la alternativa intermedia.** `EventEmitter2` + `@nestjs/schedule`, sin Redis ni BullMQ. Cubre lo pendiente con un solo servicio de infraestructura (PostgreSQL). Se revisa cuando haga falta escalar a más de una instancia. | S6 |
| **D-h** | ✅ **Resuelta e implementada.** `empresa_id` en `catalogo_item`, `insumos` y `tipos_labor`, con unicidad por empresa ([D-011](../DECISIONS.md)). Las tablas de costos heredan el tenant por la FK. La sincronización verifica que el tipo de labor y los insumos sean de la empresa. | S1, HU-16, HU-34 |

---

## 7. Orden de trabajo

El orden que se siguió, ya ejecutado:

1. ✅ **Fase 0 completa** — era seguridad explotable, y `F0-4`/`F0-8` tocaban casi todos los módulos: cuanto más código se agregara antes, más caro salía.
2. ✅ **F2-1 (migraciones)** — sin esto nada de lo demás existía en producción.
3. ✅ **Fase 1** — correctitud de datos y dinero. `F1-8` (máquina de estados) desbloqueó HU-09, HU-10 y HU-28 de una vez.
4. ✅ **Decisiones de la sección 6** — resueltas `D-a`, `D-d`, `D-f`, `D-g` y `D-h`.
5. ✅ **F2-2 a F2-6 (cimientos)** antes de los criterios por bloque: cada uno cerró criterios en muchas HU a la vez.
6. ✅ **Criterios por bloque** y **tests** (F2-7 cerrado).
7. ✅ **Las ocho decisiones de producto** de la sección 6.

### Qué sigue

El plan de mejoras está cerrado. Lo que queda **no es deuda del backend**:

1. **Verificar el push real** (HU-35): con el service account de un proyecto de Firebase y `PUSH_TRANSPORT=fcm`. Es lo único que impide marcar HU-35 como completa.
2. ~~Endurecer el despliegue.~~ ✅ **Hecho** ([D-017](../DECISIONS.md)). Al desplegar hay que correr `npm run db:rol-app` una vez por entorno y apuntar `DB_USERNAME` al rol nuevo; `npm run db:verificar-privilegios` lo comprueba y sale con código 1 si algo falta, así que conviene dejarlo como paso del pipeline.
3. **Revisar las 6 vulnerabilidades moderadas** que arrastra `firebase-admin` en dependencias transitivas, cuando el SDK publique la corrección ([D-015](../DECISIONS.md)).
4. **Los clientes:** Web, Mobile e IoTSensor, cada uno en su repo. Ahí falta el 100%.

> Los umbrales de las reglas agronómicas (`reglas-agronomicas.ts`) están calibrados para vid en Mendoza bajo riego. Si el sistema se despliega en otra región hay que revisarlos — están juntos y comentados en un solo archivo para que esa revisión sea barata.

> Al cerrar cada ítem, actualizar el campo **Estado** de la spec de la HU correspondiente y la tabla índice de [`README.md`](README.md).
