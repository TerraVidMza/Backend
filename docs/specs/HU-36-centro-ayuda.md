# HU-36 — Centro de ayuda

| Campo | Valor |
|---|---|
| **Actor** | Usuario autenticado |
| **Área** | Dashboard y configuración |
| **Módulo backend** | `src/modules/ayuda` |
| **Entidad principal** | `ARTICULO_AYUDA`, `TICKET_SOPORTE` (no confirmadas en matriz, inferidas del código) |
| **Prioridad** | Baja |
| **Complejidad** | Baja |
| **Precondiciones** | HU-01 completado (sesión activa) |
| **Pantallas (Figma)** | ⚠️ Pendiente — no está en la matriz de trazabilidad. |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** el envío de email está implementado pero nunca se ejecuta porque las claves SMTP no están seedeadas. Los tickets no se filtran por empresa. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Fase 2 (2026-08-24):** el envío del ticket dejó de armar su propio transport y usa `MailService`, que resuelve el SMTP por empresa y cae a variables de entorno (F2-4). Con `support_email` ya seedeado, el correo efectivamente sale.

## Descripción

Como **usuario autenticado**
Quiero **acceder al manual de usuario y a las preguntas frecuentes**
Para **resolver dudas de uso sin necesidad de contactar al equipo técnico.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El usuario accede a la sección de ayuda | El sistema muestra una pantalla con dos secciones: "Manual de usuario" (organizado por módulos: Autenticación, Fincas, Operaciones, Telemetría, Vendimia, Reportes) y "Preguntas Frecuentes" (organizadas por módulo con acordeón expandible). El contenido incluye capturas de pantalla y está disponible sin conexión (cacheado en el Service Worker). | Implementar como páginas HTML estáticas renderizadas desde Markdown. El contenido debe actualizarse con cada nueva versión del sistema. Cachear en Service Worker para disponibilidad offline. |
| El usuario no encuentra respuesta a su problema en el manual o FAQs | Al final de la sección de ayuda se muestra un formulario de contacto con campos: nombre (pre-completado con el nombre del usuario logueado), email (pre-completado), módulo afectado (selector) y descripción del problema (textarea, máx 1000 chars). Al enviar, se genera un ticket en el sistema de soporte configurado. | El formulario de contacto envía un email al soporte técnico usando el SMTP del sistema (HU-33). Incluir en el email: userId, rol, versión de la app y timestamp. |
| El sistema es actualizado con nuevas funcionalidades | El contenido del manual y las FAQs se actualiza para reflejar los cambios. Los artículos actualizados en los últimos 30 días muestran un badge "Actualizado" junto al título. | Agregar campo `updated_at` a cada artículo del manual. Comparar con la fecha actual al renderizar para mostrar el badge. |

## Endpoints relacionados

- `GET /api/ayuda/articulos`
- `POST /api/ayuda/articulos`
- `PATCH /api/ayuda/articulos/:id`
- `PATCH /api/ayuda/articulos/:id/desactivar`
- `POST /api/ayuda/tickets`
- `GET /api/ayuda/tickets`

## Notas / decisiones

- Implementado en `src/modules/ayuda` (`articulos-ayuda.service.ts` + `ticket-soporte.service.ts`).
