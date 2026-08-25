import 'reflect-metadata';
import { config as cargarEnv } from 'dotenv';
import { DataSource } from 'typeorm';

cargarEnv();

/**
 * DataSource para la CLI de TypeORM (generar, correr y revertir migraciones).
 *
 * La aplicación **no** usa este archivo: Nest arma su conexión desde
 * `typeorm.config.ts` con `autoLoadEntities`. Los dos deben apuntar a la misma
 * base y a la misma carpeta de migraciones, y por eso las credenciales salen
 * de las mismas variables de entorno.
 *
 * Los globs son `.ts` porque la CLI se invoca vía `ts-node` sobre `src/`.
 */
export const dataSourceOptions = {
  type: 'postgres' as const,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations',
  synchronize: false,
};

export default new DataSource(dataSourceOptions);
