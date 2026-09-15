/**
 * Escribe el contrato OpenAPI a `openapi.json` sin levantar el servidor.
 *
 *     npm run openapi:generar
 *
 * Existe para los repositorios cliente: Web y Mobile generan sus tipos y su
 * cliente HTTP desde este archivo, y el firmware consulta el contrato de la
 * ingesta. Pedirle a cada uno que levante el backend con su base para leer
 * `/api/docs-json` es una barrera que termina en que nadie lo hace y los DTOs
 * se copian a mano.
 *
 * Corre en **modo preview** de Nest: construye el grafo de módulos y toda la
 * metadata de rutas, pero no instancia los providers. Sin eso haría falta una
 * base de datos viva solo para documentar, porque `AppModule` importa TypeORM.
 *
 * Tiene que correr sobre `dist/`, no con ts-node: el plugin de `@nestjs/swagger`
 * que deduce los tipos de los DTOs es parte de la compilación de `nest build`.
 * La metadata no existe en el código fuente sin compilar.
 */
import 'reflect-metadata';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { construirDocumentoOpenApi } from './openapi';

async function generar(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: ['error', 'warn'],
  });
  app.setGlobalPrefix('api');

  const documento = construirDocumentoOpenApi(app);
  const destino = join(process.cwd(), 'openapi.json');
  writeFileSync(destino, JSON.stringify(documento, null, 2), 'utf8');

  const operaciones = Object.values(documento.paths).reduce(
    (total, metodos) => total + Object.keys(metodos).length,
    0,
  );
  console.log(
    `OpenAPI escrito en ${destino}: ${Object.keys(documento.paths).length} rutas, ${operaciones} operaciones.`,
  );

  await app.close();
}

generar().catch((error) => {
  console.error(error);
  process.exit(1);
});
