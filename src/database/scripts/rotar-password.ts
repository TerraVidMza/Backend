import 'reflect-metadata';
import { config as cargarEnv } from 'dotenv';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

cargarEnv();

/**
 * Rota la contraseña de un usuario y lo obliga a cambiarla al entrar.
 *
 * Existe por un caso concreto: el seed creaba, también en producción, un
 * Propietario con la contraseña que está escrita en el README. Es la cuenta que
 * puede crear todas las demás, así que era la llave del sistema publicada en el
 * repositorio. El seed ya no puede hacerlo —pide `SEED_PROPIETARIO_PASSWORD`—,
 * pero eso no arregla las cuentas **ya creadas**: para eso es este script.
 *
 *     ROTAR_EMAIL='propietario@terravid.demo' \
 *     ROTAR_PASSWORD='<contraseña nueva, generada>' \
 *     npm run db:rotar-password
 *
 * Desde el contenedor desplegado, que es donde vive la base de producción:
 *
 *     docker compose -f docker-compose.prod.yml run --rm -T \
 *       -e ROTAR_EMAIL -e ROTAR_PASSWORD api npm run db:rotar-password:dist
 *
 * **No se puede hacer con un UPDATE a mano.** La columna guarda un hash de
 * bcrypt con el costo que fija `BCRYPT_SALT_ROUNDS`; escribir la contraseña en
 * claro dejaría la cuenta inaccesible —y la contraseña legible para cualquiera
 * con lectura sobre la tabla—.
 *
 * Sale con código 1 si algo no se cumple, así que sirve encadenado a un paso de
 * despliegue.
 */

const EMAIL = process.env.ROTAR_EMAIL;
const PASSWORD = process.env.ROTAR_PASSWORD;

/** La misma política que exige la API (`password-segura.validator.ts`). */
const LARGO_MINIMO = 8;
const LARGO_MAXIMO = 72; // bcrypt trunca en silencio a 72 bytes.

interface FilaUsuario {
  id: string;
  email: string;
  activo: boolean;
}

function validar(): { email: string; password: string } {
  if (!EMAIL) {
    throw new Error('Falta ROTAR_EMAIL: el correo del usuario a rotar.');
  }
  if (!PASSWORD) {
    throw new Error(
      'Falta ROTAR_PASSWORD. No hay valor por defecto a propósito: una ' +
        'contraseña conocida no es una contraseña.',
    );
  }
  if (PASSWORD.length < LARGO_MINIMO) {
    throw new Error(
      `ROTAR_PASSWORD debe tener al menos ${LARGO_MINIMO} caracteres.`,
    );
  }
  if (PASSWORD.length > LARGO_MAXIMO) {
    throw new Error(
      `ROTAR_PASSWORD no puede superar los ${LARGO_MAXIMO} caracteres: ` +
        'bcrypt trunca lo que sobra sin avisar.',
    );
  }
  if (!/[a-zA-Z]/.test(PASSWORD) || !/[0-9]/.test(PASSWORD)) {
    throw new Error(
      'ROTAR_PASSWORD debe incluir al menos una letra y al menos un número.',
    );
  }
  return { email: EMAIL, password: PASSWORD };
}

async function rotar(): Promise<void> {
  const { email, password } = validar();

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  await dataSource.initialize();

  try {
    const filas = await dataSource.query<FilaUsuario[]>(
      'SELECT id, email, activo FROM usuarios WHERE email = $1',
      [email],
    );

    const usuario = filas[0];
    if (!usuario) {
      throw new Error(`No existe ningún usuario con el correo "${email}".`);
    }

    const hash = await bcrypt.hash(
      password,
      parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10),
    );

    await dataSource.query(
      `UPDATE usuarios
          SET password_hash = $2,
              debe_cambiar_password = true,
              intentos_fallidos = 0,
              bloqueado_hasta = NULL,
              updated_at = now()
        WHERE id = $1`,
      [usuario.id, hash],
    );

    console.log(`Contraseña rotada para ${usuario.email}.`);
    console.log('El usuario entra obligado a cambiarla en el primer acceso.');
    if (!usuario.activo) {
      console.log('Ojo: la cuenta está desactivada, así que no podrá entrar.');
    }

    // Las sesiones abiertas siguen siendo válidas: el JWT ya emitido no
    // depende de la contraseña, y `token_revocado` se llena por `jti` en el
    // logout, así que no hay forma de enumerar los tokens vivos de un usuario.
    // Duran 8 horas. Si hace falta cortarlas ya, hay que rotar JWT_SECRET, que
    // invalida las de todo el mundo.
    console.log(
      'Las sesiones ya abiertas de ese usuario siguen válidas hasta 8 horas.',
    );
  } finally {
    await dataSource.destroy();
  }
}

rotar().catch((error: Error) => {
  console.error('No se pudo rotar la contraseña:', error.message);
  process.exit(1);
});
