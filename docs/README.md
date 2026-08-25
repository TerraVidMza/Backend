# Documentación técnica — TerraVid Backend

| Documento | Contenido | Cuándo consultarlo |
|---|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Diagrama de arquitectura, tecnologías por componente, entornos de ejecución (dev/staging/producción) y estado de implementación. | Para entender cómo están (o van a estar) conectados los componentes del sistema, y qué está construido hoy. |
| [`DECISIONS.md`](DECISIONS.md) | Bitácora de decisiones de arquitectura y discrepancias resueltas entre el diseño y el código real. | Para entender *por qué* algo cambió respecto al diseño original, o qué queda pendiente de resolver. |
| [`DESPLIEGUE.md`](DESPLIEGUE.md) | Runbook de despliegue en Google Cloud (Cloud Run + Cloud SQL): arquitectura elegida, las restricciones del código que fijan la configuración, y el paso a paso con los comandos. | Para poner la API en producción, o para entender por qué el deploy va con `--no-cpu-throttling` y una sola instancia. |
| [`REFERENCES.md`](REFERENCES.md) | Puente al documento maestro del proyecto (UTN FRM): historias de usuario, modelo de datos, cronograma. | Cuando necesites el requerimiento funcional completo de una historia de usuario o el diagrama Entidad-Relación. |
| [`specs/`](specs/README.md) | Especificación funcional completa de cada Historia de Usuario (HU-01 a HU-36): criterios de aceptación, entidad, módulo backend y pantalla de Figma. **Hub de especificaciones de los 4 repos del proyecto** (Backend, Web, Mobile, IoTSensor), no solo de este. | Para el detalle de implementación y seguimiento de una funcionalidad puntual, y para ver qué pantalla de Figma corresponde a cada HU. |

Ver también [`../CONTRIBUTING.md`](../CONTRIBUTING.md) para la política de branching del repositorio.
