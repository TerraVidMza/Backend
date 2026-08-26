# HU-09 — ABM cuarteles de finca

| Campo | Valor |
|---|---|
| **Actor** | Propietario o Agrónomo |
| **Área** | Cartografía y topología |
| **Módulo backend** | `src/modules/cuarteles` |
| **Entidad principal** | `CUARTEL` |
| **Prioridad** | Alta |
| **Complejidad** | Media |
| **Precondiciones** | HU-08 completado (finca activa existente) |
| **Pantallas (Figma)** | PAN-08: Gestión de Cuarteles — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** la baja no verifica labores/pesajes activos, el campo estado nunca se setea, el año de implantación no valida rango. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Criterios (2026-08-25):** la baja se bloquea con **409 si el cuartel tiene labores o pesajes**, y se agregaron las validaciones de rango (nombre ≥2, año entre 1900 y el actual con validador dinámico, superficie >0 con 2 decimales).
>
> **Cierre (2026-08-25):** **Pendiente:** el criterio de baja habla de registros activos «en la campaña actual»; el chequeo cuenta labores y pesajes **sin acotar el período**, porque el concepto de campaña no existe en el modelo ([D-c](PLAN-MEJORAS.md)). Es más restrictivo que el criterio, no menos: bloquea bajas que la HU permitiría.
>
> **Alcance del Auditor (2026-08-26):** las cuatro lecturas de `/cuarteles` las hace también el Auditor, por la misma razón que en [HU-08](HU-08-abm-fincas.md): el historial de [HU-17](HU-17-historial-labores-cuartel.md) se pide por `cuartelId`. El cuartel no lleva dato económico, y crear, editar y dar de baja siguen cerrados para él. Ver [D-021](../DECISIONS.md#d-021--el-auditor-lee-fincas-y-cuarteles-los-costos-se-filtran-del-payload).
>
> **Decisiones pendientes (2026-08-26):** ✅ **cerrada.** La baja cuenta labores y pesajes **de la campaña actual** ([D-014](../DECISIONS.md)), y el mensaje de 409 nombra la campaña. Sin campaña cargada se sigue contando todo el histórico: negar una baja reversible es más barato que ocultar un cuartel con registros vivos.

## Descripción

Como **Propietario o Agrónomo**
Quiero **registrar, editar y dar de baja los cuarteles dentro de una finca**
Para **modelar la estructura productiva real de la finca con sus metadatos vitícolas.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El usuario completa el formulario de nuevo cuartel con nombre, variedad, clon, año de implantación, sistema de conducción y superficie | El sistema valida que nombre (obligatorio, 2-100 chars) y variedad (obligatorio, selección de catálogo HU-34) estén presentes. Año de implantación: entero entre 1900 y año actual. Superficie: decimal positivo. Al guardar, el cuartel se crea con estado "Pendiente". | Sistema de conducción es campo tipo catálogo administrado desde HU-34. Clon es texto libre opcional (máx. 50 chars). Registrar alta en log de auditoría. |
| El usuario edita los datos de un cuartel existente | El sistema permite modificar todos los campos del cuartel. Los cambios aplican a partir del momento de la edición. Los registros de labores y pesajes ya existentes no se modifican. Se registra la modificación en auditoría. | Endpoint `PATCH /cuarteles/:id`. No es posible cambiar la finca a la que pertenece el cuartel una vez creado. |
| El usuario intenta dar de baja un cuartel con labores o pesajes activos en la campaña actual | El sistema devuelve HTTP 409 con el mensaje "No se puede dar de baja el cuartel porque tiene registros activos en la campaña actual (labores: [N], pesajes: [M])." | Campaña actual = año agrícola vigente. Definir en la BD el campo campaña_id en labores y pesajes para facilitar este filtro. |
| El usuario da de baja un cuartel sin restricciones | El sistema cambia el estado del cuartel a "inactivo". El cuartel no aparece en nuevos formularios de carga, pero sí en el historial y reportes históricos. Se registra la baja en auditoría. | Filtrar cuarteles inactivos por defecto en todos los selectores del sistema. |
| El usuario consulta el listado de cuarteles de una finca | El sistema muestra: nombre, variedad, clon, año de implantación, sistema de conducción, superficie y estado. Permite filtrar por variedad (selector) y estado (selector). Listado paginado (20 por página). | Ordenar por nombre ascendente por defecto. El filtro de variedad debe usar los valores del catálogo de variedades. |

## Endpoints relacionados

- `GET /api/cuarteles`
- `GET /api/cuarteles/:id`
- `POST /api/cuarteles`
- `PATCH /api/cuarteles/:id`
- `PATCH /api/cuarteles/:id/desactivar`

## Notas / decisiones

- Implementado en `src/modules/cuarteles`.
