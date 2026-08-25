import 'reflect-metadata';
import { config as cargarEnv } from 'dotenv';
import { DataSource } from 'typeorm';

cargarEnv();

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
 * Los globs son `.ts` porque la CLI se invoca vía `ts-node` sobre `src/`.
 */
export const dataSourceOptions = {
  type: 'postgres' as const,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_MIGRATION_USERNAME ?? process.env.DB_USERNAME,
  password: process.env.DB_MIGRATION_PASSWORD ?? process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations',
  synchronize: false,
};

export default new DataSource(dataSourceOptions);
