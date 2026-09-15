import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * Contrato OpenAPI de la API.
 *
 * El backend es consumido por tres clientes que se construyen en repositorios
 * aparte (Web, Mobile, IoTSensor). Sin un contrato publicado, cada uno
 * reconstruye a mano los DTOs leyendo el código de acá, y las tres copias
 * divergen apenas cambie un campo. Esto lo genera una sola vez desde los DTOs
 * que ya existen.
 *
 * El grueso del documento sale del plugin de `@nestjs/swagger` configurado en
 * `nest-cli.json`, que lee los tipos, la opcionalidad, los `enum`, los
 * decoradores de class-validator y —con `introspectComments`— los comentarios
 * JSDoc de cada propiedad. Lo que se escribe a mano es lo que el plugin no
 * puede deducir: los esquemas de seguridad y el texto de arriba.
 *
 * Los `@ApiTags` de cada controlador tienen que coincidir con los nombres de
 * `TAGS`; el orden de esta lista es el orden en que se muestran.
 */

/** Áreas funcionales, en el mismo orden y con los mismos nombres que `docs/specs/README.md`. */
const TAGS: ReadonlyArray<{ nombre: string; descripcion: string }> = [
  {
    nombre: 'Auth y seguridad',
    descripcion:
      'Login con bloqueo por intentos fallidos, logout con revocación de token, ' +
      'recuperación y cambio de contraseña. HU-01 a HU-04.',
  },
  {
    nombre: 'Usuarios y roles',
    descripcion:
      'ABM de usuarios, perfil propio, asignación de fincas y cambio de rol. ' +
      'HU-04, HU-05 y HU-06.',
  },
  {
    nombre: 'Auditoría',
    descripcion:
      'Consulta del log de auditoría. Es de solo lectura: un trigger de base ' +
      'rechaza UPDATE, DELETE y TRUNCATE, y el rol de la aplicación no tiene ' +
      'más que SELECT e INSERT. HU-07.',
  },
  {
    nombre: 'Cartografía',
    descripcion:
      'Fincas y cuarteles: la jerarquía espacial sobre la que cuelga todo lo ' +
      'demás, más los datos para mapa y la búsqueda. HU-08 a HU-11.',
  },
  {
    nombre: 'Operaciones y costeo',
    descripcion:
      'Registro de labores con sincronización offline idempotente, insumos ' +
      'utilizados, costeo con vigencias históricas y margen bruto. ' +
      'HU-12 a HU-17.',
  },
  {
    nombre: 'Telemetría IoT',
    descripcion:
      'Sensores, ingesta de lecturas, series para gráficos, umbrales y ' +
      'alertas. La ingesta se autentica con API key, no con JWT. HU-18 a HU-22.',
  },
  {
    nombre: 'Vendimia',
    descripcion:
      'Cuadrillas y tarifas, pesaje diario, liquidación automática, remitos y ' +
      'su circuito de aprobación, y estado de cosecha por cuartel. ' +
      'HU-23 a HU-28.',
  },
  {
    nombre: 'Inteligencia agronómica',
    descripcion:
      'Correlación entre telemetría y costos, recomendaciones por reglas y ' +
      'comparación entre campañas. HU-29 a HU-31.',
  },
  {
    nombre: 'Dashboard y configuración',
    descripcion:
      'Indicadores clave, campañas, parámetros generales, catálogos maestros, ' +
      'notificaciones y centro de ayuda. HU-32 a HU-36.',
  },
];

const DESCRIPCION = `
API REST de **TerraVid**, ERP agrícola de trazabilidad desde la plantación hasta
la vendimia.

### Autenticación

Todas las rutas exigen JWT salvo las marcadas como públicas. Se obtiene con
\`POST /api/auth/login\` y viaja en \`Authorization: Bearer <token>\`. Dura 8
horas.

La ingesta de telemetría es la excepción: los nodos ESP32 no pueden sostener una
sesión de usuario, así que \`POST /api/lecturas-iot\` se autentica con una API
key estática en el header \`X-Api-Key\`.

### Autorización

El control de acceso es **fail-closed**: un endpoint que no declare explícitamente
qué roles lo usan queda denegado para todos. Los roles son Propietario, Capataz,
Agrónomo y Auditor.

### Aislamiento entre empresas

Toda consulta se acota por la empresa del usuario autenticado siguiendo la cadena
\`cuartel → finca → empresa\`. **Un recurso de otra empresa responde 404, no
403**: confirmar que existe ya sería una filtración.

### Errores

Las respuestas de error tienen siempre la misma forma:

\`\`\`json
{
  "statusCode": 409,
  "path": "/api/campanias",
  "timestamp": "2026-09-15T12:00:00.000Z",
  "message": "El rango se superpone con otra campaña de la empresa."
}
\`\`\`

Las violaciones de constraint de PostgreSQL se traducen a un 4xx con un mensaje
de dominio; no llegan como 500 ni exponen nombres de tablas.

### Sincronización offline

La app móvil opera contra SQLite y sincroniza al recuperar conectividad. Los
endpoints \`/sync\` son **idempotentes por \`localUuid\`**: reintentar el envío
de un registro ya sincronizado no lo duplica.
`;

/**
 * Monta la documentación y devuelve la ruta donde quedó, o \`null\` si está
 * deshabilitada.
 *
 * Queda **apagada en producción** salvo que se pida explícitamente con
 * \`OPENAPI_ENABLED=true\`: el documento describe el perímetro de ataque
 * completo —cada ruta, cada campo y qué rol la puede usar— y no hay razón para
 * publicarlo junto a la API. Para generar clientes alcanza con levantarla en
 * desarrollo o correr \`npm run openapi:generar\`.
 */
export function configurarOpenApi(app: INestApplication): string | null {
  const habilitada =
    process.env.OPENAPI_ENABLED === 'true' ||
    (process.env.OPENAPI_ENABLED !== 'false' &&
      process.env.NODE_ENV !== 'production');

  if (!habilitada) {
    return null;
  }

  const documento = construirDocumentoOpenApi(app);

  const ruta = 'api/docs';
  SwaggerModule.setup(ruta, app, documento, {
    // El JSON crudo es lo que consumen los generadores de cliente de Web y
    // Mobile; la UI es para leer.
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: {
      // Que el token sobreviva al refresco de la página: sin esto hay que
      // volver a pegarlo en cada recarga.
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
    },
  });

  return ruta;
}

/**
 * Arma el documento. Separado de `configurarOpenApi` porque
 * `npm run openapi:generar` lo escribe a un archivo sin montar la UI ni
 * levantar el servidor.
 */
export function construirDocumentoOpenApi(
  app: INestApplication,
): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('TerraVid API')
    .setDescription(DESCRIPCION)
    .setVersion(process.env.npm_package_version ?? '0.0.1')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token devuelto por POST /api/auth/login.',
      },
      'jwt',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Api-Key',
        in: 'header',
        description:
          'Clave del canal de dispositivos, solo para la ingesta de telemetría.',
      },
      'api-key-iot',
    )
    .build();

  const documento = SwaggerModule.createDocument(app, config, {
    // Sin esto, dos DTOs con el mismo nombre de clase en módulos distintos se
    // pisan en el documento y uno de los dos queda mal descrito.
    operationIdFactory: (controlador, metodo) => `${controlador}_${metodo}`,
  });

  // Los tags se agregan después de generar: el documento ya trae los nombres
  // usados por los `@ApiTags`, y acá se les pone la descripción y el orden.
  documento.tags = TAGS.map((t) => ({
    name: t.nombre,
    description: t.descripcion,
  }));

  return documento;
}
