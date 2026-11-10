/**
 * Cierre y reapertura de tickets de soporte contra PostgreSQL real. Un ticket
 * nacía abierto y no había forma de cambiarlo.
 *
 *     docker compose up -d && npm run migration:run && npm run seed
 *     npm run test:e2e
 */
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { TicketSoporteService } from './../src/modules/ayuda/ticket-soporte.service';
import { EstadoTicket } from './../src/modules/ayuda/entities/ticket-soporte.entity';
import { ModuloAyuda } from './../src/modules/ayuda/entities/articulo-ayuda.entity';
import { Contexto, crearContexto, limpiarContexto } from './fixtures';

describe('Tickets de soporte: cerrar y reabrir (integración)', () => {
  let modulo: TestingModule;
  let dataSource: DataSource;
  let tickets: TicketSoporteService;
  let ctx: Contexto;
  let ticketId: string;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await modulo.init();
    dataSource = modulo.get(DataSource);
    tickets = modulo.get(TicketSoporteService);
  });

  afterAll(async () => {
    await modulo?.close();
  });

  beforeEach(async () => {
    ctx = await crearContexto(dataSource, 'tickets');
    const ticket = await tickets.crear(
      { modulo: ModuloAyuda.FINCAS, descripcion: 'No puedo cargar una finca' },
      ctx.usuarioId,
    );
    ticketId = ticket.id;
  });

  afterEach(async () => {
    await dataSource.query(
      `DELETE FROM tickets_soporte WHERE usuario_id = $1`,
      [ctx.usuarioId],
    );
    await limpiarContexto(dataSource, ctx);
  });

  it('un ticket nuevo nace abierto', async () => {
    const lista = await tickets.findAll(ctx.empresaId);

    expect(lista.find((t) => t.id === ticketId)?.estado).toBe(
      EstadoTicket.ABIERTO,
    );
  });

  it('se cierra y se reabre', async () => {
    const cerrado = await tickets.cambiarEstado(
      ticketId,
      EstadoTicket.CERRADO,
      ctx.empresaId,
    );
    expect(cerrado.estado).toBe(EstadoTicket.CERRADO);

    const reabierto = await tickets.cambiarEstado(
      ticketId,
      EstadoTicket.ABIERTO,
      ctx.empresaId,
    );
    expect(reabierto.estado).toBe(EstadoTicket.ABIERTO);
  });

  it('no toca tickets de otra empresa', async () => {
    await expect(
      tickets.cambiarEstado(ticketId, EstadoTicket.CERRADO, randomUUID()),
    ).rejects.toThrow(/no encontrado/i);
  });
});
