import 'reflect-metadata';
import { config as cargarEnv } from 'dotenv';
import { DataSource } from 'typeorm';

cargarEnv();

/**
 * Verifica que el rol de la aplicación tenga **solo** los privilegios que
 * necesita (D-017, HU-07).
 *
 * Se conecta con `DB_USERNAME`/`DB_PASSWORD` —las credenciales reales de la
 * API— e intenta cada operación. No inspecciona `information_schema`: mirar la
 * tabla de privilegios diría lo que *debería* pasar, y lo que importa es lo que
 * pasa. Cada prueba corre en su propia transacción y se revierte, así que no
 * deja rastro.
 *
 *     npm run db:verificar-privilegios
 *
 * Sale con código 1 si algo no cumple, para poder encadenarlo en el despliegue.
 */

interface Prueba {
  descripcion: string;
  sql: string;
  /** `true` si la operación debe funcionar; `false` si debe ser rechazada. */
  debePoder: boolean;
}

const PRUEBAS: Prueba[] = [
  {
    descripcion: 'leer usuarios',
    sql: 'SELECT id FROM usuarios LIMIT 1',
    debePoder: true,
  },
  {
    descripcion: 'escribir una labor',
    sql: `INSERT INTO registro_labor (local_uuid, cuartel_id, tipo_labor_id, usuario_id, fecha, cantidad)
          SELECT gen_random_uuid(), c.id, t.id, u.id, CURRENT_DATE, 1
            FROM cuarteles c, tipo_labor t, usuarios u LIMIT 1`,
    debePoder: true,
  },
  {
    descripcion: 'insertar en el log de auditoría',
    sql: `INSERT INTO log_auditoria (actor_id, accion, entidad)
          SELECT u.id, 'PRUEBA_PRIVILEGIOS', 'verificacion' FROM usuarios u LIMIT 1`,
    debePoder: true,
  },
  {
    descripcion: 'MODIFICAR el log de auditoría',
    sql: `UPDATE log_auditoria SET accion = 'ALTERADO'`,
    debePoder: false,
  },
  {
    descripcion: 'BORRAR del log de auditoría',
    sql: 'DELETE FROM log_auditoria',
    debePoder: false,
  },
  {
    descripcion: 'VACIAR el log de auditoría',
    sql: 'TRUNCATE log_auditoria',
    debePoder: false,
  },
  {
    descripcion: 'CREAR una tabla',
    sql: 'CREATE TABLE prueba_privilegios (id int)',
    debePoder: false,
  },
  {
    // `ALTER` y no `DROP TABLE usuarios`: con privilegios de sobra, el DROP
    // falla igual por las claves foráneas que dependen de la tabla, y ese error
    // no distingue "no tiene permiso" de "tiene permiso pero hay dependencias".
    // El ALTER es una prueba limpia de si el rol puede tocar el esquema.
    descripcion: 'ALTERAR una tabla',
    sql: 'ALTER TABLE usuarios ADD COLUMN prueba_privilegios int',
    debePoder: false,
  },
  {
    descripcion: 'leer la tabla de migraciones',
    sql: 'SELECT * FROM migrations LIMIT 1',
    debePoder: false,
  },
];

async function verificar(): Promise<void> {
  const usuario = process.env.DB_USERNAME;
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: usuario,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: false,
  });

  await dataSource.initialize();
  let fallas = 0;

  try {
    const [{ usesuper: esSuperusuario }] = await dataSource.query<
      Array<{ usesuper: boolean }>
    >('SELECT usesuper FROM pg_user WHERE usename = current_user');

    console.log(`Rol de la aplicación: ${String(usuario)}`);
    if (esSuperusuario) {
      console.log(
        '  FALLA  es SUPERUSUARIO: ignora todos los privilegios de abajo.',
      );
      console.log('         Crear el rol acotado con `npm run db:rol-app`.');
      fallas++;
    } else {
      console.log('  OK     no es superusuario');
    }
    console.log('');

    for (const prueba of PRUEBAS) {
      const pudo = await intentar(dataSource, prueba.sql);
      const bien = pudo === prueba.debePoder;
      const etiqueta = prueba.debePoder ? 'puede' : 'NO puede';
      console.log(
        `  ${bien ? 'OK    ' : 'FALLA '} ${etiqueta} ${prueba.descripcion}`,
      );
      if (!bien) fallas++;
    }
  } finally {
    await dataSource.destroy();
  }

  console.log('');
  if (fallas > 0) {
    console.log(`${fallas} verificación(es) fallida(s).`);
    process.exit(1);
  }
  console.log('Todos los privilegios son los esperados.');
}

/**
 * Corre la sentencia dentro de una transacción y la revierte siempre.
 *
 * Devuelve si la operación fue permitida. Un error de permisos o del trigger
 * cuenta como "no pudo"; cualquier otro error —una FK, datos que faltan— se
 * relanza, porque significa que la prueba está mal escrita y no que el
 * privilegio esté bien puesto.
 */
async function intentar(dataSource: DataSource, sql: string): Promise<boolean> {
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await runner.query(sql);
    return true;
  } catch (error) {
    const codigo = (error as { code?: string }).code;
    // 42501 insufficient_privilege · 42P01 tabla inexistente para este rol
    // 23001 restrict_violation, que es el trigger append-only de HU-07
    if (codigo === '42501' || codigo === '42P01' || codigo === '23001') {
      return false;
    }
    throw error;
  } finally {
    await runner.rollbackTransaction();
    await runner.release();
  }
}

verificar().catch((error: Error) => {
  console.error('Error al verificar privilegios:', error.message);
  process.exit(1);
});
