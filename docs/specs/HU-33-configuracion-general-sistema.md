# HU-33 — Configuración general del sistema

| Campo | Valor |
|---|---|
| **Actor** | Propietario |
| **Área** | Dashboard y configuración |
| **Módulo backend** | `src/modules/configuracion` |
| **Entidad principal** | `CATALOGO_ITEM`, `CONFIGURACION` |
| **Prioridad** | Media |
| **Complejidad** | Baja |
| **Precondiciones** | HU-01 completado (sesión activa como Propietario) |
| **Pantallas (Figma)** | PAN-16: Parámetros del Sistema y Precios Base — [archivo Figma](https://www.figma.com/design/0ehP6Sf8WynahpnKUGIVpd/TerraVid---Wireframes---Design-System-v1) |
| **Estado** | 🟢 COMPLETA — criterios de aceptación cubiertos |

> **Auditoría (2026-08-24):** la tabla configuracion no tiene empresaId (es global a la instancia), GET devuelve smtp_pass en texto plano y ninguna clave está seedeada. Ver [plan de mejoras](PLAN-MEJORAS.md).
>
> **Fase 2 (2026-08-24):** las claves `nombre_organizacion`, `moneda`, `unidades`, `zona_horaria`, `support_email` y `smtp_*` **ya se seedean** (F2-4): antes ninguna existía, y por eso el correo de soporte nunca salía. El SMTP por empresa lo consume `MailService`. Los cambios de configuración quedan auditados.
>
> **Criterios (2026-08-25):** la clave `zona_horaria` ya se consume: gobierna el agrupamiento diario y horario de las series de sensores (HU-20) y la alineación de los pares de correlación (HU-29). Se valida contra `pg_timezone_names` antes de usarla, para que un valor mal cargado caiga al default en vez de romper la consulta.

## Descripción

Como **Propietario**
Quiero **ajustar los parámetros generales del sistema**
Para **adaptar el comportamiento a mi organización sin intervención técnica.**

## Criterios de aceptación

| Cuando | Espero | Notas técnicas / referencias |
|---|---|---|
| El Propietario modifica el nombre de la organización | El nuevo nombre aparece en el encabezado de la aplicación y en los documentos generados (remitos) en la siguiente actualización de la interfaz. La modificación se registra en el log de auditoría. | Tabla configuracion con estructura clave-valor: `{ clave: "nombre_organizacion", valor: "TerraVid S.A." }`. Invalidar caché del nombre en el cliente al recibir confirmación de guardado. |
| El Propietario modifica la moneda del sistema | El nuevo símbolo de moneda se aplica a todos los campos de dinero del sistema (margen bruto, liquidaciones, costos) en la siguiente carga de esos componentes. Los valores históricos almacenados en BD no cambian (solo cambia el formato de presentación). | La moneda es el símbolo de presentación (ej: "$", "€", "USD"). No es un conversor de divisas. Los números se almacenan sin el símbolo; el símbolo se aplica al renderizar. |
| El Propietario modifica las unidades de medida o la zona horaria | Los cambios aplican inmediatamente al guardar y se reflejan en toda la interfaz sin necesidad de cerrar sesión. La zona horaria afecta la presentación de timestamps en logs, alertas y reportes. | Zona horaria en formato IANA (ej: "America/Argentina/Mendoza"). Todos los timestamps se almacenan en UTC en la BD y se convierten al mostrar usando la zona horaria configurada. |
| Un usuario con rol que no es Propietario intenta acceder a la pantalla de configuración | El sistema devuelve HTTP 403 y el menú lateral no muestra la opción "Configuración" para ningún rol que no sea Propietario. | Control de acceso en frontend (ocultar menú) y en backend (middleware de autorización). El Propietario es el único con acceso a `/configuracion`. |

## Endpoints relacionados

- `GET /api/configuracion`
- `GET /api/configuracion/:clave`
- `PUT /api/configuracion`

## Notas / decisiones

- Implementado en `src/modules/configuracion`. Comparte pantalla PAN-16 con HU-16 (Parámetros del Sistema y Precios Base).
