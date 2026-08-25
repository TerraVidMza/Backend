import 'reflect-metadata';
import { config as cargarEnv } from 'dotenv';
import { cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import {
  diagnosticarCredenciales,
  modoFcm,
  resolverCredenciales,
  VARIABLES_FIREBASE,
} from './credenciales-firebase';

/**
 * Verifica que el push a Firebase esté bien configurado (HU-35, D-015).
 *
 *     npm run push:diagnostico                # sin token: valida credenciales
 *     npm run push:diagnostico -- <token>     # con token: envía de verdad
 *
 * **Intenta la operación en vez de leer la configuración**, igual que
 * `db:verificar-privilegios`. Mirar las variables de entorno diría que están
 * puestas; solo un envío real dice si Firebase las acepta.
 *
 * Sin token de dispositivo manda contra uno deliberadamente inválido. Suena
 * raro, pero es la prueba que sirve: **si Firebase rechaza el token, es porque
 * la autenticación funcionó** y llegó hasta validarlo. Con credenciales malas el
 * error sería de autenticación y nunca se llegaría a mirar el token. Esa
 * distinción es todo lo que hace falta saber cuando todavía no existe la app
 * móvil.
 *
 * Sale con código 1 si la configuración no sirve, para encadenarlo al despliegue.
 */

const TOKEN_INVALIDO_DE_PRUEBA =
  'token-de-diagnostico-que-no-existe-en-firebase';

/** Un envío que no dispara nada visible si el token resultara ser real. */
const MENSAJE_DE_PRUEBA = {
  title: 'TerraVid — prueba de configuración',
  body: 'Si ves esto, el push está configurado correctamente.',
};

export interface Veredicto {
  /** `true` si las credenciales quedaron demostradas como válidas. */
  credencialesOk: boolean;
  /** `true` si además el mensaje llegó a un dispositivo real. */
  entregado: boolean;
  detalle: string;
  sugerencia?: string;
}

async function diagnosticar(): Promise<void> {
  const tokenObjetivo =
    process.argv[2] ?? process.env.PUSH_TOKEN_PRUEBA ?? null;

  console.log('Diagnóstico de push (Firebase Cloud Messaging)\n');

  // --- 1. Transporte
  if (!modoFcm()) {
    console.log(
      `  FALLA  PUSH_TRANSPORT=${process.env.PUSH_TRANSPORT ?? 'log'}`,
    );
    console.log(
      '         En modo "log" los envíos se escriben en consola y nunca salen.',
    );
    console.log(
      '         Poner PUSH_TRANSPORT=fcm para diagnosticar el envío real.',
    );
    process.exit(1);
  }
  console.log('  OK     PUSH_TRANSPORT=fcm');

  // --- 2. Variables presentes y bien formadas
  const problema = diagnosticarCredenciales();
  if (problema.faltantes.length > 0) {
    console.log(`  FALLA  faltan: ${problema.faltantes.join(', ')}`);
    console.log(
      '         Salen del JSON del service account: project_id, client_email y private_key.',
    );
    process.exit(1);
  }
  console.log(`  OK     las tres variables están definidas`);

  if (problema.claveMalFormada) {
    console.log(
      '  FALLA  FIREBASE_PRIVATE_KEY no parece una clave PEM completa',
    );
    console.log(
      '         Suele ser el copiado: la clave va en UNA línea con los \\n del JSON,',
    );
    console.log(
      '         entre comillas simples. Pegarla en varias líneas reales la trunca.',
    );
    process.exit(1);
  }
  console.log('  OK     FIREBASE_PRIVATE_KEY tiene forma de clave PEM');

  // --- 3. Inicialización del SDK
  const credenciales = resolverCredenciales();
  if (!credenciales) {
    console.log(
      `  FALLA  no se pudieron resolver ${VARIABLES_FIREBASE.join(', ')}`,
    );
    process.exit(1);
  }

  // Nombre propio para no chocar con la app por defecto si algo más la creó.
  const app = initializeApp(
    { credential: cert(credenciales) },
    'diagnostico-terravid',
  );
  console.log(`  OK     SDK inicializado (proyecto ${credenciales.projectId})`);

  // --- 4. Envío real
  const conTokenReal = tokenObjetivo !== null;
  console.log('');
  console.log(
    conTokenReal
      ? '  Enviando al token indicado...'
      : '  Enviando a un token inválido a propósito, para probar la autenticación...',
  );

  const veredicto = await intentarEnvio(
    app,
    tokenObjetivo ?? TOKEN_INVALIDO_DE_PRUEBA,
    conTokenReal,
  );

  await deleteApp(app);

  console.log('');
  console.log(
    `  ${veredicto.credencialesOk ? 'OK    ' : 'FALLA '} ${veredicto.detalle}`,
  );
  if (veredicto.sugerencia) {
    console.log(`         ${veredicto.sugerencia}`);
  }

  console.log('');
  if (!veredicto.credencialesOk) {
    console.log('La configuración de Firebase NO está lista.');
    process.exit(1);
  }
  if (veredicto.entregado) {
    console.log('Push configurado y entregado. Revisá el dispositivo.');
    return;
  }
  console.log(
    'Credenciales verificadas: Firebase acepta este service account.',
  );
  console.log(
    'Falta probar con un token de dispositivo real:  npm run push:diagnostico -- <token>',
  );
}

/**
 * Manda el mensaje e interpreta el resultado.
 *
 * La distinción que importa: un error **de token** demuestra que las
 * credenciales sirven, porque Firebase autenticó la petición antes de mirar el
 * destinatario. Un error de credenciales, en cambio, aparece antes.
 */
async function intentarEnvio(
  app: ReturnType<typeof initializeApp>,
  token: string,
  conTokenReal: boolean,
): Promise<Veredicto> {
  try {
    const id = await getMessaging(app).send({
      token,
      notification: MENSAJE_DE_PRUEBA,
      data: { tipo: 'diagnostico', urlAccion: '' },
    });

    if (!conTokenReal) {
      // Prácticamente imposible, pero si el token de relleno fuera aceptado, el
      // resultado sigue demostrando lo que se quería demostrar.
      return {
        credencialesOk: true,
        entregado: false,
        detalle: `Firebase aceptó el envío (${id}).`,
      };
    }
    return {
      credencialesOk: true,
      entregado: true,
      detalle: `Mensaje entregado a Firebase (${id}).`,
      sugerencia:
        'Que llegue al dispositivo depende además de los permisos de notificación de la app.',
    };
  } catch (error) {
    return interpretar(error, conTokenReal);
  }
}

/**
 * Exportada para poder testearla: el camino que más importa —credenciales
 * buenas, token de relleno rechazado— **no se puede ejercitar sin un service
 * account real**, así que se cubre desde acá con los errores que devuelve
 * Firebase en cada caso.
 */
export function interpretar(error: unknown, conTokenReal: boolean): Veredicto {
  const codigo = (error as { code?: string }).code ?? '';
  const mensaje = (error as Error).message ?? String(error);

  // Token rechazado: las credenciales funcionaron. Es el resultado esperado
  // cuando se diagnostica sin un dispositivo real.
  const tokenRechazado =
    codigo === 'messaging/invalid-registration-token' ||
    codigo === 'messaging/registration-token-not-registered' ||
    codigo === 'messaging/invalid-argument' ||
    /registration token/i.test(mensaje);

  if (tokenRechazado) {
    if (conTokenReal) {
      return {
        credencialesOk: true,
        entregado: false,
        detalle: 'Las credenciales funcionan, pero Firebase rechazó ese token.',
        sugerencia:
          'El token venció, es de otro proyecto de Firebase, o se copió incompleto. Pedí uno nuevo desde la app.',
      };
    }
    return {
      credencialesOk: true,
      entregado: false,
      detalle:
        'Firebase autenticó la petición y rechazó el token de relleno, que es lo esperado.',
    };
  }

  // El token pertenece a otro proyecto: credenciales válidas, proyecto cruzado.
  if (codigo === 'messaging/mismatched-credential') {
    return {
      credencialesOk: true,
      entregado: false,
      detalle: 'El token pertenece a OTRO proyecto de Firebase.',
      sugerencia:
        'La app móvil tiene que usar el mismo proyecto que este service account.',
    };
  }

  // Credenciales mal: es lo que este diagnóstico viene a detectar.
  if (
    codigo === 'app/invalid-credential' ||
    codigo === 'messaging/authentication-error' ||
    /invalid_grant|Invalid JWT|invalid_client|DECODER routines/i.test(mensaje)
  ) {
    return {
      credencialesOk: false,
      entregado: false,
      detalle: 'Firebase rechazó las credenciales.',
      sugerencia:
        'Revisá que las tres variables salgan del MISMO JSON y que la clave no esté truncada. Si la rotaste, la vieja deja de servir.',
    };
  }

  // La API de FCM apagada en el proyecto de Google Cloud.
  if (/PERMISSION_DENIED|has not been used|is disabled/i.test(mensaje)) {
    return {
      credencialesOk: false,
      entregado: false,
      detalle: 'El proyecto tiene la API de Cloud Messaging deshabilitada.',
      sugerencia:
        'Habilitar "Firebase Cloud Messaging API" en la consola de Google Cloud del proyecto.',
    };
  }

  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|network/i.test(mensaje)) {
    return {
      credencialesOk: false,
      entregado: false,
      detalle: 'No se pudo alcanzar Firebase.',
      sugerencia: 'Problema de red o de proxy saliente, no de configuración.',
    };
  }

  return {
    credencialesOk: false,
    entregado: false,
    detalle: `Error no reconocido${codigo ? ` (${codigo})` : ''}: ${mensaje}`,
  };
}

// Solo al invocarlo como script. Sin esta guarda, importar `interpretar` desde
// un test dispararía el diagnóstico completo —y su `process.exit`— al cargar el
// módulo, y además le metería el `.env` real al proceso de pruebas.
if (require.main === module) {
  cargarEnv();
  diagnosticar().catch((error: Error) => {
    console.error('El diagnóstico falló:', error.message);
    process.exit(1);
  });
}
