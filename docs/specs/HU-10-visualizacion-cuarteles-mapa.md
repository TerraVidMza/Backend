# HU-10 — Visualización de cuarteles de finca en mapa

| Campo | Valor |
|---|---|
| **Actor** | Propietario, Agrónomo o Capataz |
| **Área** | Cartografía y topología |
| **Módulo backend** | `src/modules/fincas`, `src/modules/cuarteles` |
| **Entidad principal** | `CUARTEL`, `FINCA` |
| **Prioridad** | Media |
| **Complejidad** | Media |
| **Precondiciones** | HU-09 completado (al menos un cuartel activo) |
| **Pantallas (Figma)** | PAN-14: Visor de Mapa Satelital de la Finca — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** Cuartel no tiene latitud/longitud, así que es imposible posicionar los marcadores. El estado siempre es null, sin colores por estado. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Criterios (2026-08-25):** `Cuartel` ya tiene **`latitud` y `longitud`**, que era lo que impedía posicionar los marcadores, y la máquina de estados de HU-28 alimenta los colores. Se modelan como columnas y no como `geometry`: hoy no hay ninguna consulta espacial que lo justifique.

## Descripción

Como **Propietario, Agrónomo o Capataz**
Quiero **visualizar la distribución de cuarteles de una finca en un mapa**
Para **orientarme espacialmente dentro de la finca y acceder rápidamente a la información de cada cuartel.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El usuario accede al mapa de una finca | El sistema carga un mapa interactivo usando Leaflet con tiles de OpenStreetMap. Cada cuartel activo aparece como un marcador posicionado. Los marcadores se colorean según el estado del cuartel (Pendiente: gris, En cosecha: amarillo, Cosechado: verde). El mapa es funcional desde web y mobile. | En esta versión los cuarteles se muestran como marcadores puntuales (no polígonos). La edición de polígonos queda para versión posterior. Usar coordenadas del centro de la finca como punto inicial del mapa. |
| El usuario toca o hace clic en un marcador de cuartel | Se despliega un panel lateral o popup con los metadatos básicos del cuartel: nombre, variedad, clon, año de implantación, sistema de conducción, superficie y estado actual. | El popup debe incluir un enlace/botón "Ver detalle" que navegue al módulo de operaciones del cuartel. |
| La finca seleccionada no tiene cuarteles cargados | El mapa se muestra vacío (sin marcadores) y se superpone el mensaje "Esta finca no tiene cuarteles registrados. Agrega cuarteles desde la sección correspondiente." | Mostrar el mapa igualmente (no ocultar el componente) para mantener consistencia de la interfaz. |

## Endpoints relacionados

- `GET /api/fincas/:id`
- `GET /api/cuarteles` (filtrado por finca)

## Notas / decisiones

- El backend de este repo no gestiona geometrías/polígonos aún (PostGIS está habilitado en la BD pero no explotado por esta HU). Verificar en `Web`/`Mobile` el estado real del componente de mapa.
