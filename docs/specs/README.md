# Especificaciones funcionales — TerraVid

Este directorio es el **hub de especificaciones funcionales de todo el proyecto TerraVid** (los 4 repos de la organización [TerraVidMza](https://github.com/TerraVidMza): Backend, Web, Mobile, IoTSensor), no solo del Backend. Cada Historia de Usuario (HU-01 a HU-36) del documento maestro (UTN FRM) tiene su propio archivo de especificación, con:

- Descripción funcional completa (actor, acción, beneficio).
- Criterios de aceptación detallados (tabla Cuando / Espero / notas técnicas).
- Trazabilidad a módulo de backend, entidad de datos, endpoints reales y pantalla de Figma.
- Estado de implementación, verificado contra el código.

Usar [`TEMPLATE.md`](TEMPLATE.md) como base para cualquier HU nueva o para reescribir una existente.

> 📋 **[PLAN-MEJORAS.md](PLAN-MEJORAS.md)** — resultado de la auditoría del código contra los criterios de aceptación de las 36 HU, con el plan de trabajo y su cierre. **El plan está cerrado: las 36 HU completas**, con los 10 problemas sistémicos resueltos y las 8 decisiones de producto tomadas.
>
> Lo que queda ya no es del backend: construir los clientes (Web, Mobile, IoTSensor). El endurecimiento de base está hecho —la aplicación corre con un rol sin privilegios de DDL ([D-017](../DECISIONS.md))— y el push contra Firebase está verificado ([D-015](../DECISIONS.md)); los dos con su comando de verificación ejecutable.

**Figma:** [TerraVid — Wireframes / Design System v1](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1). Las referencias de pantalla (`PAN-XX`) usan la numeración de la **matriz de trazabilidad** (PAN-01 a PAN-19), confirmada como la que coincide con los nombres reales de los frames — no la numeración más granular que aparece dentro del documento de Historias de Usuario (que llega hasta PAN-39 y no coincide con Figma). Ver [D-004](../DECISIONS.md).

> ⚠️ 8 HU (04, 17, 25, 28, 32, 34, 35, 36) no tienen pantalla en la matriz de trazabilidad — no están diseñadas todavía. Se retoma más adelante.

## Índice y matriz de trazabilidad

| HU | Título | Área | Módulo backend | Entidad principal | Figma | Estado |
|---|---|---|---|---|---|---|
| [HU-01](HU-01-iniciar-sesion.md) | Iniciar sesión | Auth y seguridad | `auth` | USUARIO | PAN-01 | 🟢 Completa |
| [HU-02](HU-02-cerrar-sesion.md) | Cerrar sesión | Auth y seguridad | `auth` | USUARIO | PAN-02 | 🟢 Completa |
| [HU-03](HU-03-recuperar-contrasena.md) | Recuperar contraseña | Auth y seguridad | `auth`, `token-recuperacion` | TOKEN_RECUPERACION | PAN-03 | 🟢 Completa |
| [HU-04](HU-04-abm-datos-personales-password.md) | Datos personales y contraseña | Auth y seguridad | `usuarios`, `auth` | USUARIO | — | 🟢 Completa |
| [HU-05](HU-05-abm-usuarios.md) | ABM Usuarios | Auth y seguridad | `usuarios`, `roles` | USUARIO | PAN-04 | 🟢 Completa |
| [HU-06](HU-06-modificar-rol-usuario.md) | Modificar rol de usuario | Auth y seguridad | `usuarios`, `roles` | USUARIO | PAN-04 | 🟢 Completa |
| [HU-07](HU-07-consulta-logs-auditoria.md) | Consulta de logs de auditoría | Auth y seguridad | `log-auditoria` | LOG_AUDITORIA | PAN-06 | 🟢 Completa |
| [HU-08](HU-08-abm-fincas.md) | ABM fincas | Cartografía | `fincas` | FINCA | PAN-07 | 🟢 Completa |
| [HU-09](HU-09-abm-cuarteles-finca.md) | ABM cuarteles de finca | Cartografía | `cuarteles` | CUARTEL | PAN-08 | 🟢 Completa |
| [HU-10](HU-10-visualizacion-cuarteles-mapa.md) | Cuarteles en mapa | Cartografía | `fincas`, `cuarteles` | CUARTEL, FINCA | PAN-14 | 🟢 Completa |
| [HU-11](HU-11-busqueda-fincas-cuarteles.md) | Búsqueda fincas y cuarteles | Cartografía | `fincas`, `cuarteles` | FINCA, CUARTEL | PAN-14 | 🟢 Completa |
| [HU-12](HU-12-registrar-labor-realizada.md) | Registrar labor realizada | Operaciones y costeo | `registro-labor` | PARTE_LABOR | PAN-09 | 🟢 Completa |
| [HU-13](HU-13-registrar-utilizacion-insumos.md) | Registrar utilización de insumos | Operaciones y costeo | `registro-labor`, `insumos` | DETALLE_INSUMO_LABOR | PAN-10 | 🟢 Completa |
| [HU-14](HU-14-sincronizacion-offline.md) | Sincronización offline | Operaciones y costeo | `registro-labor` | PARTE_LABOR | PAN-05 | 🟢 Completa |
| [HU-15](HU-15-consulta-margen-bruto.md) | Margen bruto por cuartel | Operaciones y costeo | `registro-labor` | CUARTEL, PARTE_LABOR | PAN-15 | 🟢 Completa |
| [HU-16](HU-16-abm-tipos-labor-insumos.md) | ABM tipos de labor e insumos | Operaciones y costeo | `insumos`, `tipo-labor` | CATALOGO_ITEM | PAN-16 | 🟢 Completa |
| [HU-17](HU-17-historial-labores-cuartel.md) | Historial de labores por cuartel | Operaciones y costeo | `registro-labor` | PARTE_LABOR | — | 🟢 Completa |
| [HU-18](HU-18-registro-asociacion-sensores.md) | Registro de sensores | Telemetría IoT | `sensores` | SENSOR_IOT | PAN-11 | 🟢 Completa |
| [HU-19](HU-19-ingesta-lecturas-sensores.md) | Ingesta de lecturas | Telemetría IoT | `lecturas-iot` | LECTURA_TELEMETRIA | PAN-11 | 🟢 Completa |
| [HU-20](HU-20-monitoreo-graficos-sensores.md) | Monitoreo y gráficos | Telemetría IoT | `lecturas-iot` | LECTURA_TELEMETRIA | PAN-17 | 🟢 Completa |
| [HU-21](HU-21-configuracion-umbrales-sensores.md) | Configuración de umbrales | Telemetría IoT | `umbral-sensor` | LECTURA_TELEMETRIA | PAN-17 | 🟢 Completa |
| [HU-22](HU-22-notificacion-superacion-umbrales.md) | Alertas por umbral | Telemetría IoT | `alertas-iot` | NOTIFICACION | PAN-17 | 🟢 Completa |
| [HU-23](HU-23-gestion-cuadrillas-vendimia.md) | Gestión de cuadrillas | Vendimia | `cuadrillas` | CUADRILLA_COSECHA | PAN-12 | 🟢 Completa |
| [HU-24](HU-24-registro-pesaje-diario.md) | Registro de pesaje diario | Vendimia | `pesaje-vendimia` | PESAJE_VENDIMIA | PAN-12 | 🟢 Completa |
| [HU-25](HU-25-calculo-automatico-liquidacion.md) | Cálculo de liquidación | Vendimia | `pesaje-vendimia` | PESAJE_VENDIMIA | — | 🟢 Completa |
| [HU-26](HU-26-generacion-borrador-remito.md) | Borrador de remito | Vendimia | `remitos` | REMITO_DESPACHO | PAN-13 | 🟢 Completa |
| [HU-27](HU-27-gestion-aprobacion-remitos.md) | Aprobación de remitos | Vendimia | `remitos` | REMITO_DESPACHO | PAN-13 | 🟢 Completa |
| [HU-28](HU-28-estado-cosecha-cuartel.md) | Estado de cosecha por cuartel | Vendimia | `pesaje-vendimia` | CUARTEL | — | 🟢 Completa |
| [HU-29](HU-29-analisis-correlacion-sensor-costos.md) | Correlación sensor-costos | Inteligencia agronómica | `inteligencia-agronomica` | LECTURA_TELEMETRIA | PAN-18 | 🟢 Completa |
| [HU-30](HU-30-generacion-recomendaciones-agronomicas.md) | Recomendaciones agronómicas | Inteligencia agronómica | `inteligencia-agronomica` | SINOPSIS_PROCESO | PAN-19 | 🟢 Completa |
| [HU-31](HU-31-comparacion-indicadores-campanas.md) | Comparación entre campañas | Inteligencia agronómica | `inteligencia-agronomica` | SINOPSIS_PROCESO | PAN-19 | 🟢 Completa |
| [HU-32](HU-32-dashboard-indicadores-clave.md) | Dashboard de indicadores | Dashboard y config | `dashboard` | — | — | 🟢 Completa |
| [HU-33](HU-33-configuracion-general-sistema.md) | Configuración general | Dashboard y config | `configuracion` | CONFIGURACION | PAN-16 | 🟢 Completa |
| [HU-34](HU-34-administrar-tablas-maestras.md) | Tablas maestras | Dashboard y config | `catalogo-item` | CATALOGO_ITEM | — | 🟢 Completa |
| [HU-35](HU-35-gestion-notificaciones.md) | Gestión de notificaciones | Dashboard y config | `notificaciones` | NOTIFICACION | — | 🟢 Completa |
| [HU-36](HU-36-centro-ayuda.md) | Centro de ayuda | Dashboard y config | `ayuda` | ARTICULO_AYUDA, TICKET_SOPORTE | — | 🟢 Completa |

**Leyenda:** 🟢 Completa — criterios cubiertos · 🟠 Parcial — funciona pero incumple algún criterio · 🔴 Incompleta — criterios centrales ausentes.

Los veredictos salen de auditar el código real de cada módulo contra los criterios de aceptación de su HU, no de dar por cerrado lo que dice el plan. El motivo puntual de cada 🟠 y 🔴 está en el campo **Estado** de la propia spec, con una nota de cierre que dice qué falta y por qué.

## Cómo usar este directorio

1. **Antes de tomar una tarea:** leé [`PLAN-MEJORAS.md`](PLAN-MEJORAS.md). La mayoría de los gaps son **transversales** (aislamiento multi-tenant, auditoría, paginación, migraciones), no de una HU puntual — arreglarlos de a uno por HU sale mucho más caro.
2. **Al implementar:** la spec de la HU es el contrato. Si el código real difiere y la razón es válida, actualizá la spec y registrá el porqué en [`../DECISIONS.md`](../DECISIONS.md).
3. **Al cerrar:** actualizá el campo **Estado** de la spec y la fila de este índice.
