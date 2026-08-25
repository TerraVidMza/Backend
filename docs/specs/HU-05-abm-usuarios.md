# HU-05 — ABM Usuarios

| Campo | Valor |
|---|---|
| **Actor** | Propietario |
| **Área** | Autenticación y seguridad |
| **Módulo backend** | `src/modules/usuarios`, `src/modules/roles` |
| **Entidad principal** | `USUARIO` |
| **Prioridad** | Alta |
| **Complejidad** | Media |
| **Precondiciones** | HU-01 completado (sesión activa como Propietario) |
| **Pantallas (Figma)** | PAN-04: Panel de Control de Usuarios (Admin) — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** sin contraseña temporal ni email de bienvenida, listado sin paginación ni filtros, sin check de "último Propietario", sin auditoría. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Fase 2 (2026-08-24):** el listado ya tiene **paginación, búsqueda por nombre/email y filtros por rol y estado** (F2-2), y el alta/baja/modificación quedan auditadas con actor e IP (F2-3). Siguen faltando la contraseña temporal y el email de bienvenida.
>
> **Criterios (2026-08-25):** el alta sin contraseña genera una **contraseña temporal** y manda el correo de bienvenida con enlace de 48 h; el usuario queda con `debeCambiarPassword` para que el cliente fuerce el cambio. Con esto HU-05 queda cubierta.
>
> **Decisiones de modelo (2026-08-25):** se agregó `PUT /usuarios/:id/fincas` para asignar las fincas cuyos avisos recibe el usuario ([D-012](../DECISIONS.md)). No afecta el alcance de datos, que sigue siendo por empresa.

## Descripción

Como **Propietario**
Quiero **crear, modificar, consultar y dar de baja usuarios**
Para **controlar quién tiene acceso al sistema y con qué nivel de permisos.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El Propietario completa el formulario de creación de usuario con nombre, email y rol válidos | El sistema crea el usuario con estado "activo" y contraseña temporal, envía un email de bienvenida con un enlace de un solo uso válido por 48 horas para que el usuario establezca su contraseña, y muestra el nuevo usuario en el listado. | El email de bienvenida usa el mismo servidor SMTP configurado en parámetros del sistema. El enlace de bienvenida sigue el mismo mecanismo que el reset de contraseña (token UUID v4, hash en BD). Registrar alta en log de auditoría. |
| El Propietario intenta crear un usuario con un email que ya existe en el sistema (activo o inactivo) | El sistema devuelve HTTP 409 con el mensaje "Ya existe un usuario con ese email" junto al campo email del formulario. No crea ningún registro. | Constraint UNIQUE en columna email de la tabla `users`. La verificación debe incluir usuarios inactivos para evitar reactivaciones accidentales. |
| El Propietario modifica el nombre, email o rol de un usuario existente | El sistema actualiza los campos modificados en la BD, retorna HTTP 200, y refleja los cambios en el listado. Si se modificó el rol, el nuevo rol aplica en el próximo login del usuario afectado. | Endpoint `PATCH /usuarios/:id`. Registrar modificación en log de auditoría indicando campo modificado, valor anterior y valor nuevo. |
| El Propietario da de baja a un usuario | El sistema cambia el estado del usuario a "inactivo" (baja lógica). El usuario no puede iniciar sesión (el endpoint de login retorna HTTP 401 con "Tu cuenta está desactivada"). Sus registros históricos permanecen intactos y visibles en reportes. | No eliminar el registro de la BD. Agregar campo estado (activo/inactivo) con índice. Verificar estado en el middleware de autenticación. |
| El Propietario consulta el listado de usuarios | El sistema muestra nombre, email, rol y estado (activo/inactivo) de todos los usuarios. Permite búsqueda parcial por nombre o email (case-insensitive) y filtro por rol y estado. El listado está paginado (20 registros por página). | Búsqueda mediante ILIKE en PostgreSQL o LOWER(campo) LIKE en SQLite. Incluir total de resultados sobre el listado. |
| El Propietario intenta dar de baja al único usuario con rol Propietario del sistema | El sistema devuelve HTTP 403 con el mensaje "No es posible dar de baja al único Propietario del sistema." No realiza ningún cambio. | Verificar en el backend que exista al menos otro usuario con rol Propietario activo antes de procesar la baja. |

## Endpoints relacionados

- `GET /api/usuarios`
- `GET /api/usuarios/:id`
- `POST /api/usuarios`
- `PATCH /api/usuarios/:id`
- `PATCH /api/usuarios/:id/desactivar`

## Notas / decisiones

- Implementado en `src/modules/usuarios` + `src/modules/roles`.
