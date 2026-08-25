# HU-26 — Generación de borrador de remito

| Campo | Valor |
|---|---|
| **Actor** | Capataz |
| **Área** | Logística de vendimia |
| **Módulo backend** | `src/modules/remitos` |
| **Entidad principal** | `REMITO_DESPACHO`, `CUARTEL` |
| **Prioridad** | Alta |
| **Complejidad** | Media |
| **Precondiciones** | HU-24 (pesajes del día sincronizados) y HU-35 (notificaciones activas) |
| **Pantallas (Figma)** | PAN-13: Panel de Despachos y Remitos (Aprobaciones) — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** agrupa todos los pesajes históricos (no acepta fecha), incluye pesajes no sincronizados, sin control de concurrencia y sin notificación. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Fase 2 (2026-08-24):** la generación quedó auditada y el listado de remitos acepta filtros por estado, cuartel y finca con paginación (F2-2, F2-3). Sigue faltando la fecha en el borrador y la notificación.
>
> **Criterios (2026-08-25):** el borrador se acota a **una jornada** con el parámetro `fecha` —antes arrastraba todos los pesajes pendientes del cuartel sin importar de cuándo—, la fecha del remito es la de la jornada liquidada, y al generarlo se notifica a quienes pueden aprobarlo.

## Descripción

Como **Capataz**
Quiero **generar un borrador de remito a partir de los pesajes del día para un cuartel**
Para **iniciar el proceso de despacho de uva hacia la bodega para su revisión.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El Capataz solicita generar un remito para un cuartel en una fecha | El sistema agrupa automáticamente todos los pesajes sincronizados del cuartel en la fecha indicada. El borrador muestra: nombre del cuartel, finca, fecha, detalle de cada pesaje (cuadrilla, kg, tarifa, monto), total de kg y total de liquidación. El remito pasa a estado "Pendiente de aprobación". | Un cuartel puede tener máximo un remito en estado "Pendiente" al mismo tiempo. Si ya existe uno pendiente, el sistema muestra el mensaje "Este cuartel ya tiene un remito pendiente de aprobación" y no crea uno nuevo. |
| El borrador de remito es creado exitosamente | El sistema envía una notificación in-app (y email asíncrono) a todos los usuarios con rol Agrónomo y Propietario de la finca con el texto: "Nuevo remito pendiente de aprobación — Cuartel [nombre], Finca [nombre], [N] kg". El Capataz puede ver el estado del remito (Pendiente/Aprobado/Rechazado) en su vista de remitos generados. | Notificación usando el mecanismo de HU-35. El email contiene un enlace directo al remito. El Capataz no puede modificar el remito una vez generado. |
| El Capataz intenta generar un remito para una fecha sin pesajes sincronizados | El sistema devuelve un error informativo: "No hay pesajes sincronizados para el cuartel [nombre] en la fecha [fecha]. Verifica que los registros estén sincronizados." | Solo se incluyen en el remito los pesajes con estado_sync = "sincronizado". Pesajes con estado "pendiente" o "error" no se incluyen. |
| Dos usuarios (Capataces) intentan generar simultáneamente un remito para el mismo cuartel que se encuentra "En cosecha" | El sistema aplica un control de concurrencia (Optimistic Locking sobre la tabla de cuarteles). La primera solicitud se procesa cambiando el cuartel a "Pendiente de aprobación". | La segunda solicitud es rechazada por el backend (HTTP 409 Conflict) y el frontend muestra el mensaje: "Este cuartel ya se encuentra en proceso de liquidación o pendiente de aprobación por otro usuario". |

## Endpoints relacionados

- `POST /api/remitos/generar-borrador`

## Notas / decisiones

- Implementado en `src/modules/remitos`. Pendiente confirmar si el control de concurrencia (Optimistic Locking) está implementado en `cuarteles`/`remitos.service.ts`.
