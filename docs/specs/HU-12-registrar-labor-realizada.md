# HU-12 — Registrar labor realizada

| Campo | Valor |
|---|---|
| **Actor** | Capataz |
| **Área** | Operaciones y costeo |
| **Módulo backend** | `src/modules/registro-labor` |
| **Entidad principal** | `PARTE_LABOR`, `USUARIO` |
| **Prioridad** | Alta |
| **Complejidad** | Alta |
| **Precondiciones** | HU-09 y HU-16 completados. El Capataz tiene la app mobile instalada con datos sincronizados previamente. |
| **Pantallas (Figma)** | PAN-09: Carga de Labores (Mobile) — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** no se persiste el timestamp de creación local del dispositivo. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Criterios (2026-08-25):** se persiste `createdAtLocal`, el momento de creación en el dispositivo, que puede ser días anterior al del servidor si se trabajó sin señal.

## Descripción

Como **Capataz**
Quiero **registrar desde mi celular las labores realizadas en un cuartel durante la jornada, aunque no tenga señal**
Para **digitalizar el parte diario de trabajo sin depender de conectividad y sin perder información.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El Capataz accede al formulario de registro de labor sin conexión a internet | El formulario carga completamente mostrando los selectores de finca, cuartel, tipo de labor (del catálogo local) y date picker para la fecha. Todos los campos operan con datos del caché local sin realizar ninguna llamada de red. La barra superior muestra el badge "Modo Offline" con el conteo de registros pendientes. | Persistencia local con SQLite (React Native) o IndexedDB (web mobile). Los catálogos (fincas, cuarteles activos, tipos de labor) deben descargarse al hacer login y actualizarse en cada sincronización exitosa. Usar Service Worker para la versión web mobile. |
| El Capataz agrega una labor al formulario | El sistema permite agregar múltiples labores para el mismo cuartel y fecha dentro del mismo formulario. Cada labor incluye: tipo de labor (selector del catálogo local) y opcionalmente insumos (HU-13). El botón "Agregar otra labor" permite añadir más filas sin guardar el formulario. | El formulario es multi-labor (no una labor por formulario). Validar que se haya seleccionado al menos una labor antes de habilitar el botón "Guardar (Local)". |
| El Capataz confirma el registro presionando "Guardar (Local)" | El sistema persiste el registro en el almacenamiento local con: UUID generado en el dispositivo, datos del formulario, timestamp de creación local, userId del Capataz y estado_sync = "pendiente". El badge del contador de pendientes incrementa en 1. No se muestra spinner de carga de red. | UUID v4 generado en el cliente para garantizar idempotencia en la sincronización. El campo estado_sync puede ser: pendiente \| sincronizado \| error. Incluir marca de tiempo ISO 8601 con timezone local. |
| El dispositivo recupera conexión a internet | El sistema detecta el cambio de conectividad automáticamente y dispara el proceso de sincronización (HU-14) en segundo plano. El Capataz puede continuar usando la app sin interrupciones durante la sincronización. | Usar el event listener "online" del browser / NetInfo en React Native para detectar reconexión. La sincronización es en segundo plano y no bloquea la UI. |

## Endpoints relacionados

- `POST /api/registro-labor`
- `POST /api/registro-labor/sync`

## Notas / decisiones

- El detector de conectividad y la persistencia local (SQLite/IndexedDB) son responsabilidad del cliente (Web/Mobile), no de este repo. Implementado en `src/modules/registro-labor`.
