/**
 * e2e del perímetro de la aplicación: lo que toda ruta hereda por estar montada
 * en `AppModule`, sin importar de qué módulo sea.
 *
 * Es deliberadamente corto. Los 185 casos de `test/smoke.mjs` cubren el
 * comportamiento funcional contra la API desplegada; acá se verifica el
 * andamiaje que el smoke da por sentado —prefijo, guards globales, pipe de
 * validación, filtro de excepciones— y que es lo que se rompe cuando alguien
 * toca `main.ts` o el orden de los providers globales de `app.module.ts`.
 *
 * Levanta la aplicación real con su base real: `AppModule` importa TypeORM, y
 * un e2e que lo mockea no prueba nada que los unitarios no prueben ya.
 *
 *     docker compose up -d && npm run migration:run && npm run seed
 *     npm run test:e2e
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';

describe('Perímetro de la aplicación (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // La misma configuración que `main.ts`. `createNestApplication()` no la
    // hereda: sin repetirla acá, el e2e probaría una aplicación que no existe
    // en ningún entorno.
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    // Condicional: si `beforeAll` falló, `app` quedó sin asignar y un `.close()`
    // directo tapa el error real con un TypeError.
    await app?.close();
  });

  describe('prefijo global', () => {
    it('la raíz sin prefijo no existe', async () => {
      await request(app.getHttpServer()).get('/').expect(404);
    });
  });

  describe('guard global de autenticación', () => {
    it('sin token responde 401, no 200', async () => {
      await request(app.getHttpServer()).get('/api').expect(401);
    });

    it('una ruta de negocio sin token responde 401', async () => {
      await request(app.getHttpServer()).get('/api/fincas').expect(401);
    });

    it('un token inventado no pasa', async () => {
      await request(app.getHttpServer())
        .get('/api/fincas')
        .set('Authorization', 'Bearer no-soy-un-jwt')
        .expect(401);
    });

    it('las rutas @Public() sí se alcanzan sin token', async () => {
      // 401 sería el guard; acá se espera el 400 del ValidationPipe, que es la
      // prueba de que la request pasó el guard y llegó al handler.
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({})
        .expect(400);
    });
  });

  describe('pipe de validación global', () => {
    it('rechaza propiedades no declaradas en el DTO', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'propietario@terravid.demo',
          password: 'Terravid123!',
          rol: 'Propietario',
        })
        .expect(400);

      expect(JSON.stringify(respuesta.body)).toContain('rol');
    });
  });

  describe('filtro de excepciones global', () => {
    it('da forma a los errores: statusCode, path, timestamp y message', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/api/fincas')
        .expect(401);

      expect(respuesta.body).toMatchObject({
        statusCode: 401,
        path: '/api/fincas',
      });
      expect(respuesta.body.timestamp).toEqual(expect.any(String));
      expect(respuesta.body.message).toBeDefined();
    });
  });

  describe('credenciales y serialización', () => {
    it('el login devuelve el token y nunca el hash de la contraseña', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'propietario@terravid.demo',
          password: 'Terravid123!',
        })
        .expect(200);

      expect(respuesta.body.accessToken).toEqual(expect.any(String));
      // El ClassSerializerInterceptor es lo único que hace efectivos los
      // `@Exclude()` de las entidades. Si se cae de `main.ts`, el passwordHash
      // viaja en toda respuesta que devuelva un Usuario.
      expect(JSON.stringify(respuesta.body)).not.toContain('passwordHash');
    });

    it('una contraseña incorrecta no distingue el motivo', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'propietario@terravid.demo',
          password: 'no-es-la-contrasena',
        })
        .expect(401);
    });
  });
});
