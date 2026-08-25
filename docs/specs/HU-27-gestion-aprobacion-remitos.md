# HU-27 — Gestión de aprobación de remitos

| Campo | Valor |
|---|---|
| **Actor** | Agrónomo o Propietario |
| **Área** | Logística de vendimia |
| **Módulo backend** | `src/modules/remitos` |
| **Entidad principal** | `REMITO_DESPACHO`, `CUARTEL` |
| **Prioridad** | Alta |
| **Complejidad** | Baja |
| **Precondiciones** | HU-26 (remito en estado "Pendiente de aprobación") y HU-35 (notificaciones) |
| **Pantallas (Figma)** | PAN-13: Panel de Despachos y Remitos (Aprobaciones) — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** ningún criterio se cumple al 100%: el motivo de rechazo acepta 2 caracteres, la numeración tiene race condition y el estado "Observado" no existe. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Fase 2 (2026-08-24):** dos criterios que eran inejecutables ya funcionan: `GET /remitos` **ya no exige `cuartelId`**, así que el panel de aprobaciones del Propietario es expresable, y `GET /remitos/:id` **devuelve el detalle de pesajes** que la vista imprimible no tenía de dónde sacar (F2-2). Aprobación y rechazo quedan auditados con actor e IP.
>
> **Criterios (2026-08-25):** aprobar y rechazar **notifican al Capataz que generó el remito**, con el motivo y el enlace. Las notificaciones se emiten después de confirmar la transacción, no dentro: si el remito hiciera rollback, el aviso quedaría anunciando algo que no existe.
>
> **Decisiones de modelo (2026-08-25):** se agregó `PUT /remitos/:id/liquidacion` para registrar lo que la bodega pagó. Solo sobre remitos **aprobados**: un borrador todavía puede rechazarse y un rechazado nunca llegó a la bodega.

## Descripción

Como **Agrónomo o Propietario**
Quiero **revisar el borrador de remito, aprobarlo o rechazarlo**
Para **garantizar que el despacho de uva esté validado antes de ejecutarse.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El Agrónomo o Propietario aprueba el remito | El estado del remito cambia a "Aprobado", el estado del cuartel cambia a "Cosechado", y el remito queda bloqueado para cualquier modificación. Se genera una visualización del remito aprobado en pantalla (no PDF en esta versión) que puede imprimirse desde el navegador. | Registrar en log de auditoría: userId del aprobador, timestamp, estado anterior y estado nuevo. El remito aprobado es el documento oficial para la bodega. |
| El Agrónomo o Propietario rechaza el remito | El sistema requiere que se ingrese un motivo de rechazo (texto libre, obligatorio, mínimo 10 caracteres). El estado del remito cambia a "Rechazado". El Capataz recibe una notificación in-app con el motivo del rechazo. El cuartel vuelve a estado "En cosecha". | Registrar en auditoría con motivo, userId del rechazador y timestamp. Después del rechazo, el Capataz puede registrar nuevos pesajes y generar un nuevo remito para el mismo cuartel. |
| El remito aprobado se visualiza en pantalla | La vista muestra: número de remito (generado secuencialmente), finca, cuartel, fecha de cosecha, listado de pesajes con detalle (cuadrilla, kg, tarifa, monto), totales, nombre del aprobador y fecha/hora de aprobación. | El número de remito sigue el formato: REM-[AÑO]-[SECUENCIA 5 DÍGITOS] (ej: REM-2026-00001). La secuencia es global del sistema, no por finca. |
| El Propietario o Agrónomo rechaza un remito (ingresando el motivo de >10 caracteres) | El sistema cambia el estado del remito a "Rechazado", el cuartel vuelve a estado "En cosecha", y todos los registros de pesaje individuales asociados a ese remito cambian su estado de "Asignado a Remito" a "Observado". | Los pesajes "Observados" vuelven a estar visibles para el Capataz, quien deberá editarlos o anularlos (Soft Delete) de forma individual para poder incluirlos en un nuevo remito corregido. |

## Endpoints relacionados

- `GET /api/remitos`, `GET /api/remitos/:id`
- `POST /api/remitos/:id/aprobar`
- `POST /api/remitos/:id/rechazar`

## Notas / decisiones

- Implementado en `src/modules/remitos`. Pendiente confirmar el formato exacto del número secuencial de remito (`REM-AÑO-SECUENCIA`) en el service.
