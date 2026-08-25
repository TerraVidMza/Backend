# HU-15 — Consulta de margen bruto por cuartel

| Campo | Valor |
|---|---|
| **Actor** | Propietario o Agrónomo |
| **Área** | Operaciones y costeo |
| **Módulo backend** | `src/modules/registro-labor` |
| **Entidad principal** | `CUARTEL`, `PARTE_LABOR`, `PESAJE_VENDIMIA` |
| **Prioridad** | Alta |
| **Complejidad** | Media |
| **Precondiciones** | HU-14 completado (registros de labores e insumos sincronizados en el servidor) |
| **Pantallas (Figma)** | PAN-15: Dashboard de Margen Bruto y Rentabilidad — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** no calcula margen (no existe ninguna fuente de ingreso). Devuelve costos de un solo cuartel, sin filtros, sin $/ha y sin filtrar por estado_sync. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Fase 2 (2026-08-24):** `GET /registro-labor/cuartel/:id/margen-bruto` dejó de publicar un margen inexistente: devuelve `margenBruto: null` con `margenBrutoDisponible: false` y el motivo. El margen real depende de [D-005](../DECISIONS.md).
>
> **Criterios (2026-08-25):** `GET /registro-labor/costeo` implementa la tabla multi-cuartel de la HU: **`SUM` en SQL**, costo por hectárea y filtros por finca y rango. Los insumos se agregan en subconsulta aparte para no inflar el costo de mano de obra. Solo falta el ingreso de D-005 para que el margen sea real.
>
> **Decisiones de modelo (2026-08-25):** ✅ **el margen bruto ya es real**: `liquidaciones_bodega` aporta el ingreso ([D-010](../DECISIONS.md)) y el costeo devuelve `margenBruto`, `margenBrutoPorHa` e `ingresos` por cuartel. Sin liquidaciones cargadas sigue informando `null`, no 0.

## Descripción

Como **Propietario o Agrónomo**
Quiero **ver el margen bruto actualizado de cada cuartel en cualquier momento**
Para **tomar decisiones de manejo basadas en la rentabilidad actual de cada unidad productiva.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El usuario accede al panel de margen bruto | El sistema muestra una tabla con una fila por cuartel activo. Columnas: nombre del cuartel, finca, costo total de labores ($), costo total de insumos ($), costo total por ha ($/ha), margen bruto total ($) y margen bruto por ha ($/ha). Los valores corresponden solo a registros con estado_sync = "sincronizado". | El cálculo se realiza en el backend al momento de la consulta (no se almacena como campo persistente). Disponible solo en la web, no en mobile. Fórmula: costo_labores = SUM(horas × costo_unitario_labor); costo_insumos = SUM(cantidad × costo_unitario_insumo_vigente_al_sync). |
| El usuario aplica filtros al panel | El sistema permite filtrar por: finca (selector), cuartel (selector dependiente de la finca), y rango de fechas (desde/hasta con date picker). Al cambiar cualquier filtro, los valores de la tabla se recalculan automáticamente. | El filtro de rango de fechas filtra por fecha de la labor (no por fecha de sincronización). El selector de cuartel se vacía y recarga cuando cambia el selector de finca. |
| Se sincronizan nuevos registros de labores mientras el panel está abierto | Los valores de margen bruto se actualizan automáticamente en un máximo de 30 segundos después de la sincronización, sin necesidad de recargar la página. | Implementar polling cada 30 segundos o WebSocket para actualización en tiempo real del panel. El indicador de "Última actualización: hace X seg" debe mostrarse. |
| Un cuartel no tiene ninguna labor registrada en el período filtrado | El cuartel aparece igual en la tabla con todos sus valores en $0,00. No se ocultan cuarteles con datos vacíos. | LEFT JOIN entre cuarteles y labores para incluir cuarteles sin datos. Mostrar $0,00 (no NULL ni vacío). |

## Endpoints relacionados

- `GET /api/registro-labor/cuartel/:cuartelId/margen-bruto`

## Notas / decisiones

- Implementado en `src/modules/registro-labor`.
