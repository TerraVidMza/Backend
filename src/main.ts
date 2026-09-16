import { NestFactory, Reflector } from '@nestjs/core';
import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { configurarOpenApi } from './config/openapi';
import { LoggerConRequestId } from './common/logger/logger-con-request-id';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Estampa el id de la request en cada linea. Sin esto, en la VM conviven
    // las lineas de todos los requests en curso y no hay forma de saber cuales
    // pertenecen a la misma operacion.
    logger: new LoggerConRequestId(),
  });

  // Sin esto, detrás de un reverse proxy `req.ip` es la IP del proxy: el log de
  // auditoría y el rate limiting por IP quedarían viendo un único origen.
  // El número es la cantidad de proxies de confianza delante de la app.
  app.set('trust proxy', parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10));

  // Seguridad y compresion en la aplicacion, no solo en el proxy. En la VM del
  // Apendice A esto lo hace Caddy, pero el runbook principal despliega en Cloud
  // Run sin nada delante, y ahi no lo hace nadie.
  app.use(
    helmet({
      // La UI de OpenAPI carga sus assets inline; la CSP por defecto de helmet
      // los bloquea. No es una perdida real: esto es una API JSON, no un sitio.
      contentSecurityPolicy: false,
    }),
  );
  app.use(compression());

  // Falla cerrado. `?? true` junto a `credentials: true` significaba que, si la
  // variable no estaba, cualquier sitio podia hacer requests autenticados
  // (DESPLIEGUE.md A.12 ya lo advertia). En produccion la ausencia es un error
  // de configuracion y `validarEntorno` no deja arrancar; el `false` de aca es
  // la red por si alguien desactiva esa validacion.
  //
  // Solo afecta a navegadores: la app movil y los nodos ESP32 no mandan Origin.
  const origenes =
    process.env.CORS_ORIGIN?.split(',')
      .map((o) => o.trim())
      // Opcional: quitar cualquier '/' al final por si se coló por error en el .env
      .map((o) => (o.endsWith('/') ? o.slice(0, -1) : o))
      .filter(Boolean) || [];

  app.enableCors({
    origin: function (origin, callback) {
      // Permitir si no hay origen (ej: Postman, servidor local)
      if (!origin) {
        return callback(null, true);
      }
      // Si el origen está en nuestra lista, permitir
      if (origenes.includes(origin)) {
        return callback(null, true);
      }
      // Fallback: Si no hay orígenes configurados y NO es producción, permitir todo
      if (origenes.length === 0 && process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      // Si no cumple nada de lo anterior, bloquear (no devuelve la cabecera CORS)
      callback(null, false);
    },
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
