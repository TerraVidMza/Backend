# HU-13 — Registrar utilización de insumos

| Campo | Valor |
|---|---|
| **Actor** | Capataz |
| **Área** | Operaciones y costeo |
| **Módulo backend** | `src/modules/registro-labor`, `src/modules/insumos` |
| **Entidad principal** | `DETALLE_INSUMO_LABOR`, `CATALOGO_ITEM` |
| **Prioridad** | Alta |
| **Complejidad** | Media |
| **Precondiciones** | HU-12 (labor en curso en el formulario), HU-16 (catálogo de insumos disponible localmente) |
| **Pantallas (Figma)** | PAN-10: Selección de Insumos / Tareas (Mobile) — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** un insumo duplicado en la misma labor dobla el costo sin validación. No existe inventario ni validación de stock en el servidor. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Criterios (2026-08-25):** el detalle de insumos tiene tope de 20 por labor y CHECK de cantidad positiva en base, además del UNIQUE que ya impedía duplicarlos.
>
> **Cierre (2026-08-25):** el stock local y su advertencia no bloqueante son del cliente offline: el servidor no lleva inventario, y ninguna HU se lo pide. Los criterios que sí le tocan al backend —costo unitario vigente al sincronizar y N insumos por labor— están cubiertos.

## Descripción

Como **Capataz**
Quiero **indicar qué insumos y cuánta cantidad se usaron en una labor registrada**
Para **que el sistema pueda calcular correctamente el costo real de cada jornada de trabajo.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El Capataz selecciona un insumo del catálogo local para agregar a una labor | El selector muestra solo los insumos activos del catálogo local descargado al hacer login. Cada insumo muestra: nombre y unidad de medida. Al seleccionar un insumo, se habilita el campo numérico de cantidad. | El catálogo de insumos se descarga al iniciar sesión y se actualiza en cada sincronización. No requiere conexión para mostrar el selector. |
| El Capataz ingresa una cantidad de insumo | El sistema muestra debajo del campo de cantidad: el stock local disponible del insumo (si está cargado en el catálogo local). Si la cantidad supera el stock local, se muestra una advertencia no bloqueante: "La cantidad supera el stock local disponible". El guardado no se bloquea por esta advertencia. | El stock local es informativo. La validación real de stock se realiza en el servidor al sincronizar. No impedir el guardado local por falta de stock. |
| El Capataz agrega múltiples insumos a la misma labor | El sistema permite agregar N insumos distintos a la misma labor. Cada insumo agregado aparece en la lista de "Insumos registrados" con nombre, cantidad y unidad. Se puede eliminar un insumo de la lista antes de guardar la labor. | No restringir la cantidad de insumos por labor. Validar que no se agregue el mismo insumo dos veces en la misma labor (mostrar error en línea). |
| La labor con insumos es sincronizada con el servidor (HU-14) | El servidor registra cada insumo con su cantidad y el costo unitario vigente al momento de la sincronización. Este costo se almacena en el registro del pesaje/labor para auditoría futura. | El costo unitario del insumo al momento de la sincronización se toma de la tabla de insumos del servidor, no del catálogo local (que puede estar desactualizado). El costo se congela en ese registro histórico. |

## Endpoints relacionados

- `POST /api/registro-labor` (incluye el detalle de insumos en el body)
- `POST /api/registro-labor/sync`

## Notas / decisiones

- Implementado en `src/modules/registro-labor` + `src/modules/insumos`.
