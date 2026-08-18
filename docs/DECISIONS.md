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

**Decisión:** se abrió y mergeó el Pull Request `backend → develop` ([#4](https://github.com/TerraVidMza/Backend/pull/4)), integrando los 5 commits de `backend` a `develop`.

**Estado:** ✅ Resuelto. Nota post-merge: el merge automático de `README.md` concatenó ambas versiones del archivo en vez de reconciliarlas (quedó una sección "Stack" duplicada y una nota desactualizada); se corrigió aparte consolidando el contenido en un único README coherente.
