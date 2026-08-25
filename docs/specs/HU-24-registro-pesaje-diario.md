# HU-24 — Registro de pesaje diario

| Campo | Valor |
|---|---|
| **Actor** | Capataz |
| **Área** | Logística de vendimia |
| **Módulo backend** | `src/modules/pesaje-vendimia` |
| **Entidad principal** | `CUADRILLA_COSECHA`, `PESAJE_VENDIMIA` |
| **Prioridad** | Alta |
| **Complejidad** | Alta |
| **Precondiciones** | HU-23 (cuadrilla activa con tarifa asignada) y HU-09 (cuartel activo) |
| **Pantallas (Figma)** | PAN-12: Consola de Pesaje de Vendimia (Mobile/Web) — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** sin CHECK a nivel de BD sobre el peso, y el maestro de transportes no existe, por lo que su criterio es inimplementable. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Cierre (2026-08-25):** el CHECK `peso_kg > 0` ya está en la base (F2-1). **Pendiente:** el criterio del límite máximo del transporte necesita un **maestro de transportes que no existe** en el modelo ([D-b](PLAN-MEJORAS.md)). Hay que crearlo o descopear el criterio; como está, no es implementable.
>
> **Descope (2026-08-26):** ✅ **se descopeó el criterio del maestro de transportes** ([D-016](../DECISIONS.md)). El pesaje diario es *el total cosechado por una cuadrilla en la jornada* y no un viaje de camión: validarlo contra la capacidad de un transporte mezcla dos conceptos distintos, y un cuartel con dos camiones daría un falso error. Con eso HU-24 queda cubierta.

## Descripción

Como **Capataz**
Quiero **registrar el total de kilos cosechados por una cuadrilla al cierre del día**
Para **documentar la productividad y habilitar el cálculo de liquidación.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El Capataz accede al formulario de registro de pesaje | El formulario funciona en modo offline. Muestra selectores para: cuadrilla (solo activas, del catálogo local), cuartel (solo activos de la finca, del catálogo local) y fecha (date picker, por defecto hoy). El campo peso acepta solo números positivos con hasta 2 decimales. | El formulario offline usa el mismo mecanismo de SQLite/IndexedDB que HU-12. Los catálogos de cuadrillas y cuarteles deben incluirse en la descarga inicial al login. |
| El Capataz ingresa un peso de 0 kg o negativo | El sistema muestra un error en línea "El peso debe ser mayor a 0 kg" y deshabilita el botón de confirmación. | Validación en el cliente (inmediata) y en el servidor (al sincronizar). El campo peso_kg tiene un CHECK constraint > 0 en la BD. |
| El Capataz confirma el registro de pesaje | El pesaje se guarda localmente con estado_sync = "pendiente", UUID generado en el dispositivo, y todos los datos del formulario incluyendo la tarifa vigente de la cuadrilla al momento del registro. El sistema calcula y muestra el monto de liquidación estimado: peso_kg × tarifa_vigente. | Almacenar la tarifa vigente en el registro local para garantizar consistencia incluso si la tarifa cambia antes de la sincronización. Al sincronizar, el servidor valida y puede corregir la tarifa si hubo cambios. |
| El mismo cuartel tiene múltiples pesajes en el mismo día | El sistema permite registrar múltiples pesajes por cuartel/cuadrilla/día sin restricciones. El total de kg del día para ese cuartel es la suma de todos los pesajes individuales. | No hay límite de pesajes por cuartel/día. El formulario de generación de remito (HU-26) agrupa todos los pesajes del día para el cuartel. |
| ~~El Capataz ingresa un peso para el transporte~~ **(descopeado)** | ~~El sistema valida que el peso sea mayor a 0kg y menor o igual al límite máximo físico configurado en el maestro de transportes.~~ | ⛔ **Fuera de alcance** por [D-016](../DECISIONS.md): el pesaje es el total de la jornada, no un viaje, y el criterio de arriba admite varios pesajes por cuartel y día. Si hiciera falta, el lugar es el remito (HU-26/27), que sí es un despacho concreto. |

## Endpoints relacionados

- `POST /api/pesajes-vendimia`
- `POST /api/pesajes-vendimia/sync`

## Notas / decisiones

- Implementado en `src/modules/pesaje-vendimia`. Ruta real en plural: `/pesajes-vendimia`.
