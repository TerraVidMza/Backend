import 'reflect-metadata';
import { join } from 'path';
import { config as cargarEnv } from 'dotenv';
import { DataSource } from 'typeorm';

cargarEnv();

/**
 * Raíz del código, deducida de la ubicación de este archivo.
 *
 * Vía ts-node esto es `src/`; desde la imagen de producción, `dist/`. De ahí
 * salen los globs de abajo, y es lo que permite correr las migraciones **desde
 * el contenedor desplegado**. Con las rutas escritas a mano apuntando a `src/`,
 * migrar exigía un checkout completo con devDependencies instaladas, y por eso
 * el runbook mandaba hacerlo por un túnel SSH desde una máquina de desarrollo:
 * un paso manual en medio del deploy que no se podía automatizar.
 *
 * Las barras se normalizan a `/` porque en Windows `__dirname` las trae
 * invertidas y la librería de globs las interpreta como escapes.
 */
const RAIZ = join(__dirname, '..').replace(/\\/g, '/');

/**
 * Extensión que buscan los globs, deducida de este mismo archivo.
 *
 * No es un `{ts,js}` porque en `dist/` el compilador deja también los `.d.ts`,
 * y `*.{ts,js}` los levanta: ocho archivos donde hay cuatro migraciones.
 * TypeORM hoy los descarta por su cuenta, pero apoyarse en un filtro interno
 * suyo es frágil, y pedir la extensión correcta es más claro que pedir las dos
 * y confiar en que alguien limpie.
 */
const EXT = __filename.endsWith('.js') ? 'js' : 'ts';

/**
 * DataSource para la CLI de TypeORM (generar, correr y revertir migraciones).
 *
 * La aplicación **no** usa este archivo: Nest arma su conexión desde
 * `typeorm.config.ts` con `autoLoadEntities`.
 *
 * **Las credenciales son distintas a propósito** (D-017). Migrar es DDL —crear
 * tablas, índices, triggers— y la aplicación no necesita ese poder para
 * funcionar: solo lee y escribe filas. Si las dos usaran el mismo rol, una
 * inyección SQL en cualquier endpoint tendría permiso para hacer `DROP TABLE`.
 *
 * `DB_MIGRATION_USERNAME` cae a `DB_USERNAME` cuando no está definida, así que
 * en desarrollo con un solo usuario todo sigue funcionando sin configurar nada.
 *
 * Los globs aceptan `.ts` y `.js` para servir en los dos modos: `ts-node` sobre
 * `src/` en desarrollo, y `node` sobre `dist/` en el contenedor. Ver `RAIZ`.
 */
export const dataSourceOptions = {
  type: 'postgres' as const,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_MIGRATION_USERNAME ?? process.env.DB_USERNAME,
  password: process.env.DB_MIGRATION_PASSWORD ?? process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [`${RAIZ}/**/*.entity.${EXT}`],
  migrations: [`${RAIZ}/database/migrations/*.${EXT}`],
  migrationsTableName: 'migrations',
  synchronize: false,
};

export default new DataSource(dataSourceOptions);
