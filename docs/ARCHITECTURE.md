# TerraVid - Arquitectura del Sistema y Entornos de Ejecución

Documento técnico correspondiente a la fase inicial de **Codificación del Sistema (Etapa 6)** del proyecto TerraVid: ERP agrícola para la trazabilidad integral desde la plantación hasta la vendimia.

---

## 1. Diagrama de Arquitectura del Sistema

TerraVid adopta una **arquitectura en capas desacoplada y orientada a servicios (API-First)**, soportando un esquema de cliente híbrido (Web y Mobile), procesamiento asíncrono para operaciones críticas/pesadas mediante colas en memoria, y una red de telemetría IoT de integración vertical nativa.

### 1.1. Diagrama Conceptual de Comunicación entre Componentes

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CAPA DE CLIENTES                                      │
│                                                                                         │
│   ┌────────────────────────────────┐                 ┌──────────────────────────────┐   │
│   │     Frontend Web (Oficina)     │                 │   Mobile App (Campo / Offline)│   │
│   │   (Propietario / Agrónomo)     │                 │   (Capataz / Operarios)      │   │
│   │   - Dashboard, Finanzas, ABMs  │                 │   - Registro Labores / Kilos │   │
│   │   - Visualización Mapas / IoT  │                 │   - SQLite / Local Storage   │   │
│   └───────────────┬────────────────┘                 └──────────────┬───────────────┘   │
└───────────────────┼─────────────────────────────────────────────────┼───────────────────┘
                    │ HTTPS / REST (JSON) + JWT                       │ HTTPS / REST Sync
                    │                                                 ▼ (Idempotente / UUID)
┌───────────────────┼─────────────────────────────────────────────────────────────────────┐
│                   ▼                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                       REVERSE PROXY / GATEWAY (NGINX)                           │   │
│   │                     - Terminación SSL / TLS (HTTPS/MQTTS)                       │   │
│   │                     - Rate Limiting / Firewall (CORS / Headers)                 │   │
│   └───────────────────────────────────────┬─────────────────────────────────────────┘   │
│                                           │                                             │
│                                   CAPA DE SERVICIOS                                     │
│                                           │                                             │
│   ┌───────────────────────────────────────▼─────────────────────────────────────────┐   │
│   │                           BACKEND API (Node.js / Express)                       │   │
│   │   - Módulos: Auth (RBAC), Cartografía, Costeo, Vendimia, Auditoría              │   │
│   │   - Endpoints RESTful para clientes Web / Mobile                                │   │
│   │   - Ingesta de Telemetría IoT (Endpoint HTTP/MQTTS con API Key) ◄── Nodos IoT   │   │
│   │   - Scheduler (Cron Jobs: Consolidación nocturna IoT 00:00 hs)                  │   │
│   └───────────────┬───────────────────────┬─────────────────────────┬───────────────┘   │
│                   │                       │                         │                   │
└───────────────────┼───────────────────────┼─────────────────────────┼───────────────────┘
                    │                       │                         │
     SQL Queries /  │         Pub/Sub / Jobs│                         │ Push / Mail / Maps
     PostGIS Ext    │         Asíncronos    │                         │
                    ▼                       ▼                         ▼
┌──────────────────────────────┐  ┌─────────────────────┐  ┌──────────────────────────────┐
│       BASE DE DATOS          │  │  COLA DE TAREAS &   │  │     SERVICIOS EXTERNOS       │
│     PostgreSQL + PostGIS     │  │       CACHÉ         │  │                              │
│  - Relacional (3NF)          │  │    Redis + BullMQ   │  │ - Google Maps / Leaflet      │
│  - Tablas Maestras           │  │  - Sync de labores  │  │   (Capa Satelital / Tiles)   │
│  - LECTURA_IOT (Activa 24h)  │  │    en ráfaga        │  │ - Firebase (FCM Push Notif.) │
│  - LECTURA_IOT_HISTORICO     │  │  - Disparo de       │  │ - SMTP / Nodemailer (Emails) │
│  - LOG_AUDITORIA (Inmutable) │  │    alertas IoT      │  │                              │
│  - Transaccional / Spatials  │  │  - Envío asíncrono  │  │                              │
└──────────────────────────────┘  └─────────────────────┘  └──────────────────────────────┘

                                   ┌─────────────────────┐
                                   │    RED DE NODOS     │
                                   │   SENSORES IoT      │
                                   │  (ESP32 + Sensores) │
                                   │  Tensión Hídrica,   │
                                   │  Temp/Humedad Suelo │
                                   └─────────┬───────────┘
                                             │ MQTTS / TLS
                                             ▼
                        (conecta directamente al BACKEND API, ver flecha "◄── Nodos IoT"
                         en el bloque de arriba — no a la Base de Datos, Cola de Tareas
                         ni Servicios Externos, que son alimentados por el Backend)
```

> **Nota de corrección (revisión previa a incorporación):** en la versión original de este diagrama, la flecha de los Nodos IoT quedaba dibujada debajo de la columna "SERVICIOS EXTERNOS" sin conectar visualmente con el Backend, lo que podía inducir a pensar que el IoT se comunica directo con Servicios Externos. Se corrigió la posición y se agregó la referencia explícita `◄── Nodos IoT` en la caja del Backend API para eliminar la ambigüedad, de acuerdo con el flujo descrito en la sección 1.2, punto 3.

### 1.2. Flujo de Comunicación e Integración
1. **Frontend Web $\leftrightarrow$ Backend:** Comunicación vía peticiones HTTPS/RESTful con carga útil en JSON. Autenticación gestionada mediante tokens **JWT (HS256)** con expiración de 8 horas, transmitidos en cookies `httpOnly` o cabeceras seguras y validados a nivel de middleware con verificación de permisos por rol (RBAC).
2. **Mobile App $\leftrightarrow$ Backend:** Arquitectura *Offline-First*. El capataz opera directamente contra una base de datos local (**SQLite**). Al recuperar conectividad (detectada en $\le 5$ segundos), la app sincroniza en segundo plano enviando paquetes con `local_uuid` (para asegurar idempotencia) y marcas de tiempo `created_at` (resolución de conflictos por "última escritura gana").
3. **Nodos IoT $\leftrightarrow$ Backend:** Dispositivos microcontroladores ESP32 transmiten lecturas edáficas y microclimáticas mediante **MQTTS / HTTPS** seguro, autenticándose mediante una `API Key` estática en las cabeceras de la petición. La conexión llega directamente al Backend (endpoint de ingesta), no a la base de datos ni a los servicios externos.
4. **Backend $\leftrightarrow$ Colas de Tareas (Redis / BullMQ):** Los flujos de alta concurrencia o procesamiento diferido (pico de sincronización vespertino de partes de campo, evaluación de umbrales/alertas IoT y envío de emails) se delegan a workers asíncronos en Redis con reintentos automáticos y backoff exponencial.
5. **Persistencia y Optimización:** El motor relacional centralizado (**PostgreSQL**) administra las entidades de negocio. Para mantener un rendimiento óptimo y evitar degradación por acumulación masiva de filas, un **Cron Job** (`node-cron`) ejecuta diariamente a las 00:00 hs la consolidación de lecturas horarias promedio desde `LECTURA_IOT` hacia `LECTURA_IOT_HISTORICO`.

---

## 2. Tecnologías de cada Componente

Las tecnologías han sido seleccionadas en estricta coherencia con el análisis de factibilidad técnica (Etapa 3), el plan de capacitación cruzada y los requerimientos funcionales del aplicativo híbrido:

| Componente | Capa / Tipo | Lenguaje | Framework / Librerías Clave | Motor de Datos / Middleware | Justificación Técnica |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Frontend Web** | Web Desktop / Responsive | **JavaScript / TypeScript** | **React (v18+)** + Vite, Chart.js, Leaflet / Google Maps API | N/A (Consumo de APIs REST) | Renderizado reactivo del Dashboard gerencial, gráficos dinámicos de correlación IoT vs. costos y visualización interactiva de mapas topológicos. |
| **Aplicación Mobile** | Mobile Híbrida Cross-Platform | **JavaScript / TypeScript** | **React Native (v0.71+) / Expo** | **SQLite** (Persistencia local en dispositivo) | Soporte nativo para funcionamiento *Offline-First* en viñedos, UI empática adaptada a luz solar/uso con guantes y sincronización asíncrona. |
| **Backend API** | Servidor de Lógica de Negocio | **JavaScript / Node.js (v18+)** | **Express.js**, `node-cron`, `jsonwebtoken`, `bcrypt` | **BullMQ** (Procesamiento asíncrono) | E/S no bloqueante de alto rendimiento, unificación del stack JavaScript, gestión centralizada de endpoints RESTful y tareas programadas de consolidación. |
| **Base de Datos Central** | Persistencia Relacional y Espacial | **SQL** | Extensión **PostGIS** | **PostgreSQL (v15+)** | Consistencia transaccional ACID, normalización 3NF para costeo directo, almacenamiento de geometrías espaciales y log de auditoría inmutable. |
| **Caché y Colas** | Broker en Memoria | N/A | **BullMQ** | **Redis** | Desacoplamiento de tareas críticas en memoria RAM, absorción de ráfagas concurrentes de sincronización móvil y despacho de alertas. |
| **Nodo IoT** | Firmware Embebido | **C / C++ (C++11+)** | **ESP-IDF / Arduino Framework** | Protocolo **MQTT / MQTTS (v5.0 *a validar*)** | Microcontrolador ESP32 WROOM/S3 de bajo consumo con sensores DHT22 y de humedad de suelo capacitivo, optimizado para alimentación solar/batería LiPo. |

> **Nota de corrección (revisión previa a incorporación):** la versión de MQTT quedó marcada como *"a validar"* porque el soporte de **MQTT v5.0** depende de si el firmware se implementa sobre **ESP-IDF nativo** (que sí lo soporta) o sobre **Arduino Framework** con librerías como PubSubClient (que en general solo soportan **MQTT v3.1.1**). Debe confirmarse en la etapa de desarrollo de firmware cuál de los dos frameworks se utiliza para cerrar esta definición.

---

## 3. Definición de Entornos de Ejecución

El ciclo de desarrollo y despliegue del sistema se organiza en tres entornos bajo la metodología de ramificación **Gitflow**:

```text
  [ Local / Desarrollo ]       ──────►      [ Staging / QA ]       ──────►      [ Producción ]
(Laptops Devs / Emuladores)            (VPS Staging / develop branch)       (VPS Cloud / main branch)
```

### 3.1. Entorno de Desarrollo (Localhost / Development)
* **Propósito:** Codificación activa de módulos, diseño de componentes UI y pruebas unitarias por el equipo de desarrollo.
* **Infraestructura y Ejecución:**
  * **Laptops de desarrollo:** Entornos locales de los integrantes del equipo.
  * **Backend API & Workers:** Ejecución local con Node.js — API REST en `http://localhost:3000` y dashboard/monitor de Workers (BullMQ) en `http://localhost:5000`.
  * **Frontend Web:** Servidor de desarrollo local con Vite/React (`http://localhost:5173`).
  * **Mobile:** Entorno Expo / Emulador Android Studio / Dispositivos físicos conectados mediante Expo Go en red local.
  * **Bases de Datos & Redis:** Instancias locales de PostgreSQL 15 (con extensión PostGIS) y Redis ejecutadas en local o mediante contenedores Docker locales.
  * **IoT:** Nodos ESP32 de laboratorio/banco de prueba apuntando a endpoints locales simulados o mockers de telemetría GeoJSON para no consumir cuotas de servicios cloud.

### 3.2. Entorno de Pruebas y Validación (Staging / QA)
* **Propósito:** Auditoría y verificación de calidad a cargo del rol de QA. Ejecución de pruebas integrales E2E (Cypress), validación de endpoints y contratos de API (Postman), pruebas de carga/concurrencia (JMeter) y validación previa a Demos técnicas.
* **Infraestructura y Ejecución:**
  * Servidor VPS de Pruebas alimentado automáticamente desde la rama `develop`.
  * Base de datos PostgreSQL de Staging con datos semilla (*fixtures* y escenarios de simulación de vendimia).
  * Monitoreo de logs y verificación de políticas de branch y aprobación de Pull Requests.

### 3.3. Entorno de Producción (Production / Release)
* **Propósito:** Versión final estable, segura y operativa accesible para los roles finales en la finca (Propietario, Agrónomo, Capataz y Auditor).
* **Infraestructura y Ejecución:**
  * **Cloud Hosting:** Servidor Privado Virtual (**VPS Linux**).
  * **Reverse Proxy / Web Server:** **Nginx** configurado con certificados criptográficos **SSL/TLS (HTTPS)** para terminación segura y proxy reverso hacia el proceso Node.js administrado por PM2.
  * **Base de Datos Productiva:** **PostgreSQL v15 + PostGIS** en servidor cloud con políticas de *backup* diario automatizado.
  * **Servidor Redis:** Instancia segura en producción para la gestión de colas activas con BullMQ.
  * **Frontend Web:** Servido a través de Nginx como Single Page Application (SPA) optimizada.
  * **Aplicación Mobile:** Binarios compilados (APK / AAB) distribuidos mediante **Google Play Store Console** y soporte iOS mediante **App Store Connect**.
  * **Red IoT en Campo:** Nodos físicos ESP32 montados en mástiles de cuarteles con gabinete estanco IP65, paneles solares de 5V y baterías LiPo, transmitiendo directamente al VPS productivo.
