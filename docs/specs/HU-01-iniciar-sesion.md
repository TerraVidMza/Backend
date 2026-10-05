# HU-01 — Iniciar sesión

| Campo | Valor |
|---|---|
| **Actor** | Usuario del sistema (cualquier rol) |
| **Área** | Autenticación y seguridad |
| **Módulo backend** | `src/modules/auth` |
| **Entidad principal** | `USUARIO` |
| **Prioridad** | Alta |
| **Complejidad** | Media |
| **Precondiciones** | Ninguna |
| **Pantallas (Figma)** | PAN-01: Login / Inicio de Sesión — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** bcrypt costo 10 (no 12), devuelve 403 en vez de 429 al bloquear, sin auditoría de login fallido, enumeración de usuarios por timing. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Criterios (2026-08-25):** la política de contraseñas se valida en el servidor (mínimo 8, letra y número, tope de 72 por el truncado de bcrypt) en el alta, el reset y el cambio. No se aplica al login, donde rechazaría contraseñas antiguas y revelaría la política.

> **Refresh token (2026-10-05):** el login ya no entrega un token de 8 horas. Devuelve un access token corto (15 minutos por defecto) y un refresh token opaco (7 días por defecto) que el cliente usa en `POST /auth/refresh` para renovar la sesión sin volver a pedir la contraseña. Las dos duraciones las configura el Propietario por empresa (`sesion_access_minutos`, `sesion_refresh_dias`). El criterio «el token expira tras 8 horas de inactividad» pasa a ser «la sesión expira cuando el refresh token vence sin usarse». Ver [D-023](../DECISIONS.md#d-023--sesiones-con-refresh-token-rotativo-y-duración-configurable-por-empresa).

> **Permisos y app móvil (2026-10-05):** el usuario de la sesión incluye `permisos`, la lista de capacidades de su rol. Con `cliente: 'movil'` el login exige el permiso `appMovil` (Propietario, Agrónomo y Capataz) y responde 403 al Auditor. Ver [D-024](../DECISIONS.md#d-024--los-permisos-se-definen-en-el-backend-y-viajan-con-la-sesión).

## Descripción

Como **usuario del sistema (cualquier rol)**
Quiero **ingresar con mi email y contraseña para acceder a las funcionalidades habilitadas para mi rol**
Para **operar el sistema de forma segura y personalizada.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El usuario ingresa un email con formato inválido (sin @, sin dominio, etc.) | El sistema muestra un mensaje de validación en línea junto al campo email antes de enviar la solicitud al servidor, sin realizar ninguna llamada a la API. | Validación de formato mediante regex estándar RFC 5322 en el cliente. No enviar petición si el campo no pasa validación local. |
| El usuario deja el campo contraseña vacío y presiona "Iniciar sesión" | El sistema muestra un mensaje de error en línea "La contraseña es obligatoria" junto al campo, sin enviar la solicitud. | Validación de campo requerido en el cliente. Deshabilitar el botón de envío si algún campo requerido está vacío. |
| Las credenciales enviadas no coinciden con ningún usuario en la base de datos | El sistema devuelve HTTP 401 y muestra el mensaje genérico "Email o contraseña incorrectos", sin especificar cuál campo falló. | El backend compara siempre el hash bcrypt (costo 12) aunque el email no exista, para evitar timing attacks. Retornar siempre el mismo tiempo de respuesta. |
| El usuario acumula 5 intentos fallidos consecutivos desde la misma cuenta | La cuenta queda bloqueada 15 minutos. El sistema devuelve HTTP 429 con el mensaje "Cuenta bloqueada por demasiados intentos. Intente en 15 minutos" y no procesa más solicitudes de login para ese email durante ese período. | Registrar contador de intentos fallidos en Redis o tabla `lock_attempts` con TTL de 15 min. Resetear contador al login exitoso. Registrar evento en log de auditoría. |
| Las credenciales son correctas y la cuenta está activa | El sistema genera un JWT firmado con algoritmo HS256, retorna HTTP 200 con el token y el rol del usuario, y redirige al dashboard correspondiente a ese rol. | Payload del JWT debe incluir: userId, rol, iat, exp (8 horas desde emisión). Almacenar token en httpOnly cookie o sessionStorage (no localStorage). Tiempo de expiración configurable por variable de entorno. |
| El usuario tiene una sesión activa y no realiza ninguna acción durante 8 horas | El token expira automáticamente. La siguiente request retorna HTTP 401 y el sistema redirige al login mostrando "Tu sesión expiró, ingresa nuevamente". | Verificar `exp` del JWT en cada request protegida mediante middleware de autenticación. Aplicar en todas las rutas del backend y en el interceptor del cliente. |
| Las contraseñas se almacenan en la base de datos | En ningún punto del flujo (transmisión, almacenamiento, logs) se guarda la contraseña en texto plano. Solo se almacena el hash bcrypt. | Usar bcrypt con factor de costo mínimo 12. Nunca loguear bodies de request que contengan el campo password. Conexión HTTPS obligatoria en todos los entornos. |

## Endpoints relacionados

- `POST /api/auth/login`

## Notas / decisiones

- Implementado en `src/modules/auth`. Ver [docs/DECISIONS.md](../DECISIONS.md) para el cambio de framework (Express → NestJS) que sostiene esta implementación.
