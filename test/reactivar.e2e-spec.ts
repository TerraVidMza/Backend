/**
 * Reactivar lo dado de baja (fincas, cuarteles, cuadrillas) contra PostgreSQL
 * real. Hasta ahora la baja era de un solo sentido: una baja por error obligaba
 * a tocar la base de datos.
 *
 *     docker compose up -d && npm run migration:run && npm run seed
 *     npm run test:e2e
 */
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { FincasService } from './../src/modules/fincas/fincas.service';
import { CuartelesService } from './../src/modules/cuarteles/cuarteles.service';
import { CuadrillasService } from './../src/modules/cuadrillas/cuadrillas.service';
import { Contexto, crearContexto, limpiarContexto } from './fixtures';

describe('Reactivar lo dado de baja (integración)', () => {
  let modulo: TestingModule;
  let dataSource: DataSource;
  let fincas: FincasService;
  let cuarteles: CuartelesService;
  let cuadrillas: CuadrillasService;
  let ctx: Contexto;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await modulo.init();
    dataSource = modulo.get(DataSource);
    fincas = modulo.get(FincasService);
    cuarteles = modulo.get(CuartelesService);
    cuadrillas = modulo.get(CuadrillasService);
  });

  afterAll(async () => {
    await modulo?.close();
  });

  beforeEach(async () => {
    ctx = await crearContexto(dataSource, 'reactivar');
  });

  afterEach(async () => {
    await limpiarContexto(dataSource, ctx);
  });

  it('una finca dada de baja se puede reactivar', async () => {
    await dataSource.query(
      `UPDATE cuarteles SET activo = false WHERE id = $1`,
      [ctx.cuartelId],
    );
    await fincas.desactivar(ctx.fincaId, ctx.empresaId);

    const finca = await fincas.activar(ctx.fincaId, ctx.empresaId);

    expect(finca.activa).toBe(true);
  });

  it('un cuartel no se reactiva si su finca sigue de baja', async () => {
    await dataSource.query(
      `UPDATE cuarteles SET activo = false WHERE id = $1`,
      [ctx.cuartelId],
    );
    await dataSource.query(`UPDATE fincas SET activa = false WHERE id = $1`, [
      ctx.fincaId,
    ]);

    await expect(cuarteles.activar(ctx.cuartelId)).rejects.toThrow(/finca/i);
  });

  it('un cuartel se reactiva cuando su finca está activa', async () => {
    await dataSource.query(
      `UPDATE cuarteles SET activo = false WHERE id = $1`,
      [ctx.cuartelId],
    );

    const cuartel = await cuarteles.activar(ctx.cuartelId);

    expect(cuartel.activo).toBe(true);
  });

  it('una cuadrilla se reactiva, y reactivarla dos veces no falla', async () => {
    await cuadrillas.desactivar(ctx.cuadrillaId);

    await cuadrillas.activar(ctx.cuadrillaId);
    const otraVez = await cuadrillas.activar(ctx.cuadrillaId);

    expect(otraVez.activa).toBe(true);
  });
});
