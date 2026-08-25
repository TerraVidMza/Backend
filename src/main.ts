import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

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

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
