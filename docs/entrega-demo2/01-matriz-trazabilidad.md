# Matriz de trazabilidad consolidada con estado de codificación

**Proyecto:** TerraVid — Proyecto Final, UTN FRM (Etapa 6)
**Integrantes:** Paula Alvarado y Sergio Farias
**Fecha de corte:** 13/10/2026

## Introducción

Esta matriz vincula cada historia de usuario (HU-01 a HU-36) con su módulo, funcionalidad, entidad principal, pantalla y estado de codificación. Los datos salen de dos fuentes:

- **Especificaciones de las historias** (`docs/specs/HU-xx-*.md` del repositorio Backend). De ahí se toman el actor, el área, la entidad principal y la pantalla de Figma (PAN-xx).
- **Código de los cuatro repositorios** (Backend NestJS, Web React, Mobile Expo e IoTSensor). Se revisaron el módulo en `src/modules`, la pantalla real y los tests automatizados.

**Criterio de estado.** El estado no se copia del campo *Estado* de la spec: sale de revisar el código.

| Estado | Criterio |
|---|---|
| **Probado** | Existe el código y lo cubre al menos un test automatizado: unitario (`*.spec.ts`), de integración (`test/*.e2e-spec.ts`), de componente Web (`*.test.tsx`), E2E Web (Playwright, `e2e/`), unitario Mobile (`*.test.ts`) o E2E Mobile (Maestro, `.maestro/`). |
| **Codificado** | Existe el código, pero ningún test lo cubre específicamente. |
| **En desarrollo** | La implementación es parcial. |
| **No iniciado** | No hay código. |

**Convenciones de la tabla.**
- *Pantalla*: primero va el frame de Figma; después, la ruta Web (`/ruta`) o la pantalla Mobile (archivo de `src/app`). Cuando la spec no asigna un frame se indica "s/PAN".
- *Evidencia*: rutas relativas a cada repositorio. **B:** Backend, **W:** Web, **M:** Mobile. Los tests de integración del backend están en `test/`. Los archivos de Web están en `src/features/` salvo que se indique otra carpeta.

## Matriz

| Módulo | Funcionalidad | HU | Entidad | Pantalla | Estado de codificación | Evidencia (archivo de test o módulo) |
|---|---|---|---|---|---|---|
| Transversales | Autenticación | HU-01 Iniciar sesión | USUARIO | PAN-01 Login · W `/login` · M `(auth)/login` | Probado | B `autenticacion.e2e-spec.ts`, `auth.service.spec.ts`, `bloqueo-intentos.spec.ts` · W `auth/login-page.test.tsx` · M `.maestro/01-login.yaml` |
| Transversales | Autenticación | HU-02 Cerrar sesión | USUARIO | PAN-02 Menú lateral · W menú de `AppLayout` · M `(tabs)/index` | Probado | B `autenticacion.e2e-spec.ts` (logout) · W `src/auth/sesion.test.ts` · M `auth.store.test.ts` |
| Transversales | Autenticación | HU-03 Recuperar contraseña | TOKEN_RECUPERACION, USUARIO | PAN-03 Olvidé mi contraseña · W `/olvide-mi-password`, `/reset-password` · M `(auth)/forgot-password` | Probado | B `autenticacion.e2e-spec.ts` (recuperación) |
| Transversales | Usuarios | HU-04 Datos personales y contraseña | USUARIO | s/PAN · W `/perfil`, `/cambiar-password` · M `cambiar-password` | Probado | B `autenticacion.e2e-spec.ts`, `update-perfil.dto.spec.ts`, `recorrido-api.e2e-spec.ts` |
| Transversales | Usuarios | HU-05 ABM usuarios | USUARIO | PAN-04 Control de usuarios · W `/usuarios` | Probado | B `usuarios.service.spec.ts`, `recorrido-api.e2e-spec.ts` · W `usuarios/usuarios-page.test.tsx`, `crear-usuario-dialog.test.tsx` |
| Transversales | Roles | HU-06 Modificar rol | USUARIO, ROL | PAN-04 Control de usuarios · W `/usuarios` (diálogo de edición) | Probado | B `recorrido-api.e2e-spec.ts`, `roles.guard.spec.ts` · W `usuarios/editar-usuario-dialog.test.tsx` |
| Transversales | Auditoría | HU-07 Logs de auditoría | LOG_AUDITORIA | PAN-06 Visor de logs · W `/auditoria` | Probado | B `log-auditoria.service.spec.ts` · W `auditoria/auditoria-page.test.tsx`, Playwright `caminos-por-rol.spec.ts` (Auditor) |
| Transversales | Configuración | HU-33 Configuración general | CONFIGURACION | PAN-16 Parámetros del sistema · W `/configuracion` | Probado | B `preferencias.spec.ts`, `duraciones-sesion.spec.ts` · W `configuracion/parametros-page.test.tsx` |
| Transversales | Tablas maestras | HU-34 Tablas maestras | CATALOGO_ITEM | s/PAN · W `/configuracion/catalogos` | Probado | B `recorrido-api.e2e-spec.ts` (catálogos) · W `configuracion/tablas-maestras-page.test.tsx` |
| Transversales | Notificaciones | HU-35 Gestión de notificaciones | NOTIFICACION | s/PAN · W `/notificaciones` y campana · M `(tabs)/notificaciones` | Probado | B `recorrido-api.e2e-spec.ts`, `diagnostico-push.spec.ts` · W `notificaciones/campana-notificaciones.test.tsx` · M `notificaciones.service.test.ts` |
| Transversales | Ayuda | HU-36 Centro de ayuda | ARTICULO_AYUDA, TICKET_SOPORTE | s/PAN · W `/ayuda`, `/ayuda/soporte` | Probado | W `ayuda/ayuda.test.tsx` · B módulo `ayuda` |
| Funcionales | Fincas | HU-08 ABM fincas | FINCA | PAN-07 ABM fincas · W `/fincas` | Probado | B `fincas.service.spec.ts` · W `fincas/fincas-page.test.tsx`, `finca-dialog.test.tsx`, Playwright `caminos-por-rol.spec.ts` |
| Funcionales | Cuarteles | HU-09 ABM cuarteles | CUARTEL | PAN-08 Gestión de cuarteles · W `/fincas/:fincaId/cuarteles` | Probado | B `cuarteles.service.spec.ts` · W `cuarteles/cuartel-dialog.test.tsx`, Playwright `caminos-por-rol.spec.ts` |
| Funcionales | Cuarteles | HU-10 Cuarteles en mapa | CUARTEL, FINCA | PAN-14 Mapa satelital · W `/mapa` | Probado | W `mapa/mapa-page.test.tsx` · B módulos `fincas`, `cuarteles` |
| Funcionales | Fincas y cuarteles | HU-11 Búsqueda de fincas y cuarteles | FINCA, CUARTEL | PAN-14 Mapa satelital · W `/cuarteles`, `/fincas` | Probado | B `cuarteles.service.spec.ts` (buscar) · W `cuarteles/buscar-cuarteles-page.test.tsx` |
| Funcionales | Labores | HU-12 Registrar labor | PARTE_LABOR (`registro_labor`) | PAN-09 Carga de labores · M `(tabs)/labores/nueva` | Probado | M `sync-labores.test.ts`, `.maestro/02-registrar-labor.yaml` · B módulo `registro-labor` |
| Funcionales | Insumos | HU-13 Registrar uso de insumos | DETALLE_INSUMO_LABOR, CATALOGO_ITEM | PAN-10 Selección de insumos · M `InsumoSelector` en `labores/nueva` | Probado | M `InsumoSelector.test.tsx`, `.maestro/02-registrar-labor.yaml` |
| Funcionales | Sincronización | HU-14 Sincronización offline | PARTE_LABOR, SINOPSIS_PROCESO | PAN-05 Estado de conexión · M `OfflineBanner`, `SyncStatusBar` | Probado | M `sync-engine.test.ts`, `offline-lifecycle.integration.test.ts`, `.maestro/04-offline-sync.yaml` · B `lote-parcial.spec.ts`, `liquidacion-vendimia.e2e-spec.ts` |
| Funcionales | Labores e insumos | HU-16 ABM tipos de labor e insumos | CATALOGO_ITEM | PAN-16 Parámetros · W `/operaciones/insumos`, `/operaciones/tipos-labor` | Probado | B `tipo-labor.service.spec.ts`, `recorrido-api.e2e-spec.ts` · W `operaciones/catalogos/catalogo-panel.test.tsx` |
| Funcionales | Sensores | HU-18 Registro de sensores | SENSOR_IOT | PAN-11 Dispositivos IoT · W `/telemetria` | Probado | B `recorrido-api.e2e-spec.ts`, `mqtt.spec.ts` · W `telemetria/sensores-page.test.tsx` |
| Funcionales | Sensores | HU-19 Ingesta de lecturas | SENSOR_IOT, LECTURA_TELEMETRIA | PAN-11 Dispositivos IoT · sin UI (firmware IoTSensor) | Probado | B `mqtt.spec.ts`, `api-key.guard.spec.ts`, `recorrido-api.e2e-spec.ts` (ingesta) |
| Funcionales | Sensores | HU-21 Umbrales de sensores | UMBRAL_SENSOR | PAN-17 Telemetría y umbrales · W `/sensores/:sensorId` | Probado | B `umbral-sensor.service.spec.ts`, `set-umbral.dto.spec.ts` · W `telemetria/sensor-detalle-page.test.tsx` |
| Funcionales | Sensores | HU-22 Alertas por umbral | ALERTA_IOT, NOTIFICACION | PAN-17 Telemetría y umbrales · W `/telemetria/alertas` | Probado | B `recorrido-api.e2e-spec.ts` (alerta) · W `telemetria/alertas-page.test.tsx` |
| Funcionales | Cuadrillas | HU-23 Cuadrillas de vendimia | CUADRILLA_COSECHA | PAN-12 Consola de pesaje · W `/vendimia/cuadrillas` | Probado | B `recorrido-api.e2e-spec.ts` (cuadrillas) · W `vendimia/cuadrillas-page.test.tsx` |
| Funcionales | Pesajes | HU-24 Pesaje diario | PESAJE_VENDIMIA, CUADRILLA_COSECHA | PAN-12 Consola de pesaje · M `(tabs)/pesaje/nuevo` · W `/cuarteles/:id/pesajes` | Probado | M `sync-pesajes.test.ts`, `.maestro/03-pesaje-vendimia.yaml` · B `metas-y-gps.e2e-spec.ts` · W `vendimia/pesajes-page.test.tsx` |
| Funcionales | Liquidación | HU-25 Cálculo de liquidación | PESAJE_VENDIMIA | s/PAN (lógica de sistema; resultado en PAN-12/13) · W `/remitos/:remitoId` | Probado | B `liquidacion-vendimia.e2e-spec.ts`, `remitos.e2e-spec.ts` |
| Funcionales | Remitos | HU-26 Borrador de remito | REMITO_DESPACHO | PAN-13 Despachos y remitos · W `/vendimia` | Probado | B `remitos.e2e-spec.ts` (generación) · W `vendimia/remitos-page.test.tsx` |
| Funcionales | Remitos | HU-27 Aprobación de remitos | REMITO_DESPACHO | PAN-13 Despachos y remitos · W `/vendimia`, `/remitos/:remitoId` | Probado | B `remitos.e2e-spec.ts` (aprobación/rechazo) · W `vendimia/remitos-page.test.tsx`, `remito-detalle-page.test.tsx` |
| Funcionales | Cosecha | HU-28 Estado de cosecha | CUARTEL | s/PAN · W `/vendimia/cosecha` | Probado | B `liquidacion-vendimia.e2e-spec.ts` (estado) · W `vendimia/cosecha-page.test.tsx` |
| De información y control | Margen bruto | HU-15 Margen bruto por cuartel | CUARTEL, PARTE_LABOR, PESAJE_VENDIMIA | PAN-15 Margen bruto · W `/operaciones` | Probado | B `recorrido-api.e2e-spec.ts` (margen bruto) · W `operaciones/costeo/costeo-page.test.tsx` |
| De información y control | Historial | HU-17 Historial de labores | PARTE_LABOR | s/PAN · W `/cuarteles/:cuartelId/historial` · M `(tabs)/labores` | Probado | B `costos-por-rol.spec.ts`, `recorrido-api.e2e-spec.ts` · W `operaciones/historial/historial-page.test.tsx` |
| De información y control | Gráficos | HU-20 Gráficos de sensores | LECTURA_TELEMETRIA | PAN-17 Telemetría · W `/sensores/:sensorId` | Probado | B `recorrido-api.e2e-spec.ts` (serie) · W `telemetria/sensor-detalle-page.test.tsx` |
| De información y control | Correlación | HU-29 Correlación sensor-costos | LECTURA_TELEMETRIA, CUARTEL, PARTE_LABOR | PAN-18 Correlación · W `/inteligencia/correlacion` | Probado | B `pearson.spec.ts`, `recorrido-api.e2e-spec.ts` · W `inteligencia/correlacion-page.test.tsx` |
| De información y control | Recomendaciones | HU-30 Recomendaciones agronómicas | RECOMENDACION, CUARTEL | PAN-19 Tendencias y recomendaciones · W `/inteligencia/recomendaciones` | Probado | B `recorrido-api.e2e-spec.ts` · W `inteligencia/recomendaciones-page.test.tsx` |
| De información y control | Comparación de campañas | HU-31 Comparación entre campañas | CAMPANIA, CUARTEL | PAN-19 Tendencias y recomendaciones · W `/inteligencia`, `/inteligencia/campanias` | Probado | B `recorrido-api.e2e-spec.ts` · W `inteligencia/comparacion-page.test.tsx`, `campanias-page.test.tsx` |
| De información y control | Dashboard KPIs | HU-32 Dashboard de indicadores | Agregado (sin tabla propia) | s/PAN · W `/` (inicio) · M `(tabs)/index` | Probado | B `recorrido-api.e2e-spec.ts` (por rol) · W `dashboard/dashboard-page.test.tsx` · M `ResumenKPIs.test.tsx` |

## Resumen

### Conteo por estado

| Estado | Cantidad | % |
|---|---:|---:|
| Probado | 36 | 100 % |
| Codificado | 0 | 0 % |
| En desarrollo | 0 | 0 % |
| No iniciado | 0 | 0 % |
| **Total** | **36** | **100 %** |

### Conteo por módulo

| Módulo | HU | Probado | Codificado | En desarrollo | No iniciado | Avance |
|---|---:|---:|---:|---:|---:|---:|
| Transversales | 11 | 11 | 0 | 0 | 0 | 100 % |
| Funcionales | 18 | 18 | 0 | 0 | 0 | 100 % |
| De información y control | 7 | 7 | 0 | 0 | 0 | 100 % |
| **Total** | **36** | **36** | **0** | **0** | **0** | **100 %** |

**Avance de codificación:** 36 de 36 HU codificadas (100 %). **Avance de pruebas automatizadas:** 36 de 36 HU con al menos un test que las cubre (100 %).

### Observaciones

- **Pantallas sin frame de Figma.** HU-04, HU-17, HU-25, HU-28, HU-32, HU-34, HU-35 y HU-36 no tienen PAN asignado en la matriz original (PAN-01 a PAN-19). Están implementadas igual, y la tabla consigna la pantalla real.
- **Cobertura desigual.** HU-03, HU-25 y HU-19 solo tienen tests de backend: sus pantallas (o el firmware, en HU-19) no tienen tests propios. HU-36 y HU-10 se prueban en la Web contra una API simulada (MSW), sin un test de backend específico. HU-13 tiene tests solo en Mobile.
- **Alcance del sensor físico.** El firmware de IoTSensor (ESP8266 con DHT11) mide solo temperatura y humedad ambiente. Los demás tipos de sensor del catálogo (por ejemplo, humedad de suelo) se ejercitan con el simulador (`IoTSensor/simulador/simulador.py`) y con los tests de backend.
- **Notas de las specs ya resueltas.** HU-30 todavía dice que falta el `PATCH` de recomendaciones, pero el endpoint existe (`inteligencia-agronomica.controller.ts`) y el test de integración lo ejercita. En HU-07, la inmutabilidad del log se resolvió con un trigger en la base (ver `DECISIONS.md`).
