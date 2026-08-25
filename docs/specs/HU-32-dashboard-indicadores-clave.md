# HU-32 — Dashboard de indicadores clave

| Campo | Valor |
|---|---|
| **Actor** | Usuario autenticado |
| **Área** | Dashboard y configuración |
| **Módulo backend** | `src/modules/dashboard` |
| **Entidad principal** | ⚠️ No confirmada — no está en la matriz de trazabilidad |
| **Prioridad** | Alta |
| **Complejidad** | Media |
| **Precondiciones** | HU-01 completado. Depende de HU-15, HU-20, HU-28 para los datos a mostrar. |
| **Pantallas (Figma)** | ⚠️ Pendiente — no está en la matriz de trazabilidad (la matriz no cubre el bloque "Dashboard, configuración, notificaciones y ayuda"). |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** el dashboard no diferencia por rol en absoluto: el Auditor recibe costos y kg cosechados, que la HU prohíbe. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Criterios (2026-08-25):** el dashboard agrega en **SQL** —materializaba en memoria todo el histórico de labores e insumos de la empresa— y el payload se enriqueció con costos por finca, las 3 alertas más recientes y el conteo de registros en error de sincronización.
>
> **Cierre (2026-08-25):** **Pendiente:** el **estado de cosecha global** (% de cuarteles por estado) y, en la rama del Capataz, acotar a «los cuarteles asignados a él»: `usuario_finca` solo enruta avisos y no define alcance de datos ([D-012](../DECISIONS.md)). El corte de campaña sigue siendo el año calendario ([D-c](PLAN-MEJORAS.md)).
>
> **Decisiones pendientes (2026-08-26):** ✅ **cerrada.** El corte temporal lo da la campaña abierta ([D-014](../DECISIONS.md)) y el payload dice de qué campaña habla. Se agregó el **estado de cosecha global** (% de cuarteles por estado, con los estados vacíos en 0 para que la barra no cambie de forma según el día) y la **rama del Capataz**: pendientes de sincronización propios y cuarteles en cosecha de sus fincas asignadas.
>
> Esa asignación es un **filtro de vista**, no un límite de permisos: el alcance de datos sigue siendo por empresa ([D-012](../DECISIONS.md)). Sin asignaciones ve todas las fincas, igual que con los avisos.

## Descripción

Como **usuario autenticado**
Quiero **ver al ingresar un panel con los indicadores clave relevantes para mi rol**
Para **tener una visión instantánea del estado del sistema sin navegar por múltiples secciones.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| Un usuario con rol Propietario ingresa al sistema | El dashboard muestra: resumen de margen bruto total por finca (tabla con $ y $/ha), alertas IoT activas (badge con conteo y listado de las 3 más recientes), estado de cosecha global (% de cuarteles por estado), y accesos directos a las funciones más usadas (Registrar labor, Ver remitos pendientes, Ver sensores). | El dashboard debe cargar en menos de 3 segundos (P95). Implementar carga progresiva: mostrar skeleton loaders mientras se cargan los datos de cada widget. |
| Un usuario con rol Agrónomo ingresa al sistema | El dashboard muestra: panel de correlación IoT/costos resumido (indicador de la última correlación calculada), estado de cosecha por cuartel (tabla), remitos pendientes de aprobación y alertas IoT activas. | Los widgets del dashboard son los mismos componentes que se usan en los módulos específicos, renderizados en modo "resumen". Reutilizar la lógica de datos. |
| Un usuario con rol Capataz ingresa al sistema desde mobile | El dashboard mobile muestra: conteo de registros de labor pendientes de sincronización (con botón "Sincronizar ahora"), estado de cuarteles en cosecha activa (solo los asignados a él), y acceso rápido al formulario de registro de labor y pesaje. | La versión mobile del Capataz es una vista reducida y optimizada para 1 mano. Priorizar acciones sobre información. El dashboard debe funcionar en modo offline mostrando los últimos datos sincronizados. |
| Un usuario con rol Auditor ingresa al sistema | El dashboard muestra únicamente: log de auditoría de las últimas 24 horas (10 entradas más recientes) y acceso directo al historial de operaciones por cuartel. No se muestran métricas de costos, sensores ni vendimia. | El Auditor solo tiene acceso a los módulos de auditoría e historial. El dashboard debe reflejar este alcance reducido. |
| Los datos del dashboard son actualizados por el sistema | El dashboard se actualiza automáticamente cada 5 minutos mediante polling. Los contadores de alertas y pendientes de sincronización se actualizan en tiempo real (máximo 30 segundos de delay) sin recargar toda la página. | Usar polling general cada 5 min para el dashboard completo. Usar polling corto (30s) o WebSocket solo para los contadores críticos (alertas IoT y pendientes de sync). |

## Endpoints relacionados

- `GET /api/dashboard/indicadores`

## Notas / decisiones

- Verificar en `dashboard.service.ts` si la respuesta ya varía según el rol del token, o si actualmente devuelve el mismo payload para todos los roles.
