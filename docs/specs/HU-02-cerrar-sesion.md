# HU-02 — Cerrar sesión

| Campo | Valor |
|---|---|
| **Actor** | Usuario autenticado |
| **Área** | Autenticación y seguridad |
| **Módulo backend** | `src/modules/auth` |
| **Entidad principal** | `USUARIO` |
| **Prioridad** | Alta |
| **Complejidad** | Baja |
| **Precondiciones** | HU-01 completado (usuario con sesión activa) |
| **Pantallas (Figma)** | PAN-02: Barra de Navegación / Menú Lateral — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** el logout no invalida el token: solo escribe auditoría. Sin blacklist ni refresh tokens, y falla con 401 si el token ya expiró. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Criterios (2026-08-25):** el logout ya **invalida el token**: se firma con `jti` y el cierre de sesión lo registra en `token_revocado`, que la estrategia JWT consulta en cada request. Antes solo escribía auditoría y el token seguía sirviendo sus 8 horas.

## Descripción

Como **usuario autenticado**
Quiero **cerrar mi sesión activa de forma explícita**
Para **proteger mi cuenta cuando dejo de usar el sistema o cedo el dispositivo a otra persona.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El usuario presiona el botón "Cerrar sesión" en la interfaz | El sistema llama al endpoint `POST /auth/logout`, el servidor agrega el token a la blacklist (o invalida el refresh token), devuelve HTTP 200, y el cliente elimina el token del almacenamiento local y redirige a la pantalla de login. | Implementar blacklist de tokens en Redis con TTL igual al tiempo restante de expiración del token. Alternativamente, usar refresh tokens de corta duración (15 min) + access token. Endpoint debe funcionar también con token ya expirado. |
| El usuario, luego de cerrar sesión, presiona el botón Atrás del navegador | El sistema detecta que no hay token válido, no muestra ninguna pantalla protegida, y redirige automáticamente al login. | Implementar guard de rutas protegidas en el frontend (React Router / Vue Router) que verifique la validez del token antes de renderizar cualquier componente. `Cache-Control: no-store` en respuestas de páginas autenticadas. |
| El usuario cierra sesión desde la aplicación mobile | El sistema, además de invalidar el token en el servidor, elimina el token del almacenamiento seguro del dispositivo (Keychain en iOS, Keystore en Android), y borra todos los datos de sesión almacenados localmente. | Usar `react-native-keychain` o equivalente para limpiar el Keychain/Keystore. Limpiar también el caché local de IndexedDB/SQLite con datos sincronizados si aplica. |

## Endpoints relacionados

- `POST /api/auth/logout`

## Notas / decisiones

- Implementado en `src/modules/auth`.
