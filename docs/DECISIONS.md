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

---

## D-014 — La campaña es una entidad con rango explícito

**Contexto:** la discrepancia `D-c`. El concepto de campaña o año agrícola no existía en el modelo y **cada indicador resolvía el corte por su cuenta**: el dashboard usaba año calendario hardcodeado, HU-31 delegaba los cuatro extremos al cliente y la baja de cuartel de HU-09 contaba todo el histórico sin acotar el período. Ya divergían entre sí.

**Decisión:** entidad `campanias` con **rango explícito** (`fecha_desde`, `fecha_hasta`) por empresa, en vez de una clave `anio_agricola_inicio` en `configuracion`.

Un mes de corte configurable es más simple, pero asume que todas las campañas duran lo mismo y empiezan el mismo día. La vendimia no funciona así: el productor cierra la campaña cuando termina de cosechar, y eso se corre semanas según el año y la variedad. Con un rango explícito, además, una campaña se puede **cerrar** antes de que su rango se agote, que es lo que evita que los indicadores sigan sumando al período viejo.

**Las campañas de una empresa no pueden solaparse**, y eso lo garantiza una restricción `EXCLUDE USING gist` en la base, no solo el servicio: dos altas concurrentes pasan las dos validaciones antes de que cualquiera inserte. Sin esa garantía «la campaña actual» sería ambigua, que es justo el problema que la entidad viene a resolver.

**Comportamiento sin campaña definida.** `getActual()` devuelve `null` y **cada consumidor decide**, porque la respuesta correcta no es la misma en todos lados:

- La **baja de cuartel** cuenta todo el histórico. Negar una baja reversible es más barato que ocultar un cuartel con registros vivos.
- El **dashboard** cae al año calendario, el comportamiento anterior, y expone `campaniaActual: null` para que la pantalla pueda avisar que el corte no está definido en vez de mostrar un número sin período.
- La **comparación** exige campaña o par de fechas: no hay default razonable para «comparar contra qué».

**Estado:** ✅ Vigente e implementado.

---

## D-015 — Push FCM con las credenciales fuera del repositorio

**Contexto:** la discrepancia `D-e`. HU-35 pide notificación push además de la in-app, y no había ni integración, ni tabla de device tokens, ni registro en login.

**Decisión:** integración real con Firebase Cloud Messaging, con el mismo patrón que ya usa `MailService`: `PUSH_TRANSPORT=log` escribe el envío en consola y `PUSH_TRANSPORT=fcm` usa el service account.

Detalles que vale la pena tener presentes:

- **Las credenciales salen de variables de entorno**, no de un `firebase-key.json` en el repo. Un service account commiteado es el accidente clásico, y da acceso al proyecto entero de Firebase.
- **El push nunca tumba la operación que lo disparó.** La notificación in-app se persiste primero y es la fuente de verdad; el envío sale después y sin `await`, para que una latencia de Firebase no se sume al tiempo de respuesta de ingerir una lectura o aprobar un remito.
- **La unicidad es del token, no del par usuario+token.** Un teléfono compartido entre dos capataces cambia de dueño, y sin esto seguiría recibiendo los avisos del anterior.
- **Un token rechazado se desactiva, no se borra**, y solo ante los dos códigos que significan «token muerto». Un fallo de red o una cuota agotada son transitorios: desactivar por eso dejaría al dispositivo sin push para siempre.

**Costo asumido:** `firebase-admin` arrastra `@google-cloud/storage` y `gaxios`, que hoy suman **6 vulnerabilidades moderadas** en dependencias transitivas que `npm audit fix` no resuelve sin `--force`. Se acepta a sabiendas por ser una dependencia de servidor sin exposición directa, y queda anotado para revisar cuando el SDK publique la corrección.

**Verificación (2026-08-25):** ✅ **verificada contra Firebase real.** `npm run push:diagnostico` confirma que el proyecto acepta el service account.

El diagnóstico **intenta el envío en vez de leer la configuración**, con el mismo criterio que `db:verificar-privilegios`. Sin un token de dispositivo manda contra uno inválido a propósito, porque lo que se quiere distinguir es *credenciales rechazadas* de *token rechazado*: **si Firebase llegó a mirar el token, ya autenticó la petición**. Con credenciales malas el error aparece antes. Esa distinción es todo lo que se puede saber mientras no exista la app móvil, y es exactamente lo que hacía falta saber.

La resolución de credenciales vive en `credenciales-firebase.ts` y la comparten `PushService` y el diagnóstico. Si cada uno leyera las variables por su cuenta, el diagnóstico podría dar verde sobre una configuración que la aplicación no acepta — la peor clase de herramienta de verificación.

El camino que no se puede ejercitar en vivo —credenciales buenas y token rechazado— está cubierto por tests sobre la interpretación del error, con los códigos que devuelve Firebase en cada caso.

**Un bug que solo apareció al enviar de verdad.** La desactivación de tokens muertos miraba `registration-token-not-registered` e `invalid-registration-token`, pero para un token mal formado **FCM devuelve `messaging/invalid-argument`**. Esos tokens nunca se apagaban: se acumulaban en la base y cada notificación gastaba una llamada por dispositivo fantasma. En modo `log` no hay respuesta que interpretar, así que era invisible hasta la primera verificación real.

El arreglo no podía ser agregar el código a la lista: `invalid-argument` **también** aparece cuando el payload está mal armado, y desactivar ahí apagaría todos los dispositivos válidos de la base por un bug de una línea. El criterio quedó en `token-rechazado.ts`, que exige que el mensaje del error apunte al token, con tests para los dos sentidos del error.

**Estado:** ✅ Vigente, implementado y verificado contra Firebase real. La entrega a un teléfono depende de que Mobile registre su token.

---

## D-016 — El maestro de transportes queda fuera de alcance

**Contexto:** la discrepancia `D-b`. HU-24 pide validar que el peso sea «menor o igual al límite máximo físico configurado en el maestro de transportes», un maestro que no existe en el modelo.

**Decisión:** se **descopea el criterio** y se documenta el porqué, en vez de crear la entidad.

El criterio mezcla dos conceptos. El pesaje de HU-24 es *el total de kilos cosechados por una cuadrilla al cierre del día* —la HU lo dice textualmente, y admite varios pesajes por cuartel y día—, mientras que la capacidad de un transporte acota *un viaje*. Una jornada que se despacha en dos camiones daría un falso error, y el propio criterio de «múltiples pesajes por cuartel en el mismo día» lo contradice.

Lo que sí protege el dato ya está: el CHECK `kg_totales > 0` en la base (F2-1) y el rechazo de pesajes sobre cuarteles ya cosechados (F1-8).

**Si más adelante se necesita**, el lugar correcto es el **remito** (HU-26/27), que sí representa un despacho concreto a la bodega y donde una patente y una capacidad tienen sentido.

**Estado:** ✅ Vigente. Criterio descopeado de HU-24.

---

## D-017 — La aplicación y las migraciones usan roles distintos

**Contexto:** la API se conectaba con el superusuario `postgres`. Eso tiene dos consecuencias que no se ven hasta que importan:

1. Una inyección SQL en cualquier endpoint hereda permiso para `DROP TABLE`, no solo para leer datos que no le tocan.
2. **Vuelve decorativo el `REVOKE` que protege el log de auditoría**, porque los superusuarios ignoran los privilegios. Por eso la inmutabilidad de HU-07 se resolvió con un trigger —que sí aplica a un superusuario— y no solo con `GRANT`/`REVOKE`.

**Decisión:** dos roles con propósitos separados.

| Rol | Para qué | Puede |
|---|---|---|
| `DB_MIGRATION_USERNAME` | Correr migraciones | DDL: crear y alterar tablas, índices, triggers |
| `DB_USERNAME` (`terravid_app`) | La aplicación | DML: `SELECT`/`INSERT`/`UPDATE`/`DELETE` y usar secuencias |

El rol de aplicación **no** puede crear ni borrar tablas, no puede tocar la tabla `migrations`, y sobre `log_auditoria` solo puede leer e insertar.

**Las variables de migración caen a las de la aplicación cuando no están definidas.** En desarrollo, con un solo `postgres`, no hay nada que configurar y todo sigue funcionando igual; la separación es una decisión de despliegue, no una fricción diaria.

**Por qué un script y no una migración.** Una migración es DDL versionado del esquema; crear un rol con contraseña es configuración del entorno, y una contraseña no puede vivir en el repositorio. `npm run db:rol-app` la toma de `DB_APP_PASSWORD` y falla si no está: no hay valor por defecto, porque una contraseña conocida no es una contraseña.

**La verificación intenta las operaciones en vez de leer los privilegios.** `npm run db:verificar-privilegios` se conecta con las credenciales reales de la API e intenta modificar el log, crear una tabla y leer `migrations`, revirtiendo todo. Inspeccionar `information_schema` diría lo que *debería* pasar; esto dice lo que pasa. Sale con código 1 si algo no cumple, para encadenarlo en el despliegue.

**Defensa en profundidad, no reemplazo.** El trigger y el `REVOKE` cubren cosas distintas: el trigger protege incluso si alguien se conecta como superusuario, y el privilegio protege si alguien deshabilita el trigger. Las dos capas se quedan.

**Verificación:** con la API conectada como `terravid_app`, el smoke test completo pasa **172/172** — la restricción no le saca nada que necesite.

**Estado:** ✅ Vigente e implementado.

---

## D-018 — Producción en Cloud Run, no en un VPS con Nginx y PM2

**Contexto:** [`ARCHITECTURE.md` §3.3](ARCHITECTURE.md) especifica para producción un **VPS Linux** con **Nginx** para terminación TLS y proxy reverso, el proceso Node administrado por **PM2**, y una instancia de **Redis** para las colas de BullMQ. Ese diseño precede a dos cosas que ya son ciertas en el código: las colas nunca se implementaron con BullMQ sino con `EventEmitterModule` in-process ([D-g](specs/PLAN-MEJORAS.md), decisión ya tomada para evitar la dependencia de Redis), y las tareas programadas corren con `@nestjs/schedule` dentro del mismo proceso.

**Decisión:** producción se despliega en **Cloud Run + Cloud SQL**, documentado en [`DESPLIEGUE.md`](DESPLIEGUE.md). El VPS queda descartado: sin Redis y sin BullMQ, la mitad de lo que justificaba administrar un servidor propio ya no existe, y lo que queda —terminación TLS, supervisión del proceso, backups de la base— son exactamente las cosas que los servicios administrados hacen sin trabajo del equipo. Nginx, PM2 y Redis salen del alcance de producción.

**Consecuencia: la configuración no es la del manual.** Cloud Run apaga las instancias sin tráfico y le corta la CPU al contenedor entre requests, y las dos decisiones in-process de arriba asumen un proceso vivo. El deploy va con `--no-cpu-throttling` (los handlers de `EventEmitterModule` corren después de que la respuesta salió, y con CPU asignada solo durante el request quedarían congelados hasta el request siguiente) y con `--min-instances=1 --max-instances=1` (con más de una instancia, cada una ejecuta su propia copia del cron). Es el costo, en dólares por mes, de haber elegido el in-process: una instancia siempre encendida.

**Migraciones desde fuera del contenedor.** La imagen de producción solo lleva `dist/`, y el DataSource de la CLI apunta a `src/**/*.entity.ts` vía `ts-node`: `migration:run` no puede correr desde el contenedor desplegado. Se corre desde una máquina de desarrollo por el Cloud SQL Auth Proxy, lo que además **refuerza** [D-017](#d-017--la-aplicación-y-las-migraciones-usan-roles-distintos): las credenciales con permiso de DDL nunca llegan a Cloud Run.

**PostGIS sale de los requisitos de producción.** El `docker-compose.yml` de desarrollo usa la imagen `postgis/postgis`, pero el centroide de los cuarteles son dos columnas `decimal(10,7)` y la única extensión que piden las migraciones es `btree_gist`. Una instancia PostgreSQL común alcanza; si más adelante hacen falta consultas espaciales, Cloud SQL habilita PostGIS con un `CREATE EXTENSION`.

**Verificación:** la imagen del [`Dockerfile`](../Dockerfile) se construyó y se corrió contra la base local: arranca, conecta y `GET /api` responde 401 —el `JwtAuthGuard` global activo y la ruta raíz no pública, que es el comportamiento esperado—.

**Estado:** ✅ Vigente. Pendiente la primera corrida real del runbook.

---

## D-019 — La VM busca la imagen; el CI no empuja el despliegue

**Contexto:** cada despliegue a la VM eran unas quince operaciones a mano —publicar la imagen, editar `API_IMAGE`, `pull`, `up -d`, y si había migraciones abrir un túnel SSH desde una máquina de desarrollo y correrlas desde un checkout con devDependencies instaladas—. Un proceso así no se ejecuta igual dos veces, y el paso que más fácil se olvida es `db:rol-app`, cuya omisión deja a la API sin permiso para leer las tablas que la migración acaba de crear.

**Decisión:** entrega continua en dos mitades que no se conocen entre sí. GitHub Actions verifica, construye y publica la imagen con dos etiquetas (`main`, móvil; el SHA corto, inmutable). La VM, con un timer de systemd cada dos minutos, busca `main` y si cambió despliega: trae el repositorio, migra, reaplica privilegios, levanta y verifica que la API responda antes de dar el despliegue por bueno.

**Por qué el CI no empuja.** Migrar necesita la contraseña del superusuario de Postgres, que vive únicamente en el `.env` de la VM —mantenerla fuera del alcance de la aplicación es todo el punto de [D-017](#d-017--la-aplicación-y-las-migraciones-usan-roles-distintos)—. Un pipeline que empujara tendría que conocerla, o tendría que entrar por SSH a leerla, con lo cual la lógica de despliegue termina en la VM igual. Con el modelo de tirón, la cuenta de servicio de GitHub no tiene más permiso que escribir en el repositorio de imágenes: no alcanza la VM, ni la base, ni ningún otro recurso, y el 22 no se abre a internet. Se paga con latencia: el despliegue tarda lo que falte para el próximo tic.

**Esto deroga el párrafo de migraciones de [D-018](#d-018--producción-en-cloud-run-no-en-un-vps-con-nginx-y-pm2).** Ahí decía que `migration:run` no podía correr desde el contenedor desplegado porque el DataSource de la CLI apuntaba a `src/**/*.entity.ts` vía `ts-node`. Ya no: los globs se derivan de `__dirname` y la extensión de si el archivo en ejecución termina en `.ts` o `.js`, así que el mismo archivo sirve compilado, y `typeorm` ya era dependencia de runtime. `dotenv` pasó a serlo también —cuatro archivos de `src/` lo importan y los cuatro terminan en `dist/`, donde era código muerto que explotaba al primer intento de usarlo—.

**D-017 se mantiene**, y conviene ser preciso sobre cómo. El contenedor que atiende requests sigue conociendo solo a `terravid_app`. Las credenciales de DDL van a un contenedor aparte y efímero, creado para migrar y borrado al terminar, y no salen de la máquina donde ya viven. Lo que la aplicación y la migración comparten es la imagen, no el entorno.

**Verificación por salida real, no por configuración.** El despliegue no se da por bueno porque los comandos devolvieran cero: se entra por Caddy con el nombre real resuelto a loopback y se espera un 401 de `/api`, que es la señal de que Nest levantó y el guard global está activo. Si en 90 segundos no responde, vuelve a la imagen anterior y anota el digest que falló para no reintentarlo cada dos minutos —sin eso, una versión rota en `main` dejaría a producción oscilando entre arrancar y morir—. **Las migraciones no se revierten:** el rollback restituye el código, no el esquema.

**Autenticación sin claves.** GitHub firma un token OIDC y Google lo canjea por credenciales de minutos (Workload Identity Federation), acotado por `attribute-condition` a la organización y por `principalSet` a este repositorio. No hay ningún JSON de cuenta de servicio guardado como secreto. En la VM, el `docker login` contra Artifact Registry sale del servidor de metadatos y no del helper de gcloud: depender de que alguien haya corrido `gcloud auth configure-docker`, y como qué usuario, hace que el despliegue se rompa según cómo se instaló la máquina.

**Consecuencia operativa:** `/opt/backend` pasa a ser de `root`. Lo administra el despliegue y no una persona, y así se evita el «dubious ownership» de git —bajo `sudo` git compara contra `SUDO_UID` y no se queja, pero systemd no define esa variable—. También hay que poner una política de limpieza en Artifact Registry: el nivel gratuito son 0,5 GB y una imagen por merge los llena.

**Verificación:** corrido de punta a punta contra producción. El script autenticó contra el registro, bajó `:main`, aplicó migraciones **desde el contenedor** (`No migrations are pending`, las cuatro ya estaban), reaplicó los privilegios del rol acotado, recreó la API y verificó con un 401. Desde afuera, `GET /api` → 401 y `http://` → 308. Una segunda corrida informó `sin cambios` sin tocar nada.

**Estado:** ✅ Vigente. Pendiente que el timer dispare por su cuenta y el primer merge que atraviese el pipeline completo.

---

## D-020 — Las preferencias de presentación salen de la configuración del sistema

**Contexto:** `moneda`, `unidades` y `zona_horaria` deciden cómo la interfaz formatea importes, cantidades y fechas en **todas** las pantallas, y `nombre_organizacion` es el rótulo de la empresa. Los cuatro viven en la tabla `configuracion`, cuyo único lector era `GET /configuracion`, restringido al Propietario por [HU-33](specs/HU-33-configuracion-general-sistema.md). La consecuencia la encontró el Web al implementar su contexto de formato ([W-004](https://github.com/TerraVidMza/Web/blob/develop/docs/DECISIONS.md)): un Capataz, un Agrónomo o un Auditor veían los importes con el formato por defecto del navegador, no con el que configuró su empresa.

**Decisión:** se agrega `GET /configuracion/preferencias`, con `@AnyRole()`, que devuelve únicamente las claves de `CLAVES_PREFERENCIAS` —las cuatro de arriba—. `GET /configuracion`, `GET /configuracion/:clave` y `PUT /configuracion` siguen siendo del Propietario, sin cambios.

**Por qué no alcanzaba con abrir `GET /configuracion`.** Ese endpoint enmascara `smtp_pass` y nada más: `smtp_host`, `smtp_port`, `smtp_user` y `smtp_from` viajan en claro. Dárselo a todos los roles repartiría media credencial de correo saliente a cualquier usuario autenticado. La lista blanca invierte el riesgo: agregar una clave nueva a la tabla es privado por omisión, y hace falta un cambio deliberado para publicarla. Un test fija el invariante —ninguna clave de `CLAVES_PREFERENCIAS` puede ser secreta ni empezar con `smtp_`— porque el error que importa es que la lista crezca sin que nadie lo note.

**Qué deja de ser cierto de HU-33.** El criterio «el Propietario es el único con acceso a `/configuracion`» sigue valiendo para la pantalla de configuración y para todo lo que se puede escribir. Deja de valer, literalmente, para el prefijo de la ruta: hay un `GET` colgando de él que lee cualquier rol. La ruta se declara **antes** de `:clave`, que si no la capturaría.

**Estado:** ✅ Vigente.

---

## D-021 — El Auditor lee fincas y cuarteles; los costos se filtran del payload

**Contexto:** [HU-17](specs/HU-17-historial-labores-cuartel.md) le concede al Auditor el historial de operaciones **por cuartel**, y `GET /registro-labor/cuartel/:cuartelId` lo incluía en sus `@Roles`. Pero los listados de fincas ([HU-08](specs/HU-08-abm-fincas.md)) y de cuarteles ([HU-09](specs/HU-09-abm-cuarteles-finca.md), [HU-11](specs/HU-11-busqueda-fincas-cuarteles.md)) lo excluían a propósito, con un comentario que decía que su alcance se acotaba «al log de auditoría y al historial de operaciones por cuartel». El comentario se contradecía a sí mismo: sin listado no hay `cuartelId`, y su única historia de negocio era inalcanzable salvo pegando un UUID a mano. Es [W-011](https://github.com/TerraVidMza/Web/blob/develop/docs/DECISIONS.md) del plan de adaptación del Web.

**Decisión, primera mitad:** las lecturas de fincas y cuarteles —listar, ver una, buscar y las variedades del filtro— suman `RolNombre.AUDITOR`. Ninguna de las dos entidades lleva dato económico: nombre, ubicación, hectáreas, variedad, sistema de conducción, estado y coordenadas. Crear, editar y dar de baja siguen cerrados para él, y eso ahora está cubierto por tests que leen los `@Roles` de cada handler.

**Decisión, segunda mitad:** el historial deja de devolverle el costo. `GET /registro-labor/costeo` y `GET /registro-labor/cuartel/:id/margen-bruto` ya lo excluían por `@Roles`, rotulados en el código como «dato económico», y [HU-15](specs/HU-15-consulta-margen-bruto.md) los declara de Propietario o Agrónomo. Pero el historial traía `costoUnitarioAlSync` en la labor **y en cada insumo**, de donde el costo total del cuartel se reconstruye a mano: el dato que dos endpoints le cerraban salía por un tercero. Ahora, cuando el que pregunta es Auditor, esos dos campos viajan en `null`.

**Por qué filtrar el payload y no cerrar el endpoint.** El historial es lo que HU-17 le concede; lo que sobra es una columna, no el recurso. Y el filtro va en el servicio, no en la interfaz: ocultar la columna en la pantalla sería cosmético, el número seguiría estando en la respuesta.

**Lo que esto interpreta.** HU-17 dice que el Auditor «puede ver todos los registros con los mismos filtros disponibles que el Propietario/Agrónomo». La frase habla de **qué filas** ve, no de qué columnas, y HU-15 le niega el alcance económico; se resolvió a favor de la lectura consistente con los otros tres endpoints. Si la intención del producto era la contraria —que el Auditor audite también el costo—, se revierte cambiando el cuerpo de `sinAlcanceEconomico` en `registro-labor.controller.ts` y el test que lo fija.

**Estado:** ✅ Vigente.

---

## D-022 — El backend se queda en NestJS 11 hasta que el ecosistema acompañe

**Contexto:** Dependabot propuso el salto a **NestJS 12** y a **TypeScript 7**, y los dos PR se mergearon sin que el CI estuviera en verde —los *required checks* todavía no están configurados en el repositorio—. El resultado fue que `npm ci` dejó de resolver el árbol de dependencias y **todas** las corridas del workflow pasaron a fallar antes de compilar nada, incluidas las de `main`.

Al revisarlo aparecieron dos bloqueos que no dependen de este código:

- **`@nestjs/throttler` no soporta Nest 12.** Su última versión (6.5.0, publicada en diciembre de 2025) declara `peer @nestjs/common: ^7 || ^8 || ^9 || ^10 || ^11`, y no hay `next` ni prerelease. No es un paquete accesorio: es el `ThrottlerGuard` global, y es lo que sostiene los límites de intentos de [HU-01](specs/HU-01-iniciar-sesion.md) y el tope de 3 solicitudes por hora de [HU-03](specs/HU-03-recuperar-contrasena.md). Instalarlo igual exige `--legacy-peer-deps`, que es pedirle a npm que ignore una incompatibilidad declarada por el autor.
- **TypeScript 7 no es instalable con la toolchain de tests y lint.** `ts-jest` declara `typescript >=4.3 <7` y `typescript-eslint` `>=4.8.4 <6.1.0`. Son dos bloqueos independientes, así que no alcanza con esperar a uno.

**Decisión:** volver a **NestJS 11** y a **TypeScript 5.9**, y dejar las versiones mayores de `@nestjs/*`, `typescript` y `typeorm` fuera del alcance de Dependabot (`ignore` con `version-update:semver-major` en [`.github/dependabot.yml`](../.github/dependabot.yml)). Se conservan **ESLint 10** —`typescript-eslint@8.70` lo soporta explícitamente— y el resto de las actualizaciones menores.

Una versión mayor de framework o de toolchain no es una actualización de rutina: hay que mirar si los paquetes acoplados por *peer dependencies* la acompañan. Eso se decide y se prueba; no se mergea porque un bot lo propuso.

**Qué falló de la configuración anterior de Dependabot.** El grupo de desarrollo tenía `dependency-type: development` con patrón `*`, y se llevó `@nestjs/testing`, `@nestjs/cli` y `@nestjs/schematics` a un PR distinto del resto de `@nestjs/*`. Los de producción subieron a 12 y los de desarrollo quedaron en 11: **ningún PR era consistente por sí solo**, así que ninguno podía pasar el CI ni siquiera en teoría. El grupo `nestjs` ahora no declara `dependency-type` —para que los tres viajen con el framework— y el grupo de desarrollo los excluye explícitamente.

**Cuándo se revisa.** Cuando `@nestjs/throttler` publique una versión con peer `^12`. Si esa versión tardara mucho, la alternativa es reemplazar el rate limiting por una implementación propia, que es trabajo real y hay que decidirlo aparte: hoy son cuatro líneas de configuración y un decorador por endpoint.

**Estado:** ✅ Vigente.

---

## D-023 — Sesiones con refresh token rotativo y duración configurable por empresa

**Contexto:** el access token duraba 8 horas y no había forma de renovarlo:
al vencer, el usuario perdía la sesión a mitad del trabajo, y un token robado
servía las 8 horas completas (la lista de revocación de HU-02 solo cubre el
logout). `.env.example` declaraba `JWT_REFRESH_SECRET` y
`JWT_REFRESH_EXPIRES_IN`, pero ningún código los usaba. El product owner pidió
implementar el refresh token y que la duración de las sesiones sea
configurable.

**Decisión:**

- **Access token corto** (JWT, 15 minutos por defecto) y **refresh token
  opaco** (256 bits aleatorios, 7 días por defecto). El refresh no es un JWT:
  no lleva datos, no necesita secreto propio y se guarda en la tabla
  `refresh_token` como SHA-256. Una copia de la tabla no sirve para abrir
  sesiones. Con esa entropía alcanza un hash rápido; bcrypt haría lenta una
  consulta que se resuelve por índice único.
- **Rotación en cada uso** (`POST /api/auth/refresh`, pública, con límite de
  30 requests por minuto por IP). El token presentado se revoca y se entrega
  uno nuevo de la misma **familia** (la sesión), junto con un access token
  nuevo. El rol y el estado del usuario se releen de la base: un usuario
  desactivado no renueva.
- **Detección de reuso.** Si aparece un token ya rotado, alguien más tiene una
  copia: se revoca la familia completa. Hay una **gracia de 30 segundos** para
  los tokens recién rotados, porque dos pestañas de la Web (o un reintento de
  red del móvil) pueden renovar con el mismo token casi a la vez; la segunda
  recibe 401 sin castigar a la sesión, y toma el token nuevo del almacenamiento
  compartido. La revocación es condicional (`WHERE revocado_at IS NULL`), así
  que dos consumos simultáneos no pueden emitir dos sucesores.
- **El access token lleva la familia** (claim `fam`). Así el logout corta el
  refresh token sin pedirle nada más al cliente. Cambiar la contraseña revoca
  las demás sesiones del usuario y conserva la actual; restablecerla por mail
  las revoca todas, porque puede ser la recuperación de una cuenta
  comprometida.
- **Duraciones por empresa** en `configuracion`:
  `sesion_access_minutos` (5 a 60, por defecto 15) y `sesion_refresh_dias`
  (1 a 30, por defecto 7). El máximo de 30 días contempla a un capataz que pasa
  varios días en campo sin señal. `PUT /configuracion` rechaza valores fuera de
  rango; un valor inválido cargado a mano en la base se ignora y se usa el
  valor por defecto, para que una configuración rota no deje a una empresa
  entera sin poder entrar.
- La respuesta del login y del refresh es
  `{ accessToken, expiresIn, refreshToken, refreshExpiresAt, user }`.
  `expiresIn` está en segundos: el cliente renueva antes de que venza.
- El cron de las 3 AM purga los refresh tokens vencidos junto con las
  revocaciones.
- Se eliminan `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET` y
  `JWT_REFRESH_EXPIRES_IN` de los `.env` de ejemplo y del CI.

**Consecuencias:**

- Los clientes (Web y Mobile) guardan el refresh token y renuevan con un único
  request en vuelo; ante un 401 en `/auth/refresh` cierran la sesión local.
- Los tokens emitidos antes de esta versión no tienen `fam` ni refresh token:
  siguen sirviendo hasta su vencimiento y después piden login.
- Es estado nuevo en la base, en el camino de cada renovación (no de cada
  request: el access token se sigue validando como antes).
- Pruebas: `test/autenticacion.e2e-spec.ts` (rotación, reuso dentro y fuera de
  la gracia, vencimiento, usuario inactivo, logout, cambio y reseteo de
  contraseña, duraciones de la empresa), `duraciones-sesion.spec.ts` y el smoke
  test.

**Estado:** ✅ Vigente.

---

## D-024 — Los permisos se definen en el backend y viajan con la sesión

**Contexto:** la Web tenía su propia tabla de qué rol ve cada sección
(`src/auth/permisos.ts`), copiada a mano de los `@Roles` de cada controller, y
ya se había desfasado: seguía diciendo que el Auditor no ve fincas cuando D-021
se lo habilitó. La app móvil no restringía nada: cualquier rol podía entrar,
aunque solo sirve para registrar labores y pesajes. El product owner pidió que
la app móvil sea para quien tenga permiso de hacer lo que la app permite, y que
se maneje como permiso.

**Decisión:**

- `src/common/permisos/permisos.ts` es la **única** tabla de permisos:
  capacidades con nombre (`fincas`, `laboresRegistro`, `vendimiaAprobacion`,
  …) y los roles que las tienen. La tabla es fija por rol; no se edita desde
  la aplicación.
- La lista de permisos del usuario viaja en `user.permisos` del login y de la
  renovación de sesión, y en `GET /usuarios/me`. Los clientes deciden con ella
  qué mostrar y dejan de tener tablas propias.
- **La autoridad sigue siendo el `RolesGuard`** con los `@Roles` de cada
  handler. `permisos.spec.ts` asocia cada permiso con los handlers que cubre y
  verifica que acepten **exactamente** los mismos roles. Si alguien cambia un
  `@Roles` sin tocar la tabla, o al revés, el test falla. Hoy cubre 105
  handlers.
- **`appMovil`** es la unión de `laboresRegistro` y `pesajesRegistro`
  (Propietario, Agrónomo y Capataz). `POST /auth/login` acepta
  `cliente: 'web' | 'movil'`; con `movil` y sin ese permiso responde **403**. Se
  valida después de la contraseña, igual que la cuenta desactivada, para no
  revelar nada a quien no tiene credenciales. La app también lo valida del
  lado del cliente.

**Por qué no se reemplazaron los `@Roles` por un decorador de permisos:** son
114 handlers y la entrega es en dos semanas. El test de consistencia da la
misma garantía (tabla y guard no pueden divergir) sin tocar cada controller.
Migrar a `@Permiso('x')` queda como mejora.

**Estado:** ✅ Vigente.

---

## D-025 — Administrador de plataforma y alta de empresas

**Contexto:** el sistema es multi-empresa (todas las consultas filtran por
`empresa_id`), pero solo existía la empresa que crea el seed: no había forma de
dar de alta un cliente nuevo por la API. El product owner pidió poder crear más
empresas.

**Decisión:**

- **Rol nuevo, `Administrador`**, de plataforma. Pertenece a una empresa
  especial (`empresas.es_plataforma = true`, a lo sumo una, la crea el seed)
  que no es un cliente, no tiene datos y no aparece en los listados.
- **`/api/empresas`**, solo para el Administrador:
  - `GET` lista las empresas cliente con sus usuarios activos.
  - `POST { nombre, cuit, propietario: { nombre, email } }` crea la empresa,
    sus catálogos por defecto (los mismos del seed, ahora en
    `catalogos-por-defecto.ts`) y el primer Propietario con contraseña
    temporal y correo de bienvenida. El Administrador nunca conoce esa
    contraseña. Si el alta del Propietario falla, la empresa se revierte.
  - `PATCH /:id`, `PATCH /:id/desactivar` y `PATCH /:id/activar`.
- **Una empresa desactivada** no puede iniciar sesión ni renovarla, y la
  estrategia JWT rechaza sus access tokens vigentes en la request siguiente.
- **El Administrador no ve datos de empresas.** `@AnyRole()` pasa a significar
  "cualquier rol de empresa". Los únicos handlers que lo admiten lo declaran
  con `@AnyRole({ incluyeAdministrador: true })`: su perfil, el cambio de
  contraseña y el logout. Todo lo demás le responde 403. Sus permisos (D-024)
  son `perfil` y `empresas`, y no entra a la app móvil.
- **Un Propietario no puede crear administradores.** `GET /roles` devuelve solo
  los roles de empresa, y el alta y la edición de usuarios rechazan el rol
  `Administrador`. El alta antes no validaba el rol: aceptaba cualquier
  `rolId`.
- Credenciales: fuera de producción el seed crea `admin@terravid.demo` con la
  contraseña de demostración. En producción, solo si se definen
  `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`, con las mismas reglas que el
  Propietario (no puede ser la de demostración y entra obligado a cambiarla).
- El rol se inserta en la migración `EmpresasYAdministrador` y no solo en el
  seed, porque una instancia ya sembrada no vuelve a correrlo.

**Pruebas:** `test/empresas.e2e-spec.ts`, los permisos en `permisos.spec.ts`,
el bloqueo del rol en `usuarios.service.spec.ts` y siete controles HTTP en el
smoke (403 del dashboard, `/empresas` solo para el Administrador, roles
asignables, login móvil).

**Estado:** ✅ Vigente.
