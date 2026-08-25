# HU-25 — Cálculo automático de liquidación

| Campo | Valor |
|---|---|
| **Actor** | Sistema |
| **Área** | Logística de vendimia |
| **Módulo backend** | `src/modules/pesaje-vendimia` |
| **Entidad principal** | `PESAJE_VENDIMIA` |
| **Prioridad** | Alta |
| **Complejidad** | Baja |
| **Precondiciones** | HU-24 completado (pesaje sincronizado con tarifa vigente) |
| **Pantallas (Figma)** | ⚠️ Pendiente — no está en la matriz de trazabilidad. Es lógica de sistema; probablemente no tiene pantalla propia (los resultados se muestran en PAN-12/PAN-13). |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** el write-once es correcto, pero un pesaje sin tarifa vigente se guarda con monto null y estado SINCRONIZADO. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Cierre (2026-08-25):** cerrado el único hueco que marcaba la auditoría: un pesaje sin tarifa vigente ya no se guarda con monto `null` y estado SINCRONIZADO, se marca ERROR (F1-3). Antes entraba al remito con kilos y sin liquidación.

## Descripción

Como **sistema**
Quiero **calcular el monto de liquidación de una cuadrilla al confirmar su pesaje**
Para **evitar cálculos manuales y garantizar la consistencia.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El pesaje sincronizado es procesado por el servidor | El sistema calcula: `monto_liquidacion = kg_totales × tarifa_vigente_al_momento_del_pesaje`. El resultado se almacena en el registro del pesaje como campo calculado persistente. La tarifa utilizada también se almacena en el registro para auditoría futura. | La tarifa utilizada es la vigente al momento del pesaje (`valid_from` más reciente con fecha <= fecha del pesaje), no la tarifa actual. Almacenar: kg_totales, tarifa_utilizada, monto_liquidacion como campos persistentes en la tabla pesajes. |
| La tarifa de la cuadrilla cambia después de que un pesaje fue registrado | El monto de liquidación almacenado en pesajes históricos no se modifica. El nuevo costo aplica solo a pesajes registrados a partir de la fecha de vigencia de la nueva tarifa. | El `monto_liquidacion` es un campo write-once: se calcula al crear el pesaje y nunca se recalcula automáticamente. Solo un Propietario puede corregirlo manualmente con registro en auditoría. |
| El monto calculado es visible en la interfaz | El monto de liquidación aparece en: el detalle del pesaje individual, el resumen del cuartel en el panel de estado de cosecha (HU-28), y el borrador del remito (HU-26). Se muestra con 2 decimales en la moneda configurada en HU-33. | Formatear el monto con el símbolo de moneda configurado (ej: $ 1.250,50). Usar la librería de formateo de números del frontend para consistencia. |

## Endpoints relacionados

- Sin endpoint propio — la lógica corre dentro de `POST /api/pesajes-vendimia` y `POST /api/pesajes-vendimia/sync`.

## Notas / decisiones

- Implementado en `src/modules/pesaje-vendimia`.
