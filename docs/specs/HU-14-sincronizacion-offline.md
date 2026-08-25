# HU-14 — Sincronización automática de datos offline

| Campo | Valor |
|---|---|
| **Actor** | Sistema |
| **Área** | Operaciones y costeo |
| **Módulo backend** | `src/modules/registro-labor` |
| **Entidad principal** | `PARTE_LABOR`, `SINOPSIS_PROCESO` |
| **Prioridad** | Alta |
| **Complejidad** | Alta |
| **Precondiciones** | HU-12 completado (registros con estado_sync = "pendiente" en cola local) |
| **Pantallas (Figma)** | PAN-05: Indicador de Estado de Conexión (Mobile Background) — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** la rama de error inserta en una transacción abortada y tumba el lote entero con 500. Sin flag "Inconsistencia de Catálogo", sin límite de lote, sin auditoría. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Criterios (2026-08-25):** cerrados los tres criterios que faltaban: **lote de 10 registros** por request, **HTTP 200 en el reenvío** del mismo `local_uuid` (201 al crear) y flag **"Inconsistencia de Catálogo"** —el registro se acepta igual, porque el trabajo físico ocurrió, y queda marcado para revisión—. El lote se procesa ordenado por `createdAtLocal`.

## Descripción

Como **sistema**
Quiero **detectar automáticamente cuando el dispositivo recupera conexión y enviar los registros pendientes al servidor**
Para **garantizar que ningún registro de labor se pierda y que los datos estén siempre actualizados en el servidor.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El dispositivo recupera conexión a internet | El sistema detecta el evento de reconexión en máximo 5 segundos e inicia automáticamente el proceso de sincronización de todos los registros con estado_sync = "pendiente". El Capataz ve el indicador de sincronización activa en la barra superior. El proceso ocurre en segundo plano. | Usar el event listener "online" del browser / NetInfo API en React Native. El Capataz también puede iniciar la sincronización manualmente mediante un botón en la barra de estado. |
| Un registro pendiente es enviado y el servidor lo procesa exitosamente | El servidor responde HTTP 201, el sistema actualiza estado_sync del registro local a "sincronizado", el contador de pendientes del badge disminuye en 1. El proceso es idempotente: si el mismo UUID se envía dos veces, el servidor retorna HTTP 200 sin crear un duplicado. | El servidor verifica el UUID del registro antes de insertarlo (constraint UNIQUE en columna local_uuid). Si ya existe, retorna HTTP 200 (idempotencia). Registrar cada sincronización completada en el log de auditoría. |
| Un registro falla la validación del servidor al intentar sincronizarse | El sistema actualiza estado_sync del registro local a "error", guarda el mensaje de error devuelto por el servidor junto al registro, y notifica al Capataz con un mensaje: "Hubo un error al sincronizar [N] registro(s). Revisa los detalles en la sección de pendientes." | Los registros con estado "error" deben mostrarse en una lista separada accesible desde la barra de estado, con el detalle del error para que el Capataz pueda corregirlos y reintentar. |
| El servidor no responde (timeout) durante la sincronización | El sistema implementa reintentos automáticos con backoff exponencial: 1er reintento a los 30s, 2do a los 60s, 3ro a los 120s. Después de 3 reintentos fallidos, el registro queda en estado "error" con mensaje "Sin conexión con el servidor." | Implementar backoff exponencial con jitter para evitar thundering herd. Máximo 3 reintentos automáticos por registro por sesión de sincronización. |
| Múltiples registros están pendientes simultáneamente | El sistema los envía en lotes de máximo 10 registros por request (batch sync) ordenados por timestamp de creación local (más antiguos primero). El progreso de sincronización se muestra como "Sincronizando [X] de [N] registros". | El servidor procesa cada registro de forma independiente y retorna un array de resultados individuales con status por registro. |
| El dispositivo sincroniza un registro de labor creado offline que utiliza un insumo o tipo de labor que fue desactivado (baja lógica) en el servidor después de la última descarga de catálogos del dispositivo | El sistema acepta y guarda el registro para no perder la información del trabajo físico realizado en la finca, pero lo marca con un flag de advertencia "Inconsistencia de Catálogo". | Estos registros se mostrarán resaltados en los reportes del Propietario para que este decida si ajusta el inventario manualmente. |

## Endpoints relacionados

- `POST /api/registro-labor/sync`

## Notas / decisiones

- El endpoint real de este repo es `POST /registro-labor/sync` (el documento maestro lo referencia como `/sync/labores`; nombre de ruta ajustado en la implementación real — ver [docs/DECISIONS.md](../DECISIONS.md) si se documenta formalmente).
