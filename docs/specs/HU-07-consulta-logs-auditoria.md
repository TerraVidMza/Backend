# HU-07 — Consulta de logs de auditoría

| Campo | Valor |
|---|---|
| **Actor** | Propietario o Auditor |
| **Área** | Autenticación y seguridad |
| **Módulo backend** | `src/modules/log-auditoria` |
| **Entidad principal** | `LOG_AUDITORIA` |
| **Prioridad** | Alta |
| **Complejidad** | Media |
| **Precondiciones** | HU-01 completado (sesión activa como Propietario o Auditor) |
| **Pantallas (Figma)** | PAN-06: Visor de Logs de Auditoría (Propietario/Auditor) — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟠 PARCIAL — falta el append-only a nivel de BD (GRANT/RLS) |

> **Auditoría (2026-08-24):** solo 3 eventos auditados en todo el sistema. Sin paginación ni filtros, y el append-only no está garantizado a nivel de BD. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Fase 2 (2026-08-24):** la auditoría pasó de 3 a **43 endpoints en 15 módulos** vía el decorador `@Auditar` (F2-3). El listado tiene paginación y filtros por actor, entidad, acción y rango de fechas; cada entrada identifica al responsable por nombre y registra la IP, y `registrar()` acepta un `EntityManager` para ser transaccional. Falta el append-only garantizado por GRANT/RLS en la base.
>
> **Cierre (2026-08-25):** la auditoría transversal y los filtros del listado están cerrados. **Pendiente:** el criterio de inmutabilidad pide restricciones **a nivel de BD**. Hoy el endpoint solo expone GET, pero la aplicación se conecta con el superusuario `postgres`, así que nada impide un UPDATE o un DELETE por fuera de la API. Falta el GRANT/REVOKE y dejar de usar el superusuario: es trabajo de despliegue, no de código.

## Descripción

Como **Propietario o Auditor**
Quiero **consultar el registro de operaciones críticas realizadas en el sistema**
Para **tener trazabilidad completa de quién hizo qué y cuándo, y detectar acciones indebidas.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El usuario accede al log de auditoría | El sistema muestra un listado paginado (50 registros por página) ordenado por fecha descendente. Cada fila muestra: fecha y hora (timezone del sistema), nombre del usuario responsable, tipo de operación, entidad afectada (ej. "usuarios", "cuarteles") e ID del registro afectado. | Tabla `audit_logs` con campos: id, timestamp, actor_id, action, entity, entity_id, old_value (JSON), new_value (JSON), ip_address. Índices en timestamp y actor_id para performance. Almacenamiento append-only: no permitir UPDATE ni DELETE sobre esta tabla a nivel de BD (Row Level Security o similar). |
| El usuario aplica filtros de búsqueda en el log | El sistema permite filtrar por: rango de fechas (desde/hasta con date picker), usuario responsable (selector con autocomplete), tipo de operación (selector multi-opción: ALTA, BAJA, MODIFICACIÓN, LOGIN_FALLIDO, CAMBIO_ROL, SINCRONIZACIÓN) y entidad afectada. Los filtros son acumulativos y el conteo de resultados se actualiza. | Implementar paginación basada en cursor (keyset pagination) para mejor performance en tablas grandes. Evitar `COUNT(*)` en cada página. |
| Cualquier usuario intenta modificar o eliminar un registro del log | La operación es rechazada. No existe ningún botón de edición ni eliminación en la interfaz. El endpoint solo expone métodos GET. A nivel de BD, la tabla tiene restricciones que impiden UPDATE y DELETE. | Rol de BD de solo escritura append para el usuario de aplicación en la tabla `audit_logs`. No exponer ningún endpoint de escritura en el módulo de auditoría. |
| Un Auditor accede al sistema | El Auditor visualiza únicamente el módulo de log de auditoría y el historial de operaciones por cuartel (HU-17). Las demás secciones del menú no están visibles ni accesibles. | Control de acceso basado en roles (RBAC) implementado en el frontend (ocultar menú) y en el backend (middleware que verifica permisos por endpoint). El Auditor no puede acceder a `/fincas`, `/cuarteles`, `/labores`, `/configuracion`, etc. |
| Se producen eventos críticos en el sistema (login fallido, cambio de rol, baja de usuario, alta de finca, sincronización de labores, etc.) | El sistema registra automáticamente el evento en el log sin intervención del usuario. El registro ocurre dentro de la misma transacción de BD que la operación principal, garantizando consistencia. | Implementar un servicio de auditoría inyectable en los casos de uso del backend. No usar triggers de BD para auditoría (dificultan el mantenimiento). Incluir la IP del request en cada registro. |

## Endpoints relacionados

- `GET /api/log-auditoria`

## Notas / decisiones

- Implementado en `src/modules/log-auditoria`.
