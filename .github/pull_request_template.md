## Qué cambia y por qué

<!-- El problema primero, la solución después. Si el porqué no entra acá,
     probablemente va a DECISIONS.md. -->

## Cómo se verificó

<!-- Qué corriste y qué dio. "Pasan los tests" no alcanza si el cambio toca
     algo que los tests no cubren: decilo. -->

- [ ] `npm test`
- [ ] `npm run test:e2e` (necesita la base levantada y migrada)
- [ ] `npm run test:smoke` (necesita además la API corriendo)
- [ ] Probado a mano: <!-- qué endpoint, con qué rol, con qué datos -->

## Trazabilidad

- HU relacionada: <!-- HU-XX, o "ninguna" si es trabajo interno -->
- [ ] Actualicé el campo **Estado** de la spec en `docs/specs/`
- [ ] Registré la decisión en `docs/DECISIONS.md` si el código se aparta del diseño

## Antes de pedir revisión

- [ ] El esquema cambió → hay migración generada, y la corrí
- [ ] Endpoint nuevo → tiene `@Roles(...)` o `@AnyRole()` decidido a conciencia
      (sin eso queda denegado: el RBAC es fail-closed)
- [ ] Endpoint nuevo → acota por empresa, y un recurso ajeno responde 404
- [ ] Variable de entorno nueva → está en `.env.example` y en `validarEntorno`
