import { NestFactory, Reflector } from '@nestjs/core';
import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarOpenApi } from './config/openapi';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Sin esto, detrás de un reverse proxy `req.ip` es la IP del proxy: el log de
  // auditoría y el rate limiting por IP quedarían viendo un único origen.
  // El número es la cantidad de proxies de confianza delante de la app.
  app.set('trust proxy', parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10));

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });

  app.setGlobalPrefix('api');

  // Sin esto, parar el contenedor corta los requests en vuelo y deja el pool de
  // TypeORM sin cerrar. El despliegue reemplaza la imagen en cada version.
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Sin este interceptor, los `@Exclude()` de las entidades son inertes y el
  // `passwordHash` viaja en toda respuesta que devuelva un Usuario.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const rutaDocs = configurarOpenApi(app);

  const puerto = process.env.PORT ?? 3000;
  await app.listen(puerto);

  const logger = new Logger('Bootstrap');
  logger.log(`API escuchando en http://localhost:${puerto}/api`);
  if (rutaDocs) {
    logger.log(`OpenAPI en http://localhost:${puerto}/${rutaDocs}`);
  }
}
void bootstrap();
