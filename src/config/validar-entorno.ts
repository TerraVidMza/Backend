/**
 * Validación de las variables de entorno al arrancar.
 *
 * Sin esto, una variable faltante no se nota hasta que alguien ejerce el camino
 * que la usa, y el error que llega no la nombra: sin `JWT_SECRET` el fallo
 * aparece dentro de passport-jwt, y sin `IOT_API_KEY` la ingesta devuelve 401 a
 * todos los nodos sin decir por qué. Los dos casos son un despliegue que
 * arrancó "bien" y está roto.
 *
 * Se valida a mano y no con un esquema de Joi o zod para no sumar una
 * dependencia por doce variables, y porque varias reglas de acá son condicionales
 * (`PUSH_TRANSPORT=fcm` exige el proyecto de Firebase) y quedan más claras escritas.
 */

/** Falla al arrancar si el entorno no alcanza para levantar la aplicación. */
export function validarEntorno(
  entorno: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const faltantes: string[] = [];
  const invalidas: string[] = [];
  /** No impiden arrancar: se avisan y la aplicación sigue. */
  const advertencias: string[] = [];

  const enProduccion = entorno.NODE_ENV === 'production';

  const requerida = (clave: string): string | undefined => {
    const valor = entorno[clave];
    if (!valor || valor.trim() === '') {
      faltantes.push(clave);
      return undefined;
    }
    return valor;
  };

  // --- base de datos -------------------------------------------------------
  requerida('DB_HOST');
  requerida('DB_USERNAME');
  requerida('DB_PASSWORD');
  requerida('DB_DATABASE');

  const puerto = entorno.DB_PORT;
  if (puerto && Number.isNaN(Number.parseInt(puerto, 10))) {
    invalidas.push(`DB_PORT="${puerto}" no es un número`);
  }

  // `synchronize` deduce el esquema de las entidades: un renombre de columna se
  // traduce a DROP + ADD y borra los datos sin avisar (D-007). En desarrollo es
  // una herramienta; en producción es una pérdida de datos esperando.
  if (enProduccion && entorno.DB_SYNCHRONIZE === 'true') {
    invalidas.push(
      'DB_SYNCHRONIZE=true en producción: el esquema lo gobiernan las migraciones (D-007)',
    );
  }

  // --- autenticación -------------------------------------------------------
  const secreto = requerida('JWT_SECRET');
  if (secreto && enProduccion && secreto.length < 32) {
    invalidas.push(
      `JWT_SECRET tiene ${secreto.length} caracteres: en producción se esperan al menos 32`,
    );
  }

  // Sin clave, `ApiKeyGuard` cierra la ingesta —es fail-closed a propósito— y
  // todos los nodos reciben 401. Es correcto, pero es un síntoma difícil de
  // diagnosticar desde el firmware; mejor no arrancar.
  requerida('IOT_API_KEY');

  const rondas = entorno.BCRYPT_SALT_ROUNDS;
  if (rondas && Number.isNaN(Number.parseInt(rondas, 10))) {
    invalidas.push(`BCRYPT_SALT_ROUNDS="${rondas}" no es un número`);
  }

  // --- CORS ----------------------------------------------------------------
  // Advertencia, **no** error. Esto tumbó un despliegue: se exigía como
  // obligatoria en producción, pero `DESPLIEGUE.md` A.12 documenta que hoy no
  // está definida ahí a propósito, porque todavía no hay frontend. La API no
  // arrancó, Caddy devolvió 502 y el despliegue se fue a rollback.
  //
  // El riesgo real ya lo cubre `main.ts`, que sin esta variable cierra el CORS
  // en producción en vez de abrirlo. Una variable que no hace falta para servir
  // no puede impedir arrancar: convierte una configuración incompleta en una
  // caída.
  if (enProduccion && !entorno.CORS_ORIGIN) {
    advertencias.push(
      'CORS_ORIGIN no está definida: ningún navegador va a poder consumir la ' +
        'API. Es lo correcto mientras no haya frontend; cuando lo haya, hay ' +
        'que definirla.',
    );
  }

  // --- transportes opcionales ----------------------------------------------
  // MQTT (D-026): opcional. Sin MQTT_URL la ingesta es solo HTTP; con ella,
  // la API se autentica contra el broker y administra las credenciales de los
  // sensores, así que necesita su usuario.
  if (entorno.MQTT_URL) {
    if (!/^mqtts?:\/\//.test(entorno.MQTT_URL)) {
      invalidas.push(
        `MQTT_URL="${entorno.MQTT_URL}" no empieza con mqtt:// ni mqtts://`,
      );
    }
    requerida('MQTT_USUARIO');
    requerida('MQTT_PASSWORD');
  }

  const push = entorno.PUSH_TRANSPORT ?? 'log';
  if (!['log', 'fcm'].includes(push)) {
    invalidas.push(`PUSH_TRANSPORT="${push}" no es 'log' ni 'fcm'`);
  }
  // FCM va sin clave en producción (D-033): con solo el proyecto, el SDK usa
  // la cuenta de servicio de la VM. La clave es opcional, pero si vino una de
  // sus dos partes tiene que venir la otra; es la misma regla que aplica
  // `resolverCredenciales`. Exigir las tres tumbó la API al pasar a sin clave.
  if (push === 'fcm') {
    requerida('FIREBASE_PROJECT_ID');
    if (entorno.FIREBASE_CLIENT_EMAIL || entorno.FIREBASE_PRIVATE_KEY) {
      requerida('FIREBASE_CLIENT_EMAIL');
      requerida('FIREBASE_PRIVATE_KEY');
    }
  }

  const mail = entorno.MAIL_TRANSPORT ?? 'log';
  if (!['log', 'smtp'].includes(mail)) {
    invalidas.push(`MAIL_TRANSPORT="${mail}" no es 'log' ni 'smtp'`);
  }
  if (mail === 'smtp') {
    for (const clave of ['SMTP_HOST', 'SMTP_PORT', 'MAIL_FROM']) {
      requerida(clave);
    }
  }

  for (const advertencia of advertencias) {
    // `console` y no el Logger de Nest: esto corre dentro de `ConfigModule`,
    // antes de que exista la aplicación.
    console.warn(`[entorno] ${advertencia}`);
  }

  if (faltantes.length === 0 && invalidas.length === 0) {
    return entorno;
  }

  const partes = ['La configuración del entorno no permite arrancar:'];
  if (faltantes.length > 0) {
    partes.push(`  Faltan: ${faltantes.join(', ')}`);
  }
  for (const problema of invalidas) {
    partes.push(`  ${problema}`);
  }
  partes.push('  Ver .env.example para el detalle de cada una.');

  throw new Error(partes.join('\n'));
}
