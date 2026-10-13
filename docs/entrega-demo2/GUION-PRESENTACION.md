# Guion de presentación — Demo 2 (≈ 12 min)

Reparto: **P** = Paula Alvarado · **S** = Sergio Farias. Tener abiertos: el PDF, https://terravid.web.app (Propietario), la app en un teléfono (Capataz) y SonarCloud.

| Min | Quién | Qué se muestra | Apoyo |
|---|---|---|---|
| 0–1 | P | Qué es TerraVid y qué trae esta entrega: las 7 actividades de la Etapa 6 | README del PDF |
| 1–2 | P | **Matriz de trazabilidad**: módulos → HU → entidad → pantalla → estado. Las 36 HU están probadas y la columna de evidencia apunta al test de cada una | 01 |
| 2–4 | S | **Análisis estático**: por qué ESLint/oxlint más SonarCloud, la configuración comentada y el cuadro antes/después (2 → 111 ocultos → 0). Panel de SonarCloud | 03 + SonarCloud |
| 4–5 | S | **Arquitectura**: diagrama de componentes, protocolos, tecnologías y entornos (desarrollo / CI / producción) | 02 |
| 5–9 | P + S | **Demo en vivo = PRU-03 a PRU-06**: el Capataz carga una labor y un pesaje en el teléfono → la Web los muestra en el historial, el costeo y los pesajes → una lectura del sensor fuera de umbral genera una alerta y una notificación | Teléfono + Web |
| 9–10 | S | **Seguridad**: el Capataz no entra a Usuarios (PRU-07), la API responde 403 (PRU-08) y el Auditor no entra a la app (PRU-09). Mencionar DEF-01, encontrado y corregido | 07 |
| 10–11 | P | **Manual del Propietario**: login, navegación y reportes. **Capacitación**: tabla por rol | 04, 05 |
| 11–12 | P | **Implementación**: método piloto más fases, cronograma, carga inicial, contingencia y rollback | 06 |

**Preguntas probables**
- *¿Por qué piloto y no directa?* La vendimia no admite cortes: si algo falla, se pierde la trazabilidad de la cosecha.
- *¿Qué pasa sin señal?* Todo se guarda en el teléfono y se sincroniza al volver la conexión (PRU-03, HU-14).
- *¿Cómo se revierte un despliegue?* Se vuelve a la imagen anterior por SHA y, si hace falta, se restaura el backup diario (06 §8).
