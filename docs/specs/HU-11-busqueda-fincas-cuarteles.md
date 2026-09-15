# HU-11 — Búsqueda de fincas y cuarteles

| Campo | Valor |
|---|---|
| **Actor** | Propietario, Agrónomo o Capataz |
| **Área** | Cartografía y topología |
| **Módulo backend** | `src/modules/fincas`, `src/modules/cuarteles` |
| **Entidad principal** | `FINCA`, `CUARTEL` |
| **Prioridad** | Media |
| **Complejidad** | Baja |
| **Precondiciones** | HU-08 y HU-09 completados |
| **Pantallas (Figma)** | PAN-14: Visor de Mapa Satelital de la Finca — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** sin búsqueda en cuarteles, sin filtros por variedad/estado/año, sin ordenamiento configurable y sin paginación. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Criterios (2026-08-25):** ✅ implementada: `GET /cuarteles/buscar` atraviesa toda la empresa con búsqueda por nombre, filtros de variedad, estado y año, orden configurable por lista blanca y paginación. `GET /cuarteles/variedades` devuelve las variedades presentes en una finca para poblar el filtro.
>
> **Alcance del Auditor (2026-08-26):** ambos endpoints suman al Auditor, que no es actor de esta HU pero necesita llegar al cuartel del historial de [HU-17](HU-17-historial-labores-cuartel.md). Ver [D-021](../DECISIONS.md#d-021--el-auditor-lee-fincas-y-cuarteles-los-costos-se-filtran-del-payload).

## Descripción

Como **Propietario, Agrónomo o Capataz**
Quiero **buscar y filtrar fincas y cuarteles por distintos criterios**
Para **encontrar rápidamente la entidad que necesito operar sin tener que recorrer listados largos.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El usuario escribe texto en el campo de búsqueda de fincas o cuarteles | El sistema filtra el listado mostrando solo los registros cuyo nombre contiene el texto ingresado (búsqueda parcial, case-insensitive). El filtrado ocurre en tiempo real con debounce de 300ms. Sobre el listado se muestra "[N] resultado(s) encontrado(s)". | En modo offline (mobile), la búsqueda opera sobre los datos locales almacenados en SQLite/IndexedDB. En modo online, puede ser una query al backend con ILIKE. |
| El usuario aplica filtros sobre el listado de cuarteles | Los filtros disponibles son: variedad (selector multi-opción con valores del catálogo), estado (selector: Pendiente/En cosecha/Cosechado/Inactivo) y año de implantación (rango desde/hasta). Los filtros son acumulativos. | El filtro de variedad muestra solo las variedades presentes en los cuarteles de la finca seleccionada, no todo el catálogo. |
| El usuario ordena los resultados | El sistema permite ordenar por nombre (A-Z, Z-A), variedad (A-Z) o estado. El orden seleccionado persiste mientras el usuario permanece en la pantalla. | Listados paginados: 20 registros por página por defecto con controles de paginación estándar (anterior, siguiente, número de página). |

## Endpoints relacionados

- `GET /api/fincas`
- `GET /api/cuarteles`

## Notas / decisiones

- Pendiente confirmar en `fincas.service.ts` / `cuarteles.service.ts` si ya soportan query params de búsqueda/filtro/orden, o si falta agregarlos.
