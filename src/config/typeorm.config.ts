import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * `synchronize` quedó apagado por defecto: el esquema lo gobiernan las
 * migraciones de `src/database/migrations` (`npm run migration:run`).
 *
 * Dejarlo prendido hacía que cada arranque dedujera el DDL de las entidades,
 * sin control de versión ni forma de revertir; un renombre de columna se
 * traducía en DROP + ADD, es decir pérdida de datos silenciosa. Se puede
 * reactivar con `DB_SYNCHRONIZE=true` para prototipar fuera de producción,
 * pero en producción se ignora la variable.
 */
export default registerAs('database', (): TypeOrmModuleOptions => {
  const esProduccion = process.env.NODE_ENV === 'production';

  return {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    autoLoadEntities: true,
    synchronize: !esProduccion && process.env.DB_SYNCHRONIZE === 'true',
    // Las migraciones se corren desde la CLI, no al arrancar: un arranque que
    // migra solo hace que N instancias compitan por el mismo DDL en un deploy.
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    migrationsRun: false,
    logging:
      process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  };
});
