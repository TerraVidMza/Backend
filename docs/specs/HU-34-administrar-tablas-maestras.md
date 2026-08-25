# HU-34 — Administrar las tablas maestras de clasificación

| Campo | Valor |
|---|---|
| **Actor** | Propietario |
| **Área** | Dashboard y configuración |
| **Módulo backend** | `src/modules/catalogo-item` |
| **Entidad principal** | `CATALOGO_ITEM` (no confirmada en matriz) |
| **Prioridad** | Media |
| **Complejidad** | Baja |
| **Precondiciones** | HU-01 completado (sesión activa como Propietario) |
| **Pantallas (Figma)** | ⚠️ Pendiente — no está en la matriz de trazabilidad. |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** el update no revalida unicidad (se puede renombrar un ítem al nombre de otro), sin auditoría y el chequeo de referencias está hardcodeado. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Decisiones de modelo (2026-08-25):** ✅ el ABM opera sobre el catálogo **de la propia empresa** ([D-011](../DECISIONS.md)), no sobre valores globales de la instancia. El `update` revalida la unicidad del nombre, que antes permitía renombrar un valor al de otro.

## Descripción

Como **Propietario**
Quiero **administrar las tablas maestras de clasificación**
Para **mantener actualizados los catálogos que usan los formularios operativos.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El Propietario administra un catálogo maestro (sistema de conducción, variedad, estado de cuartel, unidades) | Para cada catálogo, el sistema permite crear un nuevo valor (nombre obligatorio, 2-100 chars, único dentro del mismo catálogo), editar el nombre de un valor existente y dar de baja lógica un valor (cambia a inactivo). Los valores inactivos no aparecen en los selectores de nuevos formularios pero sí en los registros históricos. | Los catálogos de labores e insumos tienen su propio ABM en HU-16; no están incluidos aquí. Los catálogos administrados en esta HU son: sistemas_conduccion, variedades, estados_cuartel, unidades_medida. |
| El Propietario intenta dar de baja un valor de catálogo que está vinculado a registros existentes (cuarteles, labores, etc.) | El sistema muestra el mensaje: "No es posible eliminar este valor porque está en uso en [N] registro(s) de [tipo de entidad]. Puedes desactivarlo para que no aparezca en nuevos formularios." | Verificar en el backend las referencias existentes antes de permitir la baja. Ofrecer la opción de "desactivar" en lugar de eliminar. |
| El Propietario edita el nombre de un valor de catálogo | El nuevo nombre aplica de forma retroactiva: todos los registros históricos que usaban ese valor mostrarán el nuevo nombre. Se registra el cambio en el log de auditoría. | Los catálogos son tablas de referencia (lookup tables). Los registros de cuarteles/labores almacenan el ID del catálogo, no el texto. Al editar el nombre, todos los registros que referencian ese ID muestran automáticamente el nuevo nombre. |

## Endpoints relacionados

- `GET /api/catalogos`
- `POST /api/catalogos`
- `PATCH /api/catalogos/:id`
- `PATCH /api/catalogos/:id/desactivar`
- `DELETE /api/catalogos/:id`

## Notas / decisiones

- El controller también expone `DELETE /api/catalogos/:id` (baja física), no descripto en el criterio de aceptación de la HU (que solo pide baja lógica cuando el valor está en uso). Confirmar en el service si el DELETE físico solo se permite cuando no hay referencias (0 usos), consistente con la regla de negocio.
