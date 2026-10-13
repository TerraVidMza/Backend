# TerraVid — Entrega Demo 2 · Etapa 6: Desarrollo e Implementación

**Universidad Tecnológica Nacional · Facultad Regional Mendoza · Ingeniería en Sistemas de Información · Proyecto Final**
Integrantes: **Paula Alvarado · Sergio Farias** · Sistema: **TerraVid** · Fecha: 13/10/2026

Sistema en producción:
- Web: https://terravid.web.app
- App móvil (PWA): https://terravid-app.web.app
- API: https://terravid-api.duckdns.org/api

Repositorios: `github.com/TerraVidMza/{Backend, Web, Mobile, IoTSensor}`.

## Contenido

El orden sigue el de las actividades de la consigna de la Etapa 6.

| # | Actividad de la consigna | Documento |
|---|---|---|
| 1 | Codificación del sistema: matriz de trazabilidad con estado de codificación | [01-matriz-trazabilidad.md](01-matriz-trazabilidad.md) |
| 2 | Análisis estático del código: herramienta, configuración comentada, ejecución y antes/después | [03-analisis-estatico.md](03-analisis-estatico.md) |
| 3 | Definición de la arquitectura del sistema: diagrama, tecnologías y entornos | [02-arquitectura.md](02-arquitectura.md) |
| 4 | Planificación, ejecución y documentación de pruebas: 9 pruebas PRU-01 a PRU-09 | [07-pruebas.md](07-pruebas.md) |
| 5 | Manual de usuario, rol Propietario | [04-manual-usuario-propietario.md](04-manual-usuario-propietario.md) |
| 6 | Planificación de la capacitación | [05-plan-capacitacion.md](05-plan-capacitacion.md) |
| 7 | Planificación de la implementación | [06-plan-implementacion.md](06-plan-implementacion.md) |

La versión consolidada en un solo archivo es **`TerraVid-Demo2-Etapa6.pdf`**, que se genera a partir de estos documentos.

## Resumen de resultados

- **Matriz de trazabilidad:** las 36 historias de usuario tienen código y al menos una prueba automatizada que las cubre.
- **Análisis estático:**
  - ESLint en el Backend pasó de 2 errores a 0. Al corregir la configuración, aparecieron y se corrigieron 111 problemas que antes quedaban ocultos.
  - oxlint en la Web: 0 errores.
  - `tsc` estricto en los tres repositorios: 0 errores.
  - SonarCloud quedó configurado en los tres repositorios.
- **Pruebas:**
  - 9 de 9 aprobadas: 4 funcionales, 2 de integración y 3 de seguridad.
  - Se encontró y corrigió un defecto (DEF-01, recomendaciones agronómicas).
  - Suites automáticas: Backend 423 tests, Web 246 tests con 83,9 % de cobertura de líneas, Mobile 189 tests y 4 flujos Maestro.
- **Implementación:** método piloto seguido de expansión por fases, con rollback probado (imagen por SHA y backup diario en Cloud Storage).

## Cómo se generaron las evidencias

Las capturas del manual y de las pruebas salen del sistema real (build de `main`), en una base de datos aislada creada para la ocasión con migraciones, seed y datos de demostración. Así no se tocaron los datos de producción. Los pasos se automatizaron con Playwright para que las evidencias sean reproducibles. El detalle está en [07-pruebas.md §1.3](07-pruebas.md).
