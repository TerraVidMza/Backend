# HU-06 — Modificar rol de usuario

| Campo | Valor |
|---|---|
| **Actor** | Propietario |
| **Área** | Autenticación y seguridad |
| **Módulo backend** | `src/modules/usuarios`, `src/modules/roles` |
| **Entidad principal** | `USUARIO` |
| **Prioridad** | Alta |
| **Complejidad** | Baja |
| **Precondiciones** | HU-05 completado (el usuario objetivo existe) |
| **Pantallas (Figma)** | PAN-04: Panel de Control de Usuarios (Admin) — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** sin bloqueo de auto-cambio de rol, sin lista blanca de roles asignables, sin auditoría del cambio. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Actualización (Fase 0):** el bloqueo de auto-cambio de rol ya está implementado. Siguen pendientes la lista blanca de roles asignables y la auditoría del cambio. El criterio sobre cuándo aplica el nuevo rol fue corregido según [D-006](../DECISIONS.md).
>
> **Cierre (2026-08-25):** el cambio de rol queda auditado (F2-3) y aplica de inmediato ([D-006](../DECISIONS.md)). **Pendiente:** `update()` acepta cualquier `rolId` existente, así que falta la **lista blanca de roles asignables** que pide el primer criterio.
>
> **Decisiones pendientes (2026-08-26):** ✅ **cerrada.** `update()` valida el `rolId` contra la lista blanca de roles: uno inexistente da 404 en vez de reventar contra la FK. `PROPIETARIO` sigue siendo asignable aunque el selector de la HU liste solo tres roles — excluirlo dejaría a un Propietario único sin forma de delegar, porque nadie puede cambiarse el rol a sí mismo ni dar de baja al último Propietario.

## Descripción

Como **Propietario**
Quiero **asignar o cambiar el rol de un usuario existente**
Para **ajustar sus permisos de acceso según sus responsabilidades actuales en la finca.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El Propietario selecciona un nuevo rol para un usuario en el formulario de edición | El sistema muestra un selector con los roles disponibles: Agrónomo, Capataz, Auditor. El rol actual aparece preseleccionado. Al guardar, el sistema actualiza el rol en la BD y devuelve HTTP 200. | Los roles son un enum en la BD. El selector no debe incluir el rol "Propietario" para evitar crear múltiples Propietarios desde este flujo (esa asignación requiere acción especial). |
| El cambio de rol se guarda mientras el usuario afectado tiene una sesión activa | El nuevo rol y sus permisos asociados aplican **de inmediato**, en la siguiente request del usuario afectado. No hace falta que cierre sesión. | `jwt.strategy.ts` recarga el usuario desde la base en cada request y toma el rol de ahí, no del payload del JWT. Esto es deliberado: si se degrada a un usuario, pierde los permisos en el acto en lugar de seguir operando con el rol anterior hasta que expire su token (8 h). Ver [D-006](../DECISIONS.md) — este criterio **reemplaza** al original, que describía el comportamiento diferido. |
| El Propietario intenta cambiar su propio rol | El sistema devuelve HTTP 403 con el mensaje "No puedes modificar tu propio rol." El selector de rol aparece deshabilitado en el formulario de edición del Propietario logueado. | ✅ Implementado en `usuarios.service.ts` (`update`): compara el `id` del actor contra el del recurso cuando el DTO trae `rolId`. |
| El cambio de rol se completa exitosamente | El sistema registra en el log de auditoría: fecha, hora, userId del Propietario responsable, userId del usuario afectado, rol anterior y rol nuevo. | Usar la entidad AuditLog con campos: timestamp, actor_id, action="ROLE_CHANGE", entity="users", entity_id, old_value, new_value. |

## Endpoints relacionados

- `PATCH /api/usuarios/:id`

## Notas / decisiones

- Implementado en `src/modules/usuarios` + `src/modules/roles`.
