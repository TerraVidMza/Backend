# HU-04 — ABM datos personales y modificación de contraseña

| Campo | Valor |
|---|---|
| **Actor** | Usuario autenticado |
| **Área** | Autenticación y seguridad |
| **Módulo backend** | `src/modules/usuarios` (perfil), `src/modules/auth` (cambio de contraseña) |
| **Entidad principal** | `USUARIO` |
| **Prioridad** | Media |
| **Complejidad** | Baja |
| **Precondiciones** | HU-01 completado (sesión activa) |
| **Pantallas (Figma)** | ⚠️ Pendiente — no está en la matriz de trazabilidad (PAN-01 a PAN-19). El documento de HU la asocia a PAN-05, que en la matriz corresponde a otra pantalla (HU-14). Confirmar nombre real del frame en Figma. |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** escalada de privilegios: PATCH /usuarios/me acepta rolId, empresaId y activo. Sin auditoría del cambio de contraseña. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Criterios (2026-08-25):** el cambio de contraseña valida la política server-side y limpia la marca de contraseña temporal.

## Descripción

Como **usuario autenticado**
Quiero **ver y editar mis datos personales y cambiar mi contraseña**
Para **mantener mi información actualizada y controlar la seguridad de mi acceso.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El usuario accede a la sección "Mi Perfil" | El sistema muestra nombre completo, email y rol del usuario. El campo email aparece deshabilitado con la leyenda "Solo el Propietario puede modificar el email". El campo rol aparece como texto de solo lectura, no editable. | El endpoint `GET /usuarios/me` retorna `{nombre, email, rol}`. El rol no es editable desde este formulario en ningún caso. |
| El usuario modifica su nombre y guarda los cambios | El sistema actualiza el campo nombre en la BD, retorna HTTP 200, y muestra el nuevo nombre en la barra de navegación / header de la sesión activa sin necesidad de recargar la página. | Endpoint `PATCH /usuarios/me`. El nombre mínimo es 2 caracteres y máximo 100. Actualizar el payload del JWT o refrescar los datos del usuario en el estado del cliente. |
| El usuario inicia el flujo de cambio de contraseña | El sistema muestra tres campos: "Contraseña actual", "Nueva contraseña" y "Confirmar nueva contraseña". Los tres campos son obligatorios. La nueva contraseña debe tener mínimo 8 caracteres con al menos una letra y un número. | No mostrar los requisitos de contraseña solo cuando el campo tiene error; mostrarlos siempre como hint debajo del campo "Nueva contraseña". |
| El usuario envía el formulario de cambio de contraseña con la contraseña actual incorrecta | El sistema devuelve HTTP 400 con el mensaje "La contraseña actual es incorrecta" solo en el campo correspondiente. No se realiza ningún cambio. | El backend valida la contraseña actual con `bcrypt.compare()` antes de procesar el cambio. No revelar si el error es en la actual o en la nueva. |
| El usuario envía el formulario con todos los campos válidos y la contraseña actual correcta | El sistema hashea la nueva contraseña (bcrypt, costo 12), actualiza la BD, retorna HTTP 200 con "Contraseña actualizada correctamente". No cierra la sesión activa. | Registrar evento de cambio de contraseña en log de auditoría con userId y timestamp. No loguear las contraseñas. |

## Endpoints relacionados

- `GET /api/usuarios/me`
- `PATCH /api/usuarios/me`
- `POST /api/auth/cambiar-password`

## Notas / decisiones

- Implementado en `src/modules/usuarios` + `src/modules/auth`.
