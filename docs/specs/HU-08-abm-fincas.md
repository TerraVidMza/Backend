# HU-08 — ABM fincas

| Campo | Valor |
|---|---|
| **Actor** | Propietario |
| **Área** | Cartografía y topología |
| **Módulo backend** | `src/modules/fincas` |
| **Entidad principal** | `FINCA` |
| **Prioridad** | Alta |
| **Complejidad** | Baja |
| **Precondiciones** | HU-01 completado (sesión activa como Propietario) |
| **Pantallas (Figma)** | PAN-07: ABM de Fincas — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** la baja no verifica cuarteles activos (deja cuarteles huérfanos), sin contador de cuarteles en el listado, sin auditoría. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Criterios (2026-08-25):** la baja se bloquea con **409 si la finca tiene cuarteles activos** —antes quedaban activos colgando de una finca invisible— y el listado trae el contador de cuarteles activos, resuelto con una sola consulta agrupada.

## Descripción

Como **Propietario**
Quiero **registrar, editar y dar de baja las fincas bajo mi gestión**
Para **tener una base de datos centralizada de mis unidades productivas como punto de partida del sistema.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El Propietario completa el formulario de nueva finca con nombre, ubicación y superficie | El sistema valida que el nombre tenga entre 2 y 100 caracteres, la superficie sea un número positivo mayor a 0 con hasta 2 decimales, y la ubicación no supere 200 caracteres. Al guardar, la finca se crea con estado "activa" y aparece en el listado. | Nombre y superficie son obligatorios. Ubicación es texto libre. Registrar alta en log de auditoría. |
| El Propietario intenta crear una finca con el mismo nombre que una finca activa ya existente | El sistema muestra una advertencia "Ya existe una finca activa con ese nombre" pero permite continuar y guardar (el nombre no es unique constraint en BD, solo es una advertencia informativa). | La advertencia se muestra antes del submit, mediante una consulta al endpoint `GET /fincas?nombre=[nombre]` para verificar duplicados. No bloquear la creación. |
| El Propietario edita los datos de una finca existente | El sistema permite modificar nombre, ubicación y superficie. Los cambios se guardan al confirmar y se reflejan de inmediato en el listado y en todos los módulos que muestran el nombre de la finca. | Endpoint `PATCH /fincas/:id`. Los cambios no afectan el historial de labores, pesajes ni remitos asociados. |
| El Propietario intenta dar de baja una finca que tiene cuarteles activos | El sistema devuelve HTTP 409 con el mensaje "No se puede dar de baja la finca porque tiene [N] cuarteles activos asociados. Da de baja los cuarteles primero." | Verificar en el backend (no solo en el frontend) que la finca no tenga cuarteles con estado distinto a "inactivo" antes de procesar la baja. |
| El Propietario da de baja una finca sin cuarteles activos | El sistema cambia el estado de la finca a "inactiva" (baja lógica). La finca no aparece en los selectores de nuevas operaciones (labores, pesajes, sensores) pero sí en el listado de fincas con filtro "inactivas" y en reportes históricos. | Filtrar fincas inactivas por defecto en selectores. Mantener visibilidad en reportes históricos. |
| El Propietario consulta el listado de fincas | El sistema muestra: nombre, ubicación, superficie (ha), estado (activa/inactiva) y cantidad de cuarteles activos. Permite búsqueda por nombre (parcial, case-insensitive) y filtro por estado. Listado paginado (20 por página). | Ordenar por nombre ascendente por defecto. Incluir contador de cuarteles activos mediante JOIN o subconsulta. |

## Endpoints relacionados

- `GET /api/fincas`
- `GET /api/fincas/:id`
- `POST /api/fincas`
- `PATCH /api/fincas/:id`
- `PATCH /api/fincas/:id/desactivar`

## Notas / decisiones

- Implementado en `src/modules/fincas`.
