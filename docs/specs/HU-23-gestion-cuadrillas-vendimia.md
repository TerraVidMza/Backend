# HU-23 — Gestión de cuadrillas de vendimia

| Campo | Valor |
|---|---|
| **Actor** | Propietario o Capataz |
| **Área** | Logística de vendimia |
| **Módulo backend** | `src/modules/cuadrillas` |
| **Entidad principal** | `CUADRILLA_COSECHA` |
| **Prioridad** | Alta |
| **Complejidad** | Baja |
| **Precondiciones** | HU-08 completado (finca activa) |
| **Pantallas (Figma)** | PAN-12: Consola de Pesaje de Vendimia (Mobile/Web) — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** la regla de ignorar la tarifa cuando la manda un Capataz no existe. La tarifa es retro-datable y el desempate de vigencia no es determinista. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Criterios (2026-08-25):** el nombre de cuadrilla es único **por finca y entre activas**, con índice parcial.
>
> **Cierre (2026-08-25):** cerrados los tres puntos de la auditoría: la tarifa que manda un Capataz se ignora (F0-6), la vigencia no admite retro-datado y el desempate es determinista por `createdAt` (F1-12).

## Descripción

Como **Propietario o Capataz**
Quiero **registrar y gestionar las cuadrillas que participan en la vendimia**
Para **tener un registro organizado de equipos y tarifas para calcular liquidaciones.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El Propietario crea una nueva cuadrilla | El formulario requiere: nombre de la cuadrilla (obligatorio, 2-100 chars, único entre cuadrillas activas), cantidad de integrantes (entero positivo, obligatorio) y tarifa a destajo en $/kg (decimal positivo, obligatorio para el Propietario). Al guardar, la cuadrilla queda activa y disponible para registrar pesajes. | La tarifa se almacena con fecha de vigencia (campo `valid_from`) para auditoría histórica. Registrar alta en log de auditoría. |
| Un Capataz crea una nueva cuadrilla | El formulario muestra los mismos campos excepto la tarifa a destajo, que no es visible ni editable para el Capataz. La cuadrilla se crea sin tarifa y el Propietario debe asignarla posteriormente para habilitar el cálculo de liquidación. | El backend verifica el rol del usuario antes de procesar el campo tarifa. Si un Capataz intenta enviar el campo tarifa mediante manipulación del request, el backend lo ignora. |
| El Propietario modifica la tarifa a destajo de una cuadrilla | El sistema crea un nuevo registro de tarifa con la fecha de hoy como `valid_from`, sin modificar los registros de tarifa anteriores. Los pesajes ya registrados con la tarifa anterior no se modifican. | Misma lógica de versionado que los costos de labores e insumos (HU-16). El pesaje almacena la tarifa vigente al momento de su creación (HU-25). |
| El usuario da de baja una cuadrilla | La cuadrilla cambia a estado "inactiva" (baja lógica) y deja de aparecer en el formulario de registro de pesaje. Sus registros históricos de pesajes y liquidaciones se conservan íntegros. | No es posible dar de baja una cuadrilla con pesajes sin remito confirmado en la campaña actual (mostrar advertencia). |

## Endpoints relacionados

- `GET /api/cuadrillas`, `GET /api/cuadrillas/:id`
- `POST /api/cuadrillas`
- `PATCH /api/cuadrillas/:id`
- `PATCH /api/cuadrillas/:id/desactivar`
- `GET /api/cuadrillas/:id/tarifas`, `POST /api/cuadrillas/:id/tarifas`

## Notas / decisiones

- Implementado en `src/modules/cuadrillas`.
