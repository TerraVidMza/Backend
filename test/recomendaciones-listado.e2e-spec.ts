/**
 * Listado general de recomendaciones y evaluación masiva (HU-30) contra
 * PostgreSQL real: el listado cruza recomendación → cuartel → finca → empresa,
 * y el aislamiento entre empresas solo se puede comprobar con la base de verdad.
 *
 *     docker compose up -d && npm run migration:run && npm run seed
 *     npm run test:e2e
 */
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { InteligenciaAgronomicaService } from './../src/modules/inteligencia-agronomica/inteligencia-agronomica.service';
import {
  Contexto,
  crearContexto,
  crearContextoDeOtraEmpresa,
  limpiarContexto,
} from './fixtures';

describe('Recomendaciones: listado general (integración)', () => {
  let modulo: TestingModule;
  let dataSource: DataSource;
  let servicio: InteligenciaAgronomicaService;
  let ctx: Contexto;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await modulo.init();
    dataSource = modulo.get(DataSource);
    servicio = modulo.get(InteligenciaAgronomicaService);
  });

  afterAll(async () => {
    await modulo?.close();
  });

  beforeEach(async () => {
    ctx = await crearContexto(dataSource, 'recomendaciones');
  });

  afterEach(async () => {
    await dataSource.query(
      `DELETE FROM recomendaciones WHERE cuartel_id = $1`,
      [ctx.cuartelId],
    );
    await limpiarContexto(dataSource, ctx);
  });

  const crearRecomendacion = (estado: string) =>
    dataSource.query(
      `INSERT INTO recomendaciones
         (cuartel_id, regla_id, variable, patron_detectado, accion_sugerida, severidad, estado)
       VALUES ($1, 'regla-test', 'humedad', 'Patrón de prueba', 'Acción de prueba', 'media', $2)`,
      [ctx.cuartelId, estado],
    );

  it('lista las activas con su cuartel y su finca', async () => {
    await crearRecomendacion('activa');

    const lista = await servicio.listarRecomendaciones(ctx.empresaId);

    expect(lista).toHaveLength(1);
    expect(lista[0].cuartel.id).toBe(ctx.cuartelId);
    expect(lista[0].cuartel.finca.id).toBe(ctx.fincaId);
  });

  it('por defecto oculta las resueltas, y «todas» las incluye', async () => {
    await crearRecomendacion('activa');
    await crearRecomendacion('descartada');

    expect(await servicio.listarRecomendaciones(ctx.empresaId)).toHaveLength(1);
    expect(
      await servicio.listarRecomendaciones(ctx.empresaId, 'todas'),
    ).toHaveLength(2);
  });

  it('no muestra recomendaciones de otra empresa', async () => {
    await crearRecomendacion('activa');
    const ajeno = await crearContextoDeOtraEmpresa(
      dataSource,
      'recomendaciones',
    );
    try {
      expect(
        await servicio.listarRecomendaciones(ajeno.empresaId),
      ).toHaveLength(0);
    } finally {
      await limpiarContexto(dataSource, ajeno);
    }
  });

  it('evaluar todas recorre los cuarteles y cuenta los que no tienen histórico en vez de fallar', async () => {
    const resultado = await servicio.evaluarTodas(ctx.empresaId);

    // La empresa de prueba comparte los cuarteles del seed: se comprueba la
    // coherencia del resultado y no un número exacto.
    expect(resultado.cuartelesEvaluados).toBeGreaterThanOrEqual(1);
    expect(resultado.sinHistorico).toBeLessThanOrEqual(
      resultado.cuartelesEvaluados,
    );
    expect(resultado.nuevas).toBeGreaterThanOrEqual(0);
  });
});
