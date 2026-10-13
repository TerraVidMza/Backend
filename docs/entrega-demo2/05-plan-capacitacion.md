# Plan de capacitación — TerraVid

**Proyecto Final — UTN FRM — Etapa 6**
Integrantes: Paula Alvarado · Sergio Farias

---

## 1. A quiénes hay que capacitar

Los destinatarios salen de los roles del modelo funcional, tal como están implementados en el sistema (`src/common/enums/rol.enum.ts` y la tabla de permisos `src/common/permisos/permisos.ts`). Cada rol ve en la Web y en la app móvil solo lo que su permiso habilita, así que la capacitación se arma por rol y no por módulo.

| Rol | Perfil típico | Qué usa | Qué puede hacer (según el código) | Cantidad típica por cliente |
|---|---|---|---|---|
| **Administrador de plataforma** | Personal del equipo TerraVid | Web (*Empresas*) | Dar de alta, editar, activar y desactivar empresas cliente y su primer Propietario. No ve datos de las empresas ni entra a la app móvil. | 1 (equipo TerraVid) |
| **Propietario** | Dueño o gerente de la finca/bodega | Web (principal) y app móvil | Todo dentro de su empresa: usuarios y roles, fincas, cuarteles, catálogos, tipos de labor e insumos, campañas y metas, cuadrillas y tarifas, sensores y umbrales, aprobación y liquidación de remitos, dashboard, inteligencia agronómica, configuración y auditoría. | 1 – 2 |
| **Agrónomo** | Ingeniero agrónomo o encargado técnico | Web (principal) y app móvil | Cuarteles (alta y edición), tipos de labor e insumos con costos, telemetría y umbrales, registro de labores y pesajes, edición de cuadrillas, aprobación de remitos, inteligencia agronómica. No administra usuarios ni fincas. | 1 – 3 |
| **Capataz** | Responsable de cuadrilla en el campo | App móvil (APK o PWA), sin señal | Registrar labores e insumos utilizados, registrar pesajes de vendimia, dar de alta cuadrillas, consultar cuarteles e historial de labores; todo offline con sincronización automática. No ve costos ni telemetría. | 2 – 10 |
| **Auditor** | Contador, certificadora o auditor externo | Web (solo lectura) | Consultar fincas, cuarteles, historial de labores, campañas, dashboard y log de auditoría. Los costos se filtran del payload (D-021). | 0 – 1 |

---

## 2. Plan de capacitación

Modalidades: **presencial** (en la finca o en la oficina del cliente, con equipo propio), **video** (grabación corta, 3 a 8 minutos, para repasar después) y **demo** (demostración guiada en vivo sobre el sistema en producción, presencial o remota).

| # | Tema | Rol destinatario | Modalidad | Duración | Material | Responsable |
|---|---|---|---|---|---|---|
| 1 | Alta de empresa y primer Propietario; activar/desactivar empresas | Administrador de plataforma | Demo | 20 min | Sección *Administrador de plataforma* de `DESPLIEGUE.md` | Sergio Farias |
| 2 | Ingreso al sistema, cambio de contraseña obligatorio, recuperación de contraseña y perfil | Todos | Video | 5 min | Video 1 · Manual de usuario §1 | Paula Alvarado |
| 3 | Recorrido general de la Web: dashboard, notificaciones y Centro de Ayuda | Propietario, Agrónomo, Auditor | Demo | 30 min | Manual de usuario · Video 2 | Paula Alvarado |
| 4 | Alta de usuarios, asignación de roles y asignación a fincas; log de auditoría | Propietario | Presencial | 30 min | Manual de usuario (Usuarios, Auditoría) | Paula Alvarado |
| 5 | Datos maestros: fincas, cuarteles (con ubicación en el mapa), catálogos, tipos de labor e insumos, campañas y metas de cosecha | Propietario, Agrónomo | Presencial | 60 min | Manual de usuario (Fincas, Maestros, Campañas) | Sergio Farias |
| 6 | Sensores IoT: alta, credencial MQTT, umbrales, gráficos y alertas | Propietario, Agrónomo | Demo | 30 min | Manual de usuario (Sensores) · `IOT-MQTT.md` | Sergio Farias |
| 7 | Vendimia en la Web: cuadrillas y tarifas, pesajes, liquidación, borrador y aprobación de remitos | Propietario, Agrónomo | Presencial | 45 min | Manual de usuario (Vendimia) · Video 3 | Paula Alvarado |
| 8 | Indicadores: margen bruto, comparación de campañas, correlación sensor/costos y recomendaciones | Propietario, Agrónomo | Demo | 30 min | Manual de usuario (Indicadores) | Sergio Farias |
| 9 | Instalación de la app (APK o PWA), inicio de sesión y primera sincronización | Capataz | Presencial | 20 min | Guía rápida del capataz · Video 4 | Sergio Farias |
| 10 | Registrar labores e insumos sin señal y verificar que sincronicen | Capataz | Presencial (en el cuartel) | 40 min | Guía rápida del capataz · Video 5 | Paula Alvarado |
| 11 | Registrar pesajes de vendimia, alta de cuadrillas e indicador de avance de cosecha | Capataz | Presencial (en el cuartel) | 40 min | Guía rápida del capataz · Video 6 | Paula Alvarado |
| 12 | Cambio de teléfono, respaldo de registros (*Ajustes → Respaldo*) y qué hacer si algo no sincroniza | Capataz | Video | 5 min | Guía rápida del capataz · Video 7 | Sergio Farias |
| 13 | Consultas de solo lectura: historial de labores, campañas y log de auditoría | Auditor | Demo (remota) | 20 min | Manual de usuario (Auditoría) | Paula Alvarado |

**Carga total por rol:** Propietario ≈ 3 h 50 min · Agrónomo ≈ 3 h 20 min · Capataz ≈ 1 h 50 min · Auditor ≈ 55 min · Administrador ≈ 25 min.

---

## 3. Cronograma (semana previa a la puesta en marcha)

D = día de inicio de operaciones (ver `06-plan-implementacion.md`).

| Día | Actividad | Temas | Destinatarios |
|---|---|---|---|
| D-7 | Envío de accesos, videos y manual; los usuarios cambian la contraseña inicial | 2 | Todos |
| D-6 | Sesión de administración (oficina) | 1, 3, 4 | Administrador, Propietario |
| D-5 | Sesión de datos maestros y sensores, cargando los datos reales del cliente | 5, 6 | Propietario, Agrónomo |
| D-4 | Sesión de vendimia e indicadores | 7, 8 | Propietario, Agrónomo |
| D-3 | Jornada de campo con capataces: instalación, labores y pesajes en modo avión | 9, 10, 11, 12 | Capataces (con el Agrónomo presente) |
| D-2 | Demo remota para el Auditor; evaluación práctica de todos los roles | 13 · checklist | Todos |
| D-1 | Repaso de dudas y recuperación de quienes no aprobaron el checklist | — | Según resultado |

---

## 4. Materiales

| Material | Contenido | Destinatario | Estado |
|---|---|---|---|
| Manual de usuario (`docs/entrega-demo2/04-manual-usuario-propietario.md`) | Uso completo de la Web por pantalla | Propietario, Agrónomo, Auditor | Base existente |
| Videos cortos (7) | Un video de 3 a 8 minutos por tarea, grabados sobre producción con una empresa de demostración | Según tema | A grabar en D-10 |
| Guía rápida del capataz | Hoja A4 plastificada: instalar, iniciar sesión, registrar labor, registrar pesaje, cómo saber si sincronizó, a quién llamar | Capataz | A producir en D-10 |
| Centro de Ayuda del sistema (HU-36) | Artículos dentro de la Web y el ticket de soporte | Todos | Disponible |

---

## 5. Evaluación (checklist práctico)

Cada participante realiza las tareas de su rol sobre el sistema en producción, con la empresa de demostración, bajo la observación del responsable. Se aprueba completando todas las tareas sin asistencia; quien no apruebe repite la sesión en D-1.

| Rol | Tarea a completar sin ayuda | ✔ |
|---|---|---|
| Todos | Iniciar sesión, cambiar la contraseña y cerrar sesión | ☐ |
| Propietario | Dar de alta un usuario Capataz y asignarlo a una finca | ☐ |
| Propietario | Crear un cuartel con variedad, superficie y ubicación, y verlo en el mapa | ☐ |
| Propietario / Agrónomo | Configurar un umbral de temperatura en un sensor y ver la serie de lecturas | ☐ |
| Propietario / Agrónomo | Generar el borrador de un remito y aprobarlo | ☐ |
| Propietario / Agrónomo | Leer en el dashboard el margen bruto de la campaña | ☐ |
| Capataz | Con el teléfono en modo avión, registrar una labor con un insumo y un pesaje | ☐ |
| Capataz | Volver a tener señal y comprobar que los dos registros figuran como sincronizados | ☐ |
| Capataz | Exportar un respaldo desde *Ajustes → Respaldo* | ☐ |
| Auditor | Encontrar en el log de auditoría quién modificó un cuartel determinado | ☐ |

Además se registra, por sesión, una encuesta breve de tres preguntas (claridad, utilidad, dudas pendientes); las dudas repetidas se convierten en artículos del Centro de Ayuda.
