/**
 * Circuito de remitos (HU-26, HU-27) contra PostgreSQL real.
 *
 * `remitos.service.ts` son 457 líneas sin un solo test, y es el punto donde los
 * kilos se convierten en un documento que se aprueba y en el único ingreso del
 * sistema ([D-010](../docs/DECISIONS.md)). Todo lo que importa acá es estado
 * compartido entre tablas —el remito, los pesajes que arrastra y el estado del
 * cuartel se mueven juntos dentro de una transacción— y eso no se puede
 * verificar con repositorios mockeados: lo que hay que comprobar es justamente
 * que las tres cosas quedaron consistentes después del commit.
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
import { RemitosService } from './../src/modules/remitos/remitos.service';
import { PesajeVendimiaService } from './../src/modules/pesaje-vendimia/pesaje-vendimia.service';
import { EstadoRemito } from './../src/modules/remitos/entities/remito.entity';
import { EstadoPesaje } from './../src/modules/pesaje-vendimia/entities/estado-pesaje.enum';
import { EstadoCuartel } from './../src/modules/cuarteles/entities/estado-cuartel.enum';
import {
  Contexto,
  crearContexto,
  crearContextoDeOtraEmpresa,
  darTarifa,
  limpiarContexto,
} from './fixtures';

describe('Circuito de remitos (integración)', () => {
  let modulo: TestingModule;
  let dataSource: DataSource;
  let remitos: RemitosService;
  let pesajes: PesajeVendimiaService;
  let ctx: Contexto;

  const FECHA = '2026-03-10';

  beforeAll(async () => {
    modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await modulo.init();
    dataSource = modulo.get(DataSource);
    remitos = modulo.get(RemitosService);
    pesajes = modulo.get(PesajeVendimiaService);
  });

  afterAll(async () => {
    await modulo?.close();
  });

  beforeEach(async () => {
    ctx = await crearContexto(dataSource, 'remitos');
    await darTarifa(dataSource, ctx, 20, '2026-01-01');
  });

  afterEach(async () => {
    await limpiarContexto(dataSource, ctx);
  });

  /** Sincroniza un pesaje y devuelve su id. */
  const pesar = async (kg: number, fecha = FECHA): Promise<string> => {
    const resultado = await pesajes.registrarUno(
      {
        localUuid: randomUUID(),
        cuadrillaId: ctx.cuadrillaId,
        cuartelId: ctx.cuartelId,
        fecha,
        kgTotales: kg,
      },
      ctx.usuarioId,
    );
    if (!resultado.pesajeId) {
      throw new Error(`El pesaje no se sincronizó: ${resultado.errorMessage}`);
    }
    return resultado.pesajeId;
  };

  const estadoDePesaje = async (id: string): Promise<string> => {
    const filas = await dataSource.query<{ estado: string }[]>(
      'SELECT estado FROM pesajes_vendimia WHERE id = $1',
      [id],
    );
    return filas[0].estado;
  };

  const estadoDeCuartel = async (): Promise<string> => {
    const filas = await dataSource.query<{ estado: string }[]>(
      'SELECT estado FROM cuarteles WHERE id = $1',
      [ctx.cuartelId],
    );
    return filas[0].estado;
  };

  describe('generación del borrador (HU-26)', () => {
    it('los totales son la suma de los pesajes que arrastra', async () => {
      await pesar(1000); // 20 000
      await pesar(500); //  10 000

      const remito = await remitos.generarBorrador(
        ctx.cuartelId,
        ctx.usuarioId,
      );

      expect(Number(remito.totalKg)).toBe(1500);
      expect(Number(remito.totalLiquidacion)).toBe(30000);
      expect(remito.estado).toBe(EstadoRemito.BORRADOR);
    });

    it('los pesajes incluidos quedan marcados, y no se pueden volver a remitir', async () => {
      const id = await pesar(1000);

      await remitos.generarBorrador(ctx.cuartelId, ctx.usuarioId);

      expect(await estadoDePesaje(id)).toBe(EstadoPesaje.EN_REMITO);
      // Sin pesajes pendientes ya no hay nada que remitir: si esto generara un
      // segundo remito, los mismos kilos se liquidarían dos veces.
      await expect(
        remitos.generarBorrador(ctx.cuartelId, ctx.usuarioId),
      ).rejects.toThrow();
    });

    it('un pesaje en ERROR no suma kilos al remito', async () => {
      // El pesaje sin tarifa vigente se guarda marcado en ERROR y sin monto.
      // Si entrara al remito sumaría kilos que nadie paga.
      await pesar(1000);
      await pesajes.registrarUno(
        {
          localUuid: randomUUID(),
          cuadrillaId: ctx.cuadrillaId,
          cuartelId: ctx.cuartelId,
          fecha: '2025-01-01', // anterior a toda tarifa
          kgTotales: 9999,
        },
        ctx.usuarioId,
      );

      const remito = await remitos.generarBorrador(
        ctx.cuartelId,
        ctx.usuarioId,
      );

      expect(Number(remito.totalKg)).toBe(1000);
    });

    it('sin pesajes pendientes no se genera nada', async () => {
      await expect(
        remitos.generarBorrador(ctx.cuartelId, ctx.usuarioId),
      ).rejects.toThrow(/no hay pesajes/i);
    });

    it('con fecha, liquida solo esa jornada', async () => {
      await pesar(1000, '2026-03-10');
      await pesar(700, '2026-03-11');

      const remito = await remitos.generarBorrador(
        ctx.cuartelId,
        ctx.usuarioId,
        '2026-03-11',
      );

      expect(Number(remito.totalKg)).toBe(700);
    });

    it('el número de remito es correlativo y con año', async () => {
      await pesar(1000);
      const primero = await remitos.generarBorrador(
        ctx.cuartelId,
        ctx.usuarioId,
      );

      expect(primero.numeroRemito).toMatch(/^REM-\d{4}-\d{5}$/);

      // El siguiente, en otro cuartel, tiene que ser el número siguiente.
      const otro = await crearContexto(dataSource, 'remitos-2');
      try {
        await darTarifa(dataSource, otro, 20, '2026-01-01');
        await pesajes.registrarUno(
          {
            localUuid: randomUUID(),
            cuadrillaId: otro.cuadrillaId,
            cuartelId: otro.cuartelId,
            fecha: FECHA,
            kgTotales: 100,
          },
          otro.usuarioId,
        );
        const segundo = await remitos.generarBorrador(
          otro.cuartelId,
          otro.usuarioId,
        );

        const numero = (r: string): number => Number(r.slice(-5));
        expect(numero(segundo.numeroRemito)).toBe(
          numero(primero.numeroRemito) + 1,
        );
      } finally {
        await limpiarContexto(dataSource, otro);
      }
    });
  });

  describe('aprobación (HU-27)', () => {
    it('cierra el circuito: pesajes liquidados y cuartel cosechado', async () => {
      const id = await pesar(1000);
      const remito = await remitos.generarBorrador(
        ctx.cuartelId,
        ctx.usuarioId,
      );

      expect(await estadoDeCuartel()).toBe(EstadoCuartel.EN_COSECHA);

      const aprobado = await remitos.aprobar(
        remito.id,
        ctx.usuarioId,
        ctx.empresaId,
      );

      expect(aprobado.estado).toBe(EstadoRemito.APROBADO);
      expect(aprobado.fechaAprobacion).toBeTruthy();
      expect(await estadoDePesaje(id)).toBe(EstadoPesaje.LIQUIDADO);
      expect(await estadoDeCuartel()).toBe(EstadoCuartel.COSECHADO);
    });

    it('no se aprueba dos veces', async () => {
      await pesar(1000);
      const remito = await remitos.generarBorrador(
        ctx.cuartelId,
        ctx.usuarioId,
      );
      await remitos.aprobar(remito.id, ctx.usuarioId, ctx.empresaId);

      await expect(
        remitos.aprobar(remito.id, ctx.usuarioId, ctx.empresaId),
      ).rejects.toThrow(/borrador/i);
    });

    it('un remito de otra empresa no existe, no está prohibido', async () => {
      // 404 y no 403: confirmar que el recurso existe ya sería una filtración.
      const ajeno = await crearContextoDeOtraEmpresa(dataSource, 'remitos');
      try {
        await darTarifa(dataSource, ajeno, 15, '2026-01-01');
        await pesajes.registrarUno(
          {
            localUuid: randomUUID(),
            cuadrillaId: ajeno.cuadrillaId,
            cuartelId: ajeno.cuartelId,
            fecha: FECHA,
            kgTotales: 800,
          },
          ajeno.usuarioId,
        );
        const remitoAjeno = await remitos.generarBorrador(
          ajeno.cuartelId,
          ajeno.usuarioId,
        );

        await expect(
          remitos.aprobar(remitoAjeno.id, ctx.usuarioId, ctx.empresaId),
        ).rejects.toThrow(/no encontrado/i);

        // Y sigue intacto: el intento fallido no puede haberlo tocado.
        const filas = await dataSource.query<{ estado: string }[]>(
          'SELECT estado FROM remitos WHERE id = $1',
          [remitoAjeno.id],
        );
        expect(filas[0].estado).toBe(EstadoRemito.BORRADOR);
      } finally {
        await limpiarContexto(dataSource, ajeno);
      }
    });
  });

  describe('rechazo (HU-27)', () => {
    it('los pesajes quedan observados, no vuelven al circuito solos', async () => {
      const id = await pesar(1000);
      const remito = await remitos.generarBorrador(
        ctx.cuartelId,
        ctx.usuarioId,
      );

      const rechazado = await remitos.rechazar(
        remito.id,
        ctx.usuarioId,
        'Los kilos no coinciden con la balanza de la bodega',
        ctx.empresaId,
      );

      expect(rechazado.estado).toBe(EstadoRemito.RECHAZADO);
      expect(rechazado.motivoRechazo).toMatch(/balanza/);
      // `observado` y no `pendiente_remito`: alguien tiene que revisarlos antes
      // de que vuelvan a entrar.
      expect(await estadoDePesaje(id)).toBe(EstadoPesaje.OBSERVADO);
      // Y el cuartel no se cierra.
      expect(await estadoDeCuartel()).toBe(EstadoCuartel.EN_COSECHA);
    });

    it('un remito ya rechazado no se puede aprobar', async () => {
      await pesar(1000);
      const remito = await remitos.generarBorrador(
        ctx.cuartelId,
        ctx.usuarioId,
      );
      await remitos.rechazar(remito.id, ctx.usuarioId, 'motivo', ctx.empresaId);

      await expect(
        remitos.aprobar(remito.id, ctx.usuarioId, ctx.empresaId),
      ).rejects.toThrow(/borrador/i);
    });
  });

  describe('liquidación de la bodega (HU-25, D-010)', () => {
    const aprobarRemito = async (): Promise<string> => {
      await pesar(1000);
      const remito = await remitos.generarBorrador(
        ctx.cuartelId,
        ctx.usuarioId,
      );
      await remitos.aprobar(remito.id, ctx.usuarioId, ctx.empresaId);
      return remito.id;
    };

    it('el neto es bruto menos descuentos, redondeado a dos decimales', async () => {
      const remitoId = await aprobarRemito();

      const liquidacion = await remitos.registrarLiquidacion(
        remitoId,
        {
          bodega: 'Bodega de prueba',
          kgAceptados: 980.5,
          precioPorKg: 123.456,
          descuentos: 1000,
          fecha: FECHA,
        },
        ctx.usuarioId,
        ctx.empresaId,
      );

      // 980.5 × 123.456 = 121 048.608 → menos 1000 → 120 048.61
      expect(Number(liquidacion.montoNeto)).toBe(120048.61);
    });

    it('los descuentos no pueden superar el bruto', async () => {
      const remitoId = await aprobarRemito();

      await expect(
        remitos.registrarLiquidacion(
          remitoId,
          {
            bodega: 'Bodega de prueba',
            kgAceptados: 10,
            precioPorKg: 100,
            descuentos: 5000,
            fecha: FECHA,
          },
          ctx.usuarioId,
          ctx.empresaId,
        ),
      ).rejects.toThrow(/descuentos/i);
    });

    it('solo se liquida un remito aprobado', async () => {
      // El borrador todavía no llegó a la bodega: liquidarlo sería registrar un
      // ingreso por uva que nadie recibió.
      await pesar(1000);
      const borrador = await remitos.generarBorrador(
        ctx.cuartelId,
        ctx.usuarioId,
      );

      await expect(
        remitos.registrarLiquidacion(
          borrador.id,
          {
            bodega: 'Bodega de prueba',
            kgAceptados: 1000,
            precioPorKg: 100,
            fecha: FECHA,
          },
          ctx.usuarioId,
          ctx.empresaId,
        ),
      ).rejects.toThrow(/aprobado/i);
    });

    it('registrarla de nuevo corrige la existente en vez de duplicarla', async () => {
      const remitoId = await aprobarRemito();
      const datos = {
        bodega: 'Bodega de prueba',
        kgAceptados: 1000,
        precioPorKg: 100,
        fecha: FECHA,
      };

      await remitos.registrarLiquidacion(
        remitoId,
        datos,
        ctx.usuarioId,
        ctx.empresaId,
      );
      const corregida = await remitos.registrarLiquidacion(
        remitoId,
        { ...datos, precioPorKg: 150 },
        ctx.usuarioId,
        ctx.empresaId,
      );

      expect(Number(corregida.montoNeto)).toBe(150000);

      const filas = await dataSource.query<{ n: number }[]>(
        'SELECT count(*)::int AS n FROM liquidaciones_bodega WHERE remito_id = $1',
        [remitoId],
      );
      expect(filas[0].n).toBe(1);
    });
  });
});
