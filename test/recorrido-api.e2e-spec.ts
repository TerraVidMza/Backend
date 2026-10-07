/**
 * Recorrido por HTTP de los módulos de oficina y de campo (D-028).
 *
 * Complementa los e2e por servicio: acá cada caso entra por la API real —
 * prefijo, guards, `ValidationPipe`, serialización y filtro de errores— y
 * ejercita los flujos completos de telemetría, inteligencia agronómica,
 * catálogos, operaciones, vendimia, usuarios y campañas con datos propios
 * creados al vuelo sobre la empresa del seed.
 *
 * No reemplaza al smoke (`test/smoke.mjs`), que corre contra la API desplegada:
 * este corre en el CI con la base efímera y cuenta para la cobertura.
 *
 *     docker compose up -d db && npm run migration:run && npm run seed
 *     npm run test:e2e
 */
import { Test } from '@nestjs/testing';
import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import {
  crearContexto,
  crearUsuario,
  limpiarContexto,
  limpiarUsuario,
  SUFIJO,
  type Contexto,
  type UsuarioDePrueba,
} from './fixtures';
import { hoyLocal } from './../src/common/fechas/rango-fechas';

/** Cuerpo de una respuesta de supertest con el tipo que se espera. */
const cuerpo = <T = Record<string, unknown>>(r: { body: unknown }): T =>
  r.body as T;
type ConId = { id: string };

const dias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

describe('Recorrido de la API (e2e, D-028)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let ctx: Contexto;
  const tokens: Record<string, string> = {};
  const usuarios: UsuarioDePrueba[] = [];

  const api = () => request(app.getHttpServer());
  const como = (rol: string) => ({ Authorization: `Bearer ${tokens[rol]}` });

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
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
    dataSource = app.get(DataSource);
    ctx = await crearContexto(dataSource, 'recorrido');

    for (const rol of ['Propietario', 'Agronomo', 'Capataz', 'Auditor']) {
      const u = await crearUsuario(dataSource, `recorrido-${rol}`, rol);
      usuarios.push(u);
      const r = await api()
        .post('/api/auth/login')
        .send({ email: u.email, password: u.password });
      tokens[rol] = cuerpo<{ accessToken: string }>(r).accessToken;
    }
  });

  afterAll(async () => {
    for (const u of usuarios) await limpiarUsuario(dataSource, u);
    if (ctx) {
      // Todo lo que cuelga de los sensores de la finca de prueba, y los sensores.
      for (const tabla of [
        'alertas_iot',
        'lecturas_iot',
        'lecturas_iot_historico',
        'lecturas_anomalas',
        'umbral_sensor',
      ]) {
        await dataSource.query(
          `DELETE FROM ${tabla} WHERE sensor_id IN (SELECT id FROM sensores WHERE finca_id = $1)`,
          [ctx.fincaId],
        );
      }
      await dataSource.query('DELETE FROM sensores WHERE finca_id = $1', [
        ctx.fincaId,
      ]);
      // La cuadrilla creada por el test (la del contexto la borra limpiarContexto).
      await dataSource.query(
        `DELETE FROM tarifa_cuadrilla WHERE cuadrilla_id IN (SELECT id FROM cuadrillas WHERE finca_id = $1 AND id <> $2)`,
        [ctx.fincaId, ctx.cuadrillaId],
      );
      await dataSource.query(
        'DELETE FROM cuadrillas WHERE finca_id = $1 AND id <> $2',
        [ctx.fincaId, ctx.cuadrillaId],
      );
      await dataSource.query('DELETE FROM usuario_finca WHERE finca_id = $1', [
        ctx.fincaId,
      ]);
      await dataSource.query(
        `DELETE FROM recomendaciones WHERE cuartel_id = $1`,
        [ctx.cuartelId],
      );
      await dataSource.query(
        `DELETE FROM detalle_insumo_labor WHERE registro_labor_id IN (SELECT id FROM registro_labor WHERE cuartel_id = $1)`,
        [ctx.cuartelId],
      );
      await dataSource.query(
        `DELETE FROM registro_labor WHERE cuartel_id = $1`,
        [ctx.cuartelId],
      );
      await limpiarContexto(dataSource, ctx);
    }
    await app?.close();
  });

  describe('dashboard por rol (HU-32)', () => {
    it.each(['Propietario', 'Agronomo', 'Capataz', 'Auditor'])(
      '%s recibe su tablero',
      async (rol) => {
        const r = await api()
          .get('/api/dashboard/indicadores')
          .set(como(rol))
          .expect(200);
        expect(cuerpo<{ rol: string }>(r).rol).toBe(rol);
      },
    );
  });

  describe('telemetría e inteligencia agronómica (HU-18 a HU-22, HU-29 a HU-31)', () => {
    let sensorId: string;
    const codigo = `REC-${SUFIJO}`;

    it('alta, edición y umbral del sensor', async () => {
      const alta = await api()
        .post('/api/sensores')
        .set(como('Agronomo'))
        .send({ fincaId: ctx.fincaId, codigo, tipo: 'humedad_suelo' })
        .expect(201);
      sensorId = cuerpo<ConId>(alta).id;

      await api()
        .get(`/api/sensores?fincaId=${ctx.fincaId}`)
        .set(como('Agronomo'))
        .expect(200);
      await api()
        .get(`/api/sensores/${sensorId}`)
        .set(como('Agronomo'))
        .expect(200);
      await api()
        .patch(`/api/sensores/${sensorId}`)
        .set(como('Agronomo'))
        .send({ descripcion: 'Bloque norte' })
        .expect(200);
      await api()
        .put(`/api/sensores/${sensorId}/umbral`)
        .set(como('Agronomo'))
        .send({ umbralMinimo: 15, umbralMaximo: 40 })
        .expect(200);
      await api()
        .get(`/api/sensores/${sensorId}/umbral`)
        .set(como('Agronomo'))
        .expect(200);
    });

    it('ingesta por HTTP, lectura anómala y alerta por umbral', async () => {
      const ingestar = (valor: number) =>
        api()
          .post('/api/lecturas-iot')
          .set('X-Api-Key', process.env.IOT_API_KEY ?? '')
          .send({
            codigoSensor: codigo,
            valor,
            unidad: '%',
            sensorTimestamp: new Date().toISOString(),
          });

      expect(cuerpo<{ estado: string }>(await ingestar(25)).estado).toBe(
        'aceptada',
      );
      expect(cuerpo<{ estado: string }>(await ingestar(500)).estado).toBe(
        'anomala',
      );
      await ingestar(5); // bajo el umbral mínimo: alerta

      // La evaluación de umbrales corre fuera del request.
      await new Promise((r) => setTimeout(r, 300));
      const alertas = await api()
        .get('/api/alertas-iot/pendientes')
        .set(como('Agronomo'))
        .expect(200);
      const alerta = cuerpo<Array<ConId & { sensorId: string }>>(alertas).find(
        (a: { sensorId: string }) => a.sensorId === sensorId,
      );
      expect(alerta).toBeDefined();
      await api()
        .patch(`/api/alertas-iot/${alerta!.id}/revisar`)
        .set(como('Agronomo'))
        .expect(200);
    });

    it('serie agregada y lecturas paginadas', async () => {
      // 40 días de historia para que inteligencia tenga datos (gate de 30 días).
      await dataSource.query(
        `INSERT INTO lecturas_iot (sensor_id, valor, unidad, sensor_timestamp)
         SELECT $1, 20 + (g % 10), '%', now() - (g || ' days')::interval
           FROM generate_series(1, 40) g`,
        [sensorId],
      );
      const desde = dias(-45);
      const hasta = hoyLocal();
      for (const granularidad of ['hora', 'dia']) {
        await api()
          .get(
            `/api/lecturas-iot/sensor/${sensorId}/serie?desde=${desde}&hasta=${hasta}&granularidad=${granularidad}`,
          )
          .set(como('Agronomo'))
          .expect(200);
      }
      const pag = await api()
        .get(`/api/lecturas-iot/sensor/${sensorId}?page=1&pageSize=10`)
        .set(como('Agronomo'))
        .expect(200);
      expect(cuerpo<{ total: number }>(pag).total).toBeGreaterThan(10);
    });

    it('correlación, recomendaciones y comparación de campañas', async () => {
      // Labores en el mismo período para que haya pares que correlacionar.
      // El tipo de labor se resuelve antes de armar el pedido: otro request
      // dentro de `.send()` cierra el servidor efímero de supertest (D-030).
      const tipoLaborId = await primerTipoLabor();
      for (let i = 1; i <= 10; i++) {
        await api()
          .post('/api/registro-labor')
          .set(como('Capataz'))
          .send({
            localUuid: crypto.randomUUID(),
            cuartelId: ctx.cuartelId,
            tipoLaborId,
            fecha: dias(-i * 3),
            cantidad: i,
            insumos: [],
          });
      }
      await api()
        .get(
          `/api/inteligencia-agronomica/correlacion/${ctx.cuartelId}?sensorId=${sensorId}&desde=${dias(-45)}&hasta=${hoyLocal()}`,
        )
        .set(como('Agronomo'))
        .expect(200);

      const recs = await api()
        .get(`/api/inteligencia-agronomica/recomendaciones/${ctx.cuartelId}`)
        .set(como('Agronomo'))
        .expect(200);
      const lista = cuerpo<
        | Array<ConId & { estado: string }>
        | { recomendaciones: Array<ConId & { estado: string }> }
      >(recs);
      const activa = (
        Array.isArray(lista) ? lista : lista.recomendaciones
      ).find((r: { estado: string }) => r.estado === 'activa');
      if (activa) {
        await api()
          .patch(`/api/inteligencia-agronomica/recomendaciones/${activa.id}`)
          .set(como('Agronomo'))
          .send({ estado: 'descartada', nota: 'Prueba e2e' })
          .expect(200);
      }

      await api()
        .get(
          `/api/inteligencia-agronomica/comparar-campanias/${ctx.cuartelId}?desde1=${dias(-60)}&hasta1=${dias(-31)}&desde2=${dias(-30)}&hasta2=${hoyLocal()}`,
        )
        .set(como('Propietario'))
        .expect(200);
    });

    it('el Capataz no ve telemetría ni inteligencia', async () => {
      await api()
        .get(`/api/sensores?fincaId=${ctx.fincaId}`)
        .set(como('Capataz'))
        .expect(403);
      await api()
        .get(`/api/inteligencia-agronomica/recomendaciones/${ctx.cuartelId}`)
        .set(como('Capataz'))
        .expect(403);
    });

    it('baja del sensor: deja de aceptar lecturas', async () => {
      await api()
        .patch(`/api/sensores/${sensorId}/desactivar`)
        .set(como('Agronomo'))
        .expect(200);
      await api()
        .post('/api/lecturas-iot')
        .set('X-Api-Key', process.env.IOT_API_KEY ?? '')
        .send({
          codigoSensor: codigo,
          valor: 20,
          unidad: '%',
          sensorTimestamp: new Date().toISOString(),
        })
        .expect(403);
    });
  });

  let tipoLaborCache: string | undefined;
  /** Tipo de labor propio con costo vigente desde antes del período probado. */
  async function primerTipoLabor(): Promise<string> {
    if (!tipoLaborCache) {
      const r = await api()
        .post('/api/tipos-labor')
        .set(como('Propietario'))
        .send({
          nombre: `Riego recorrido ${SUFIJO}`,
          unidadMedida: 'jornal',
          costoUnitarioInicial: 50,
        })
        .expect(201);
      tipoLaborCache = cuerpo<ConId>(r).id;
      await dataSource.query(
        `UPDATE costo_labor SET valid_from = '2000-01-01' WHERE tipo_labor_id = $1`,
        [tipoLaborCache],
      );
    }
    return tipoLaborCache;
  }

  describe('catálogos y operaciones (HU-15, HU-16, HU-34)', () => {
    it('ABM de un ítem de catálogo', async () => {
      const alta = await api()
        .post('/api/catalogos')
        .set(como('Propietario'))
        .send({ tipo: 'variedad', nombre: `Petit Verdot ${SUFIJO}` })
        .expect(201);
      await api()
        .get('/api/catalogos?tipo=variedad&incluirInactivos=true')
        .set(como('Capataz'))
        .expect(200);
      await api()
        .patch(`/api/catalogos/${cuerpo<ConId>(alta).id}`)
        .set(como('Propietario'))
        .send({ nombre: `Petit Verdot ${SUFIJO} bis` })
        .expect(200);
      await api()
        .patch(`/api/catalogos/${cuerpo<ConId>(alta).id}/desactivar`)
        .set(como('Propietario'))
        .expect(200);
      await api()
        .delete(`/api/catalogos/${cuerpo<ConId>(alta).id}`)
        .set(como('Propietario'))
        .expect((r) => {
          expect([200, 204]).toContain(r.status);
        });
    });

    it.each([
      ['insumos', 'kg'],
      ['tipos-labor', 'jornal'],
    ])('ABM de %s con historial de costos', async (recurso, unidadMedida) => {
      const alta = await api()
        .post(`/api/${recurso}`)
        .set(como('Agronomo'))
        .send({
          nombre: `Recorrido ${recurso} ${SUFIJO}`,
          unidadMedida,
          costoUnitarioInicial: 100,
        })
        .expect(201);
      const id = cuerpo<ConId>(alta).id;
      await api().get(`/api/${recurso}/${id}`).set(como('Capataz')).expect(200);
      await api()
        .patch(`/api/${recurso}/${id}`)
        .set(como('Agronomo'))
        .send({ descripcion: 'x' })
        .expect(200);
      await api()
        .post(`/api/${recurso}/${id}/costos`)
        .set(como('Agronomo'))
        .send({ costoUnitario: 120, validFrom: dias(1) })
        .expect(201);
      const costos = await api()
        .get(`/api/${recurso}/${id}/costos`)
        .set(como('Agronomo'))
        .expect(200);
      expect(cuerpo<unknown[]>(costos).length).toBeGreaterThanOrEqual(2);
      await api()
        .patch(`/api/${recurso}/${id}/desactivar`)
        .set(como('Propietario'))
        .expect(200);
    });

    it('costeo, historial y margen bruto del cuartel', async () => {
      await api()
        .get(`/api/registro-labor/costeo?fincaId=${ctx.fincaId}`)
        .set(como('Propietario'))
        .expect(200);
      await api()
        .get(`/api/registro-labor/cuartel/${ctx.cuartelId}?page=1`)
        .set(como('Auditor'))
        .expect(200);
      await api()
        .get(`/api/registro-labor/cuartel/${ctx.cuartelId}/margen-bruto`)
        .set(como('Propietario'))
        .expect(200);
    });
  });

  describe('cuadrillas (HU-23)', () => {
    it('alta, edición, tarifa y baja', async () => {
      const alta = await api()
        .post('/api/cuadrillas')
        .set(como('Propietario'))
        .send({
          fincaId: ctx.fincaId,
          nombre: `Recorrido ${SUFIJO}`,
          cantidadIntegrantes: 4,
          tarifaPorKgInicial: 5,
        })
        .expect(201);
      const id = cuerpo<ConId>(alta).id;
      await api().get(`/api/cuadrillas/${id}`).set(como('Capataz')).expect(200);
      await api()
        .patch(`/api/cuadrillas/${id}`)
        .set(como('Agronomo'))
        .send({ cantidadIntegrantes: 5 })
        .expect(200);
      await api()
        .post(`/api/cuadrillas/${id}/tarifas`)
        .set(como('Propietario'))
        .send({ tarifaPorKg: 6, validFrom: dias(1) })
        .expect(201);
      await api()
        .get(`/api/cuadrillas/${id}/tarifas`)
        .set(como('Agronomo'))
        .expect(200);
      await api()
        .patch(`/api/cuadrillas/${id}/desactivar`)
        .set(como('Propietario'))
        .expect(200);
    });
  });

  describe('usuarios y notificaciones (HU-05, HU-06, HU-35)', () => {
    it('alta, búsqueda, edición, fincas asignadas y baja', async () => {
      const roles = await api()
        .get('/api/roles')
        .set(como('Propietario'))
        .expect(200);
      const capataz = cuerpo<Array<ConId & { nombreRol: string }>>(roles).find(
        (r: { nombreRol: string }) => r.nombreRol === 'Capataz',
      );
      const alta = await api()
        .post('/api/usuarios')
        .set(como('Propietario'))
        .send({
          nombre: 'Recorrido',
          email: `recorrido-alta-${SUFIJO}@terravid.test`,
          rolId: capataz!.id,
        })
        .expect(201);
      const id = cuerpo<ConId>(alta).id;
      usuarios.push({
        id,
        email: cuerpo<{ email: string }>(alta).email,
        password: '',
      });

      await api()
        .get('/api/usuarios?buscar=Recorrido&page=1')
        .set(como('Propietario'))
        .expect(200);
      await api()
        .get(`/api/usuarios/${id}`)
        .set(como('Propietario'))
        .expect(200);
      await api()
        .patch(`/api/usuarios/${id}`)
        .set(como('Propietario'))
        .send({ nombre: 'Recorrido 2' })
        .expect(200);
      await api()
        .put(`/api/usuarios/${id}/fincas`)
        .set(como('Propietario'))
        .send({ fincaIds: [ctx.fincaId] })
        .expect(200);
      await api()
        .get(`/api/usuarios/${id}/fincas`)
        .set(como('Propietario'))
        .expect(200);
      await api()
        .patch(`/api/usuarios/${id}/desactivar`)
        .set(como('Propietario'))
        .expect(200);
    });

    it('perfil propio y notificaciones', async () => {
      await api().get('/api/usuarios/me').set(como('Capataz')).expect(200);
      await api()
        .patch('/api/usuarios/me')
        .set(como('Capataz'))
        .send({ nombre: 'Capataz Recorrido' })
        .expect(200);
      await api()
        .get('/api/notificaciones?page=1&pageSize=5')
        .set(como('Capataz'))
        .expect(200);
      await api()
        .patch('/api/notificaciones/leidas')
        .set(como('Capataz'))
        .expect(200);
    });
  });

  describe('campañas (D-014)', () => {
    it('alta, edición, cierre y reapertura', async () => {
      const anio = 2100 + Number(SUFIJO.slice(-2));
      const alta = await api()
        .post('/api/campanias')
        .set(como('Propietario'))
        .send({
          nombre: `Recorrido ${SUFIJO}`,
          fechaDesde: `${anio}-01-01`,
          fechaHasta: `${anio}-12-31`,
        })
        .expect(201);
      const id = cuerpo<ConId>(alta).id;
      try {
        await api()
          .get(`/api/campanias/${id}`)
          .set(como('Auditor'))
          .expect(200);
        await api()
          .patch(`/api/campanias/${id}`)
          .set(como('Propietario'))
          .send({ nombre: `Recorrido ${SUFIJO} b` })
          .expect(200);
        await api()
          .patch(`/api/campanias/${id}/cerrar`)
          .set(como('Propietario'))
          .expect(200);
        await api()
          .patch(`/api/campanias/${id}/reabrir`)
          .set(como('Propietario'))
          .expect(200);
        // Se superpone con la recién creada: el EXCLUDE lo rechaza.
        await api()
          .post('/api/campanias')
          .set(como('Propietario'))
          .send({
            nombre: `Solapada ${SUFIJO}`,
            fechaDesde: `${anio}-06-01`,
            fechaHasta: `${anio + 1}-01-31`,
          })
          .expect(409);
      } finally {
        await dataSource.query('DELETE FROM campanias WHERE id = $1', [id]);
      }
    });
  });
});
