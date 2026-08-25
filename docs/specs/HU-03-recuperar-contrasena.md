# HU-03 — Recuperar contraseña

| Campo | Valor |
|---|---|
| **Actor** | Usuario que no recuerda su contraseña |
| **Área** | Autenticación y seguridad |
| **Módulo backend** | `src/modules/auth`, `src/modules/token-recuperacion` |
| **Entidad principal** | `TOKEN_RECUPERACION`, `USUARIO` |
| **Prioridad** | Alta |
| **Complejidad** | Media |
| **Precondiciones** | El usuario tiene una cuenta registrada en el sistema (HU-01) |
| **Pantallas (Figma)** | PAN-03: Olvidé mi Contraseña / Reset Form — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** no se envía ningún email, el flujo es inejecutable end-to-end. Sin rate limiting ni validación de complejidad server-side. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Fase 2 (2026-08-24):** el flujo ya **envía el correo** con el enlace de recuperación (`MailService`, F2-4) y el token dejó de devolverse en la respuesta HTTP fuera de desarrollo. La purga de tokens vencidos corre como cron. Sigue faltando la validación de complejidad server-side.
>
> **Cierre (2026-08-25):** la validación de complejidad server-side que la nota anterior daba por faltante ya está: `EsPasswordSegura` cubre el reset, el alta y el cambio de contraseña. Con eso HU-03 queda cubierta.

## Descripción

Como **usuario que no recuerda su contraseña**
Quiero **solicitar un enlace de recuperación a mi email registrado**
Para **restablecer el acceso a mi cuenta sin necesitar la intervención del Propietario.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El usuario ingresa cualquier email en el formulario de recuperación (exista o no en el sistema) | El sistema muestra siempre el mismo mensaje: "Si ese email está registrado, recibirás un enlace en los próximos minutos." HTTP 200 en todos los casos, sin revelar si el email existe. | Respuesta idéntica para email registrado o no registrado (evitar user enumeration). Agregar rate limiting: máximo 3 solicitudes por email por hora para prevenir spam. |
| El email ingresado corresponde a un usuario activo en el sistema | El sistema genera un token de recuperación UUID v4, lo almacena con hash SHA-256 en la tabla `password_reset_tokens` con expiración de 30 minutos, y envía el email con la URL `https://[dominio]/reset-password?token=[token]` de forma asíncrona. | Almacenar solo el hash del token en BD (nunca el token plano). Usar cola de tareas (Redis Queue / Bull) para el envío asíncrono. Servidor SMTP configurable por variables de entorno. El token es de un solo uso. |
| El usuario accede al enlace dentro de los 30 minutos | El sistema verifica que el token hasheado existe en BD, no fue usado y no expiró. Muestra el formulario para ingresar nueva contraseña (mínimo 8 caracteres incluyendo al menos una letra y un número). La nueva contraseña debe ingresarse dos veces para confirmar. | Validar complejidad de contraseña en el servidor además del cliente. No mostrar el token en el formulario ni en logs. |
| El usuario completa y envía el formulario con una contraseña válida | El sistema hashea la nueva contraseña con bcrypt (costo 12), actualiza la tabla `users`, marca el token como usado en `password_reset_tokens` (o lo elimina), y redirige al login con el mensaje "Contraseña restablecida correctamente". | Invalidar el token inmediatamente tras el restablecimiento. Registrar evento en log de auditoría. |
| El usuario accede al enlace luego de 30 minutos o cuando el token ya fue usado | El sistema devuelve HTTP 400 con el mensaje "El enlace expiró o ya fue utilizado. Solicita uno nuevo." y muestra un botón para volver al formulario de recuperación. | Limpiar tokens expirados de la BD periódicamente (job diario de limpieza). |

## Endpoints relacionados

- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

## Notas / decisiones

- Implementado en `src/modules/auth` + `src/modules/token-recuperacion`.
