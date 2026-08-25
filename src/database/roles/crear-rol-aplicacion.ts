import 'reflect-metadata';
import { config as cargarEnv } from 'dotenv';
import { DataSource } from 'typeorm';

cargarEnv();

/**
 * Crea (o actualiza) el rol con el que se conecta la aplicación (D-017, HU-07).
 *
 * Hasta ahora la API se conectaba con el superusuario `postgres`. Eso hace que
 * cualquier inyección SQL en cualquier endpoint tenga permiso para `DROP TABLE`,
 * y vuelve decorativo el `REVOKE` que protege el log de auditoría: los
 * superusuarios **ignoran los privilegios**.
 *
 * Este script se corre **una vez por entorno**, con un rol que sea dueño del
 * esquema (típicamente el mismo que corre las migraciones):
 *
 *     DB_APP_PASSWORD='...' npm run db:rol-app
 *
 * Es idempotente: volver a correrlo actualiza la contraseña y reaplica los
 * privilegios. Conviene hacerlo después de cada migración que agregue tablas,
 * aunque los `ALTER DEFAULT PRIVILEGES` de abajo ya cubren ese caso.
 */

const ROL = process.env.DB_APP_USERNAME ?? 'terravid_app';
const PASSWORD = process.env.DB_APP_PASSWORD;

/**
 * El log de auditoría solo admite lectura e inserción (HU-07).
 *
 * Es la segunda capa: el trigger `trg_log_auditoria_inmutable` ya rechaza la
 * operación aunque el rol tuviera el privilegio. Las dos existen porque
 * protegen contra cosas distintas — el trigger cubre al superusuario, el
 * privilegio cubre el caso de que alguien deshabilite el trigger.
 */
const TABLA_APPEND_ONLY = 'log_auditoria';

async function crearRol(): Promise<void> {
  if (!PASSWORD) {
    throw new Error(
      'Falta DB_APP_PASSWORD. No se usa un valor por defecto a propósito: ' +
        'una contraseña conocida en el repositorio no es una contraseña.',
    );
  }
  if (PASSWORD.length < 16) {
    throw new Error(
      'DB_APP_PASSWORD debe tener al menos 16 caracteres: es una credencial de ' +
        'servicio, no la tipea nadie.',
    );
  }

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_MIGRATION_USERNAME ?? process.env.DB_USERNAME,
    password: process.env.DB_MIGRATION_PASSWORD ?? process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: false,
  });

  await dataSource.initialize();
  const base = process.env.DB_DATABASE;

  try {
    const [{ current_user: propietario }] = await dataSource.query<
      Array<{ current_user: string }>
    >('SELECT current_user');

    if (propietario === ROL) {
      throw new Error(
        `Este script se conectó como "${ROL}", que es el rol que intenta crear. ` +
          'Corrélo con el rol dueño del esquema (DB_MIGRATION_USERNAME).',
      );
    }

    // El DDL no admite parámetros, así que la contraseña hay que interpolarla.
    // El escapado lo hace **Postgres** con `quote_literal` en vez de armarlo a
    // mano acá: una contraseña de servicio puede tener cualquier carácter, y
    // duplicar comillas a ojo es la clase de atajo que termina en inyección.
    const [{ literal }] = await dataSource.query<Array<{ literal: string }>>(
      'SELECT quote_literal($1) AS literal',
      [PASSWORD],
    );

    const existe = await dataSource.query<Array<{ uno: number }>>(
      'SELECT 1 AS uno FROM pg_roles WHERE rolname = $1',
      [ROL],
    );

    // `CREATE ROLE` no acepta IF NOT EXISTS: hay que consultar antes.
    const verbo = existe.length > 0 ? 'ALTER' : 'CREATE';
    await dataSource.query(
      `${verbo} ROLE ${escapar(ROL)} LOGIN PASSWORD ${literal} NOSUPERUSER NOCREATEDB NOCREATEROLE`,
    );
    console.log(
      `Rol "${ROL}" ${existe.length > 0 ? 'actualizado' : 'creado'}.`,
    );

    // Conectarse y ver el esquema, nada más. Sin CREATE: la aplicación no crea
    // tablas — eso lo hacen las migraciones, con el otro rol.
    await dataSource.query(
      `GRANT CONNECT ON DATABASE ${escapar(base)} TO ${escapar(ROL)}`,
    );
    await dataSource.query(`GRANT USAGE ON SCHEMA public TO ${escapar(ROL)}`);
    await dataSource.query(
      `REVOKE CREATE ON SCHEMA public FROM ${escapar(ROL)}`,
    );

    // DML sobre las tablas existentes.
    await dataSource.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${escapar(ROL)}`,
    );
    // Las secuencias las necesita la numeración de remitos (F1-7).
    await dataSource.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${escapar(ROL)}`,
    );

    // El log de auditoría, después del GRANT masivo de arriba.
    await dataSource.query(
      `REVOKE UPDATE, DELETE, TRUNCATE ON ${escapar(TABLA_APPEND_ONLY)} FROM ${escapar(ROL)}`,
    );

    // La tabla de migraciones es del otro rol: la aplicación no tiene por qué
    // leerla, y menos escribirla.
    await dataSource.query(`REVOKE ALL ON migrations FROM ${escapar(ROL)}`);

    // Para que una migración futura no deje al rol sin permisos sobre la tabla
    // nueva. Aplica a lo que cree este mismo rol, que es el que migra.
    await dataSource.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public
         GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${escapar(ROL)}`,
    );
    await dataSource.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public
         GRANT USAGE, SELECT ON SEQUENCES TO ${escapar(ROL)}`,
    );

    console.log('Privilegios aplicados:');
    console.log('  · SELECT/INSERT/UPDATE/DELETE sobre las tablas del esquema');
    console.log(`  · solo SELECT/INSERT sobre "${TABLA_APPEND_ONLY}" (HU-07)`);
    console.log('  · sin CREATE sobre el esquema, sin acceso a "migrations"');
    console.log('');
    console.log('Configurar en el entorno de la aplicación:');
    console.log(`  DB_USERNAME=${ROL}`);
    console.log('  DB_PASSWORD=<la que acabás de usar>');
    console.log('  DB_MIGRATION_USERNAME=<el rol dueño del esquema>');
    console.log('  DB_MIGRATION_PASSWORD=<su contraseña>');
  } finally {
    await dataSource.destroy();
  }
}

/**
 * Comilla un identificador para interpolarlo en DDL, donde los parámetros no
 * están permitidos. Solo se usa con valores que salen de variables de entorno
 * del propio despliegue, pero se escapa igual: es una comilla, no una opinión.
 */
function escapar(identificador: string | undefined): string {
  if (!identificador || !/^[A-Za-z_][A-Za-z0-9_$]*$/.test(identificador)) {
    throw new Error(
      `Identificador inválido: "${String(identificador)}". Solo letras, números y guión bajo.`,
    );
  }
  return `"${identificador}"`;
}

crearRol().catch((error: Error) => {
  console.error('Error al crear el rol de aplicación:', error.message);
  process.exit(1);
});
