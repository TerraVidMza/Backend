# HU-16 — ABM tipos de labor e insumos

| Campo | Valor |
|---|---|
| **Actor** | Propietario |
| **Área** | Operaciones y costeo |
| **Módulo backend** | `src/modules/insumos`, `src/modules/tipo-labor` |
| **Entidad principal** | `CATALOGO_ITEM`, `CONFIGURACION` |
| **Prioridad** | Alta |
| **Complejidad** | Baja |
| **Precondiciones** | HU-01 completado (sesión activa como Propietario) |
| **Pantallas (Figma)** | PAN-16: Parámetros del Sistema y Precios Base — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** unidades sin enum, unicidad global en vez de "entre activos", la baja no verifica registros históricos, sin auditoría. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Criterios (2026-08-25):** las unidades pasaron a **enum** (convivían "kg", "Kg" y "kilos" como valores distintos) y la unicidad de nombre es ahora **entre activos**, con índice parcial: dar de baja un ítem ya no bloquea su nombre para siempre.
>
> **Decisiones de modelo (2026-08-25):** ✅ los catálogos son **por empresa** ([D-011](../DECISIONS.md)): se cerró el residuo de S1 por el que un Propietario que cambiaba un costo lo cambiaba para todas las empresas.

## Descripción

Como **Propietario**
Quiero **crear, editar y dar de baja tipos de labor e insumos con sus costos unitarios**
Para **parametrizar correctamente el motor de costeo y mantener los catálogos actualizados.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El Propietario crea un nuevo tipo de labor | El formulario requiere: nombre (obligatorio, 2-100 chars, único entre labores activas), descripción (opcional, máx 300 chars), unidad de medida (selector: horas, jornales, ha, m²) y costo unitario (decimal positivo, en la moneda configurada en HU-33). Al guardar, el tipo de labor está disponible para nuevos registros. | Almacenar costo unitario con fecha de vigencia (campo `valid_from`). Registrar alta en log de auditoría. |
| El Propietario crea un nuevo insumo | El formulario requiere: nombre (obligatorio, 2-100 chars, único entre insumos activos), unidad de medida (selector: kg, litros, unidades, gramos) y costo unitario (decimal positivo). Al guardar, el insumo está disponible en los catálogos locales de los Capataces en la próxima sincronización. | Los catálogos de labores e insumos tienen ABM separado del resto de catálogos (HU-34). Almacenar costo con fecha de vigencia. |
| El Propietario da de baja un tipo de labor o insumo | El ítem cambia a estado "inactivo" y deja de aparecer en los formularios de carga de nuevas labores. No es posible eliminar lógicamente un ítem que tenga registros históricos (mostrar advertencia y confirmar). El ítem queda inactivo pero sus registros históricos conservan el nombre y costo original. | Los catálogos locales de los Capataces se actualizarán en la próxima sincronización excluyendo el ítem inactivo. |
| El Propietario modifica el costo unitario de una labor o insumo existente | El sistema crea un nuevo registro de costo con la nueva tarifa y la fecha de hoy como `valid_from`, sin modificar los registros de costo anteriores. Los registros históricos de labores ya sincronizados conservan el costo que tenían al momento de la sincronización. | Versionado de costos: tabla separada con campo `valid_from`/`valid_to`. Al calcular margen bruto, usar el costo vigente a la fecha de la labor (no el costo actual). |
| El Propietario consulta el listado de labores o insumos | El sistema muestra: nombre, unidad, costo actual, estado y fecha de último cambio de costo. Permite buscar por nombre (parcial, case-insensitive) y filtrar por estado (activo/inactivo). | Mostrar el costo actual vigente (`valid_from` más reciente). Incluir indicador visual si el costo fue modificado en los últimos 30 días. |

## Endpoints relacionados

- `GET /api/insumos`, `GET /api/insumos/:id`, `POST /api/insumos`, `PATCH /api/insumos/:id`, `PATCH /api/insumos/:id/desactivar`
- `GET /api/insumos/:id/costos`, `POST /api/insumos/:id/costos`
- `GET /api/tipos-labor`, `GET /api/tipos-labor/:id`, `POST /api/tipos-labor`, `PATCH /api/tipos-labor/:id`, `PATCH /api/tipos-labor/:id/desactivar`
- `GET /api/tipos-labor/:id/costos`, `POST /api/tipos-labor/:id/costos`

## Notas / decisiones

- Implementado en `src/modules/insumos` + `src/modules/tipo-labor`. La ruta real del segundo módulo es `/tipos-labor` (plural).
