# HU-35 — Gestión de notificaciones

| Campo | Valor |
|---|---|
| **Actor** | Usuario autenticado |
| **Área** | Dashboard y configuración |
| **Módulo backend** | `src/modules/notificaciones` |
| **Entidad principal** | `NOTIFICACION` (no confirmada en matriz) |
| **Prioridad** | Media |
| **Complejidad** | Media |
| **Precondiciones** | HU-01 completado. Requiere HU-22 (alertas IoT), HU-26 (remitos), HU-27 (aprobación/rechazo). |
| **Pantallas (Figma)** | ⚠️ Pendiente — no está en la matriz de trazabilidad. |
| **Estado** | 🟠 PARCIAL — faltan el push FCM (D-e) y el aviso por error de sincronización |

> **Auditoría (2026-08-24):** solo existe 1 de los 3 productores de evento, así que el Capataz nunca recibe notificaciones. Sin FCM, sin purga a 30 días y sin paginación. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Fase 2 (2026-08-24):** el listado viene **paginado, con filtro de no leídas y contador `noLeidas`** para el badge (F2-2), y un cron nocturno **purga las notificaciones de más de 30 días** (F2-5). Falta el push FCM ([D-e](PLAN-MEJORAS.md)).
>
> **Cierre (2026-08-25):** **Pendiente:** el **push FCM** ([D-e](PLAN-MEJORAS.md)) y el tercer productor de eventos: el **error de sincronización no genera notificación**, hoy solo se refleja como conteo en el dashboard. Las alertas IoT y los remitos sí notifican.

## Descripción

Como **usuario autenticado**
Quiero **recibir notificaciones ante eventos relevantes**
Para **estar informado de situaciones que requieren mi atención sin revisar constantemente.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| Ocurre un evento relevante para el rol del usuario (alerta IoT, remito pendiente o rechazado, error de sincronización) | El sistema genera una notificación in-app visible como un badge numérico en el ícono de campana del header. En mobile, se envía además una notificación push mediante Firebase Cloud Messaging (FCM). Cada notificación incluye: título, descripción breve, timestamp y enlace directo a la sección relevante. | Push con FCM requiere registro del device token al hacer login desde mobile. In-app: polling cada 60 segundos o WebSocket para actualización del badge. Almacenar notificaciones en tabla notifications con campos: userId, tipo, título, descripción, url_accion, leida (boolean), created_at. |
| El usuario accede al panel de notificaciones | El sistema muestra el historial de notificaciones ordenado por fecha descendente, paginado (20 por página). Cada notificación muestra: título, descripción, timestamp relativo ("Hace 5 min") y estado (leída/no leída). El usuario puede marcar notificaciones individuales como leídas o marcar todas como leídas. | Las notificaciones con más de 30 días se purgan automáticamente mediante un job nocturno. El usuario ve solo las notificaciones que le corresponden según su rol. |
| El usuario recibe notificaciones de eventos que no corresponden a su rol | El sistema filtra las notificaciones por rol: el Capataz recibe solo errores de sincronización y rechazos de sus remitos; el Agrónomo recibe alertas IoT y remitos pendientes; el Propietario recibe todos los tipos; el Auditor no recibe notificaciones. | El filtrado de notificaciones por rol se implementa en el servicio de notificaciones al momento de la creación. No se envía la notificación a usuarios que no deben recibirla. |

## Endpoints relacionados

- `GET /api/notificaciones`
- `PATCH /api/notificaciones/:id/leida`
- `PATCH /api/notificaciones/leidas`

## Notas / decisiones

- Implementado en `src/modules/notificaciones`. Pendiente confirmar el envío push FCM (mobile) — no verificable desde las rutas del controller.
