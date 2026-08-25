# HU-18 — Registro y asociación de sensores

| Campo | Valor |
|---|---|
| **Actor** | Propietario |
| **Área** | Telemetría IoT |
| **Módulo backend** | `src/modules/sensores` |
| **Entidad principal** | `SENSOR_IOT` |
| **Prioridad** | Alta |
| **Complejidad** | Baja |
| **Precondiciones** | HU-08 completado (finca activa existente) |
| **Pantallas (Figma)** | PAN-11: Configuración de Dispositivos IoT — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** el listado no trae la última lectura (requisito central), devuelve 400 en vez de 409 al duplicar código, el update no revalida unicidad. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Criterios (2026-08-25):** el listado trae la **última lectura de cada sensor** resuelta con un único `DISTINCT ON` —era el N+1 que forzaba al front—, el alta duplicada devuelve 409 y el `update` revalida la unicidad del código.

## Descripción

Como **Propietario**
Quiero **dar de alta un sensor físico en el sistema y asociarlo a una finca**
Para **que el sistema pueda recibir e identificar correctamente sus lecturas.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El Propietario completa el formulario de registro de sensor | El formulario requiere: código único del sensor (obligatorio, alfanumérico, 4-50 chars, único en el sistema), tipo de sensor (selector del catálogo: temperatura, humedad suelo, humedad ambiente, precipitaciones, viento), finca asignada (selector de fincas activas) y descripción (texto libre opcional, máx 200 chars). Al guardar, el sensor queda activo. | El código del sensor debe coincidir exactamente con el identificador configurado en el hardware físico. Constraint UNIQUE en columna codigo_sensor. Registrar alta en log de auditoría. |
| El Propietario intenta registrar un sensor con un código que ya existe en el sistema | El sistema devuelve HTTP 409 con el mensaje "Ya existe un sensor con el código [código]. Los códigos de sensor son únicos en el sistema." | Verificar unicidad en el servidor (no solo en el cliente). El código es case-sensitive ya que debe coincidir con el hardware. |
| El Propietario consulta el listado de sensores de una finca | El sistema muestra: código, tipo, descripción, estado (activo/inactivo) y la última lectura recibida (valor, unidad y timestamp). Si el sensor no ha enviado lecturas aún, muestra "Sin lecturas". | La última lectura se obtiene mediante un JOIN o subconsulta sobre la tabla de lecturas, ordenada por timestamp DESC LIMIT 1. Mostrar tiempo transcurrido desde la última lectura ("Hace 5 min", "Hace 2 hs"). |
| El Propietario desactiva un sensor | El sensor cambia a estado "inactivo". Deja de aparecer en el panel de telemetría activa (HU-20) y no genera alertas (HU-22). Sus lecturas históricas se conservan y son accesibles en la vista de historial. | Baja lógica: campo estado en la tabla sensores. El endpoint de ingesta de lecturas (HU-19) debe rechazar lecturas de sensores inactivos con HTTP 403. |

## Endpoints relacionados

- `GET /api/sensores`, `GET /api/sensores/:id`
- `POST /api/sensores`
- `PATCH /api/sensores/:id`
- `PATCH /api/sensores/:id/desactivar`

## Notas / decisiones

- Implementado en `src/modules/sensores`.
