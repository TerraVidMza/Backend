# Registro de Decisiones

Bitácora de decisiones de arquitectura y discrepancias entre el diseño documentado y la implementación real, para que no se pierdan en el historial de commits ni en conversaciones. Cada entrada: contexto, decisión y estado.

---

## D-001 — Framework de Backend: Express → NestJS

**Contexto:** el diseño original de [`ARCHITECTURE.md`](ARCHITECTURE.md) especificaba **Node.js + Express.js** como framework del Backend API.

**Decisión:** la implementación real, ya construida en la rama `backend` (5 commits, módulos de auth/usuarios/fincas/cuarteles/registro de labores funcionando), usa **NestJS (v11) + TypeORM** en su lugar. Se adopta el código como fuente de verdad: `ARCHITECTURE.md` fue actualizado para reflejar NestJS/TypeORM.

**Estado:** ✅ Vigente.

---

## D-002 — Rama `backend` fuera del flujo Gitflow

**Contexto:** [`CONTRIBUTING.md`](../CONTRIBUTING.md) establece que toda rama `feature/` parte de `develop` y se integra de nuevo en `develop` vía Pull Request. La rama `backend` (con el scaffold NestJS y los módulos ya mencionados en D-001) se ramificó directamente del *Initial commit* del repositorio, no de `develop`, y sus commits nunca se integraron vía PR.

**Decisión:** se documenta como pendiente. Antes de sumar nuevos módulos sobre `backend`, se recomienda abrir un Pull Request `backend → develop`, revisando que no haya conflictos con lo que `develop` ya incorporó de forma independiente (por ejemplo `CONTRIBUTING.md`, que no existe en `backend`).

**Estado:** ⚠️ Pendiente — requiere acción del equipo antes de continuar el desarrollo sobre esa rama.
