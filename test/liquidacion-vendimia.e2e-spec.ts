/**
 * Liquidación automática de cuadrillas (HU-25) contra PostgreSQL real.
 *
 * Es un test de **integración**, no unitario, y la decisión es deliberada. Lo
 * que se quiere cazar acá vive del lado de la base: la precisión `decimal(10,4)`
 * de la tarifa frente al `decimal` del monto, el `valid_from` de tipo `date`
 * comparado como texto para no perder un día por huso horario, el índice único
 * que sostiene la idempotencia por `local_uuid`. Un mock del repositorio
 * devuelve lo que el test le diga y esconde exactamente esa clase de error.
 *
 * Necesita la base levantada y migrada:
 *
 *     docker compose up -d && npm run migration:run && npm run seed
 *     npm run test:e2e
 */
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { PesajeVendimiaService } from './../src/modules/pesaje-vendimia/pesaje-vendimia.service';
import { EstadoSync } from './../src/common/enums/estado-sync.enum';
import { EstadoCuartel } from './../src/modules/cuarteles/entities/estado-cuartel.enum';
import {
  Contexto,
  crearContexto,
  darTarifa,
  limpiarContexto,
} from './fixtures';

interface FilaPesaje {
  monto_liquidacion: string;
  tarifa_utilizada: string;
  kg_totales: string;
}

describe('Liquidación de vendimia (integración)', () => {
  let modulo: TestingModule;
  let dataSource: DataSource;
  let servicio: PesajeVendimiaService;
  let ctx: Contexto;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await modulo.init();
    dataSource = modulo.get(DataSource);
    servicio = modulo.get(PesajeVendimiaService);
  });

  afterAll(async () => {
    await modulo?.close();
  });

  beforeEach(async () => {
    ctx = await crearContexto(dataSource, 'liquidacion');
  });

  afterEach(async () => {
    await limpiarContexto(dataSource, ctx);
  });

  const pesaje = (kg: number, fecha: string) => ({
    localUuid: randomUUID(),
    cuadrillaId: ctx.cuadrillaId,
    cuartelId: ctx.cuartelId,
    fecha,
    kgTotales: kg,
  });

  const leer = async (localUuid: string): Promise<FilaPesaje> => {
    const filas = await dataSource.query<FilaPesaje[]>(
      'SELECT monto_liquidacion, tarifa_utilizada, kg_totales FROM pesajes_vendimia WHERE local_uuid = $1',
      [localUuid],
    );
    return filas[0];
  };

  describe('el monto que se persiste', () => {
    it('es tarifa × kilos', async () => {
      await darTarifa(dataSource, ctx, 25, '2026-01-01');
      const dto = pesaje(1500, '2026-03-10');

      await servicio.registrarUno(dto, ctx.usuarioId);

      expect(Number((await leer(dto.localUuid)).monto_liquidacion)).toBe(37500);
    });

    it('se redondea a dos decimales, que es lo que se paga', async () => {
      // 0.3333 × 1000 = 333.3 exacto; con 1001 kg da 333.6333, que en pesos no
      // existe. El redondeo tiene que estar en el cálculo y no delegado al tipo
      // de la columna.
      await darTarifa(dataSource, ctx, 0.3333, '2026-01-01');
      const dto = pesaje(1001, '2026-03-10');

      await servicio.registrarUno(dto, ctx.usuarioId);

      expect(Number((await leer(dto.localUuid)).monto_liquidacion)).toBe(
        333.63,
      );
    });

    it('no arrastra el error de coma flotante en kilos con decimales', async () => {
      // 0.1 × 3 en coma flotante da 0.30000000000000004. Con plata, ese arrastre
      // termina en un centavo de diferencia entre lo que dice el remito y lo que
      // suma la liquidación.
      await darTarifa(dataSource, ctx, 0.1, '2026-01-01');
      const dto = pesaje(3, '2026-03-10');

      await servicio.registrarUno(dto, ctx.usuarioId);

      expect(Number((await leer(dto.localUuid)).monto_liquidacion)).toBe(0.3);
    });
  });

  describe('qué tarifa se aplica', () => {
    it('la vigente a la fecha del pesaje, no la última cargada', async () => {
      // El caso real: se cosecha en marzo, el Propietario carga en abril la
      // tarifa nueva, y un pesaje de marzo que se sincroniza tarde no puede
      // liquidarse con la tarifa de abril.
      await darTarifa(dataSource, ctx, 20, '2026-01-01');
      await darTarifa(dataSource, ctx, 35, '2026-04-01');
      const dto = pesaje(1000, '2026-03-10');

      await servicio.registrarUno(dto, ctx.usuarioId);

      const fila = await leer(dto.localUuid);
      expect(Number(fila.tarifa_utilizada)).toBe(20);
      expect(Number(fila.monto_liquidacion)).toBe(20000);
    });

    it('la del mismo día que empieza a regir, no la anterior', async () => {
      await darTarifa(dataSource, ctx, 20, '2026-01-01');
      await darTarifa(dataSource, ctx, 35, '2026-04-01');
      const dto = pesaje(1000, '2026-04-01');

      await servicio.registrarUno(dto, ctx.usuarioId);

      expect(Number((await leer(dto.localUuid)).tarifa_utilizada)).toBe(35);
    });

    it('sin tarifa vigente a esa fecha, el pesaje no se liquida', async () => {
      // Sin este corte el pesaje sumaría kilos al remito sin sumar dinero, en
      // silencio: el peor de los resultados posibles.
      //
      // No lanza: guarda el pesaje marcado en ERROR con el motivo, que es lo
      // correcto para un cliente offline —el capataz no puede perder los kilos
      // que ya pesó porque falta un dato que carga el Propietario—.
      await darTarifa(dataSource, ctx, 20, '2026-04-01');

      const resultado = await servicio.registrarUno(
        pesaje(1000, '2026-03-10'),
        ctx.usuarioId,
      );

      expect(resultado.estado).toBe(EstadoSync.ERROR);
      expect(resultado.errorMessage).toMatch(/tarifa vigente/i);

      // Y lo que quedó guardado no tiene monto: nada entra al circuito de
      // remitos con kilos y sin plata.
      const fila = await leer(resultado.localUuid);
      expect(fila.monto_liquidacion).toBeNull();
    });

    it('la tarifa aplicada queda congelada en el pesaje', async () => {
      await darTarifa(dataSource, ctx, 20, '2026-01-01');
      const dto = pesaje(1000, '2026-03-10');
      await servicio.registrarUno(dto, ctx.usuarioId);

      // Cargar una tarifa nueva no puede reescribir lo ya liquidado: la tabla
      // es append-only justamente para preservar el histórico.
      await darTarifa(dataSource, ctx, 99, '2026-03-01');

      const fila = await leer(dto.localUuid);
      expect(Number(fila.tarifa_utilizada)).toBe(20);
      expect(Number(fila.monto_liquidacion)).toBe(20000);
    });
  });

  describe('idempotencia de la sincronización (HU-14)', () => {
    it('reenviar el mismo localUuid no duplica ni recalcula', async () => {
      await darTarifa(dataSource, ctx, 20, '2026-01-01');
      const dto = pesaje(1000, '2026-03-10');

      const primero = await servicio.registrarUno(dto, ctx.usuarioId);
      const segundo = await servicio.registrarUno(dto, ctx.usuarioId);

      expect(primero.estado).toBe(EstadoSync.SINCRONIZADO);
      expect(segundo.estado).toBe(EstadoSync.SINCRONIZADO);

      const filas = await dataSource.query<{ n: number }[]>(
        'SELECT count(*)::int AS n FROM pesajes_vendimia WHERE local_uuid = $1',
        [dto.localUuid],
      );
      expect(filas[0].n).toBe(1);
    });

    it('un ítem inválido no tumba el resto del lote', async () => {
      await darTarifa(dataSource, ctx, 20, '2026-01-01');
      const bueno = pesaje(1000, '2026-03-10');
      const malo = {
        ...pesaje(500, '2026-03-11'),
        cuartelId: randomUUID(), // no existe
      };
      const otroBueno = pesaje(250, '2026-03-12');

      const resultados = await servicio.sincronizarLote(
        [bueno, malo, otroBueno],
        ctx.usuarioId,
      );

      expect(resultados).toHaveLength(3);
      expect(resultados[0].estado).toBe(EstadoSync.SINCRONIZADO);
      expect(resultados[1].estado).toBe(EstadoSync.ERROR);
      expect(resultados[2].estado).toBe(EstadoSync.SINCRONIZADO);
    });
  });

  describe('estado de cosecha del cuartel (HU-28)', () => {
    it('el primer pesaje pasa el cuartel a en_cosecha', async () => {
      await darTarifa(dataSource, ctx, 20, '2026-01-01');

      const antes = await dataSource.query<{ estado: string }[]>(
        'SELECT estado FROM cuarteles WHERE id = $1',
        [ctx.cuartelId],
      );
      expect(antes[0].estado).toBe(EstadoCuartel.PENDIENTE);

      await servicio.registrarUno(pesaje(1000, '2026-03-10'), ctx.usuarioId);

      const despues = await dataSource.query<{ estado: string }[]>(
        'SELECT estado FROM cuarteles WHERE id = $1',
        [ctx.cuartelId],
      );
      expect(despues[0].estado).toBe(EstadoCuartel.EN_COSECHA);
    });

    it('un cuartel ya cosechado no acepta pesajes nuevos', async () => {
      // Su remito ya está aprobado: kilos nuevos quedarían fuera de toda
      // liquidación.
      await darTarifa(dataSource, ctx, 20, '2026-01-01');
      await dataSource.query('UPDATE cuarteles SET estado = $1 WHERE id = $2', [
        EstadoCuartel.COSECHADO,
        ctx.cuartelId,
      ]);

      const resultado = await servicio.registrarUno(
        pesaje(1000, '2026-03-10'),
        ctx.usuarioId,
      );

      expect(resultado.estado).toBe(EstadoSync.ERROR);
      expect(resultado.errorMessage).toMatch(/cosechado/i);
    });
  });
});
