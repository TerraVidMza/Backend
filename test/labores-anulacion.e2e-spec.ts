/**
 * Corregir y anular labores contra PostgreSQL real. Lo que importa es que una
 * labor anulada **sale del costeo**: se comprueba contra el cálculo real de
 * margen bruto, no con repositorios mockeados.
 *
 *     docker compose up -d && npm run migration:run && npm run seed
 *     npm run test:e2e
 */
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { RegistroLaborService } from './../src/modules/registro-labor/registro-labor.service';
import { EstadoSync } from './../src/common/enums/estado-sync.enum';
import { Contexto, crearContexto, limpiarContexto } from './fixtures';

describe('Labores: corregir y anular (integración)', () => {
  let modulo: TestingModule;
  let dataSource: DataSource;
  let labores: RegistroLaborService;
  let ctx: Contexto;
  let tipoLaborId: string;
  let laborId: string;

  const hoy = new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await modulo.init();
    dataSource = modulo.get(DataSource);
    labores = modulo.get(RegistroLaborService);
  });

  afterAll(async () => {
    await modulo?.close();
  });

  beforeEach(async () => {
    ctx = await crearContexto(dataSource, 'labores');
    const [tipo] = await dataSource.query<Array<{ id: string }>>(
      `INSERT INTO tipo_labor (empresa_id, nombre, unidad_medida)
       VALUES ($1, $2, 'jornal') RETURNING id`,
      [ctx.empresaId, `Labor test ${randomUUID().slice(0, 8)}`],
    );
    tipoLaborId = tipo.id;
    const [labor] = await dataSource.query<Array<{ id: string }>>(
      `INSERT INTO registro_labor
         (local_uuid, cuartel_id, tipo_labor_id, usuario_id, fecha, cantidad,
          costo_unitario_al_sync, estado_sync)
       VALUES ($1, $2, $3, $4, $5, 5, 100, 'sincronizado') RETURNING id`,
      [randomUUID(), ctx.cuartelId, tipoLaborId, ctx.usuarioId, hoy],
    );
    laborId = labor.id;
  });

  afterEach(async () => {
    await dataSource.query(`DELETE FROM registro_labor WHERE cuartel_id = $1`, [
      ctx.cuartelId,
    ]);
    await dataSource.query(`DELETE FROM tipo_labor WHERE id = $1`, [
      tipoLaborId,
    ]);
    await limpiarContexto(dataSource, ctx);
  });

  it('corregir la cantidad recalcula el costo del cuartel', async () => {
    await labores.corregir(laborId, { cantidad: 8 }, ctx.empresaId);

    const margen = await labores.getMargenBrutoPorCuartel(ctx.cuartelId);

    expect(margen.costoLabores).toBe(800);
  });

  it('una labor anulada sale del costeo y queda con su motivo', async () => {
    const anulada = await labores.anular(
      laborId,
      'Se cargó en el cuartel equivocado',
      ctx.usuarioId,
      ctx.empresaId,
    );

    expect(anulada.estadoSync).toBe(EstadoSync.ANULADO);
    expect(anulada.motivoAnulacion).toMatch(/equivocado/);
    expect(anulada.anuladoPorId).toBe(ctx.usuarioId);
    const margen = await labores.getMargenBrutoPorCuartel(ctx.cuartelId);
    expect(margen.costoLabores).toBe(0);
  });

  it('una labor anulada no aparece en el historial ni se puede corregir', async () => {
    await labores.anular(
      laborId,
      'Se cargó en el cuartel equivocado',
      ctx.usuarioId,
      ctx.empresaId,
    );

    const historial = await labores.findByCuartel(ctx.cuartelId);
    expect(historial.data.map((l) => l.id)).not.toContain(laborId);
    await expect(
      labores.corregir(laborId, { cantidad: 9 }, ctx.empresaId),
    ).rejects.toThrow(/sincronizada/i);
  });

  it('anular dos veces no pisa el motivo original', async () => {
    await labores.anular(
      laborId,
      'Se cargó en el cuartel equivocado',
      ctx.usuarioId,
      ctx.empresaId,
    );

    await expect(
      labores.anular(
        laborId,
        'Otro motivo cualquiera',
        ctx.usuarioId,
        ctx.empresaId,
      ),
    ).rejects.toThrow(/anulada/i);
  });

  it('no se corrige una labor de una campaña cerrada', async () => {
    // Un año lejano: la empresa de prueba comparte campañas con el seed y las
    // campañas no pueden solaparse.
    await dataSource.query(
      `UPDATE registro_labor SET fecha = '2001-06-15' WHERE id = $1`,
      [laborId],
    );
    const [campania] = await dataSource.query<Array<{ id: string }>>(
      `INSERT INTO campanias (empresa_id, nombre, fecha_desde, fecha_hasta, cerrada)
       VALUES ($1, $2, '2001-01-01', '2001-12-31', true) RETURNING id`,
      [ctx.empresaId, `Campaña test ${randomUUID().slice(0, 8)}`],
    );
    try {
      await expect(
        labores.corregir(laborId, { cantidad: 9 }, ctx.empresaId),
      ).rejects.toThrow(/cerrada/i);
    } finally {
      await dataSource.query(`DELETE FROM campanias WHERE id = $1`, [
        campania.id,
      ]);
    }
  });

  it('no corrige ni anula labores de otra empresa', async () => {
    await expect(
      labores.corregir(laborId, { cantidad: 9 }, randomUUID()),
    ).rejects.toThrow(/no encontrado/i);
    await expect(
      labores.anular(
        laborId,
        'Se cargó en el cuartel equivocado',
        ctx.usuarioId,
        randomUUID(),
      ),
    ).rejects.toThrow(/no encontrado/i);
  });
});
