/**
 * Metas de cosecha y ubicación de los registros de campo (D-027), contra
 * PostgreSQL real.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { MetasCosechaService } from './../src/modules/metas-cosecha/metas-cosecha.service';
import { PesajeVendimiaService } from './../src/modules/pesaje-vendimia/pesaje-vendimia.service';
import { CampaniasService } from './../src/modules/campanias/campanias.service';
import {
  crearContexto,
  darTarifa,
  limpiarContexto,
  type Contexto,
} from './fixtures';
import { hoyLocal } from './../src/common/fechas/rango-fechas';

describe('Metas de cosecha y GPS (integración, D-027)', () => {
  let modulo: TestingModule;
  let dataSource: DataSource;
  let metas: MetasCosechaService;
  let pesajes: PesajeVendimiaService;
  let ctx: Contexto;
  let campaniaId: string;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await modulo.init();
    dataSource = modulo.get(DataSource);
    metas = modulo.get(MetasCosechaService);
    pesajes = modulo.get(PesajeVendimiaService);
    ctx = await crearContexto(dataSource);
    await darTarifa(dataSource, ctx, 10, '2020-01-01');
    const actual = await modulo.get(CampaniasService).getActual(ctx.empresaId);
    if (!actual)
      throw new Error('El seed tiene que dejar una campaña en curso');
    campaniaId = actual.id;
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM metas_cosecha WHERE cuartel_id = $1', [
      ctx.cuartelId,
    ]);
    await limpiarContexto(dataSource, ctx);
    await modulo?.close();
  });

  it('sin meta, el cuartel figura con metaKg null', async () => {
    const avance = await metas.avanceActual(ctx.empresaId, ctx.fincaId);
    expect(avance.campania?.id).toBe(campaniaId);
    expect(
      avance.cuarteles.find((c) => c.cuartelId === ctx.cuartelId)?.metaKg,
    ).toBeNull();
  });

  it('fija la meta, suma los kilos pesados y guarda la ubicación del pesaje', async () => {
    await metas.fijar(
      campaniaId,
      ctx.cuartelId,
      5000,
      ctx.usuarioId,
      ctx.empresaId,
    );
    const localUuid = randomUUID();
    await pesajes.registrarUno(
      {
        localUuid,
        cuadrillaId: ctx.cuadrillaId,
        cuartelId: ctx.cuartelId,
        fecha: hoyLocal(),
        kgTotales: 1250,
        latitud: -33.1234567,
        longitud: -68.7654321,
      },
      ctx.usuarioId,
    );

    const avance = await metas.avanceActual(ctx.empresaId, ctx.fincaId);
    expect(avance.metaKg).toBe(5000);
    expect(
      avance.cuarteles.find((c) => c.cuartelId === ctx.cuartelId),
    ).toMatchObject({
      metaKg: 5000,
      kgCosechados: 1250,
    });

    const [fila] = await dataSource.query<
      { latitud: string; longitud: string }[]
    >('SELECT latitud, longitud FROM pesajes_vendimia WHERE local_uuid = $1', [
      localUuid,
    ]);
    expect(Number(fila.latitud)).toBeCloseTo(-33.1234567, 6);
    expect(Number(fila.longitud)).toBeCloseTo(-68.7654321, 6);
  });

  it('meta 0 la borra', async () => {
    await metas.fijar(
      campaniaId,
      ctx.cuartelId,
      0,
      ctx.usuarioId,
      ctx.empresaId,
    );
    const avance = await metas.avanceActual(ctx.empresaId, ctx.fincaId);
    expect(
      avance.cuarteles.find((c) => c.cuartelId === ctx.cuartelId)?.metaKg,
    ).toBeNull();
  });

  it('no deja fijar metas en la campaña de otra empresa', async () => {
    await expect(
      metas.fijar(
        randomUUID(),
        ctx.cuartelId,
        100,
        ctx.usuarioId,
        ctx.empresaId,
      ),
    ).rejects.toThrow('Campaña no encontrada');
  });
});
