# Referencias

## Documento maestro: "Proyecto Final - TerraVid" (UTN FRM)

El proyecto TerraVid nace como Proyecto Final de carrera (UTN FRM). Existe un documento maestro (Google Docs) que es la **fuente de verdad académica y funcional** — requerimientos, historias de usuario, modelo de datos, factibilidad, riesgos y cronograma. La documentación técnica de este repositorio (carpeta `docs/`) es un recorte vivo de ese documento, que debe mantenerse sincronizado con el código a medida que se construye, pero no lo reemplaza.

> El enlace al documento lo mantiene el equipo del proyecto (Google Docs, acceso restringido) — pedirlo a quien administre el repositorio si no lo tenés.

### Qué contiene el documento maestro

El documento organiza el proyecto en 7 etapas (Planificación, Organización, Factibilidad, Definición de Requerimientos, Diseño, Desarrollo e Implementación, Documentación). `docs/ARCHITECTURE.md` corresponde puntualmente a la Etapa 6 (Desarrollo e Implementación).

### Historias de Usuario (HU-01 a HU-36)

| Módulo | Rango HU | Cobertura |
|---|---|---|
| Autenticación y seguridad | HU-01 a HU-07 | Login, recuperación de contraseña, gestión de usuarios, auditoría |
| Cartografía y topología | HU-08 a HU-11 | ABM de fincas/cuarteles, mapas interactivos |
| Operaciones y costeo | HU-12 a HU-17 | Registro offline, sincronización, márgenes brutos |
| Telemetría IoT | HU-18 a HU-22 | Sensores, ingesta, monitoreo, umbrales, alertas |
| Logística de vendimia | HU-23 a HU-28 | Cuadrillas, pesaje, liquidación, remitos |
| Inteligencia agronómica | HU-29 a HU-31 | Correlaciones sensor-costos, recomendaciones |
| Dashboard y configuración | HU-32 a HU-36 | Indicadores, tablas maestras, notificaciones |

Cada HU incluye criterios de aceptación en formato checklist dentro del documento maestro.

### Anexos

- **Anexo 1:** Diagrama de Gantt (cronograma de 38 semanas).
- **Anexo 2:** Diagrama Entidad-Relación (modelo de datos completo — incluye tablas como `REGISTRO_LABOR`, `LECTURA_IOT`, `PESAJE_VENDIMIA`, `LOG_AUDITORIA`, ya referenciadas en [`ARCHITECTURE.md`](ARCHITECTURE.md)).
