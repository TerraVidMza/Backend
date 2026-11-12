import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';

import { AuditoriaInterceptor } from './auditoria.interceptor';
import { OpcionesAuditoria } from './auditar.decorator';
import { LogAuditoriaService } from '../../modules/log-auditoria/log-auditoria.service';

const REMITO_ID = '22222222-2222-2222-2222-222222222222';

function contexto(body: unknown): ExecutionContext {
  const request = {
    user: { id: 'user-1' },
    params: { id: REMITO_ID },
    body,
  };
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AuditoriaInterceptor', () => {
  let registrar: jest.Mock;

  async function ejecutar(
    opciones: OpcionesAuditoria,
    body: unknown,
    resultado: unknown,
  ) {
    const reflector = {
      getAllAndOverride: () => opciones,
    } as unknown as Reflector;
    const interceptor = new AuditoriaInterceptor(reflector, {
      registrar,
    } as unknown as LogAuditoriaService);
    const next: CallHandler = { handle: () => of(resultado) };
    await lastValueFrom(interceptor.intercept(contexto(body), next));
    const [[log]] = registrar.mock.calls as [[Record<string, unknown>]];
    return log;
  }

  beforeEach(() => {
    registrar = jest.fn(() => Promise.resolve());
  });

  it('sin transición guarda solo el cuerpo, como antes', async () => {
    const log = await ejecutar(
      { accion: 'CREAR_TIPO_LABOR', entidad: 'tipo_labor' },
      { nombre: 'Raleo' },
      { id: 'tl-1' },
    );

    expect(log.datosAnteriores).toBeNull();
    expect(log.datosNuevos).toEqual({ nombre: 'Raleo' });
    expect(log.entidadId).toBe('tl-1');
  });

  it('registra el estado anterior y el nuevo de una aprobación (HU-27)', async () => {
    const log = await ejecutar(
      {
        accion: 'APROBAR_REMITO',
        entidad: 'remito',
        idDesde: 'param:id',
        transicion: { campo: 'estado', desde: 'borrador' },
      },
      undefined,
      { id: REMITO_ID, estado: 'aprobado' },
    );

    expect(log).toMatchObject({
      actorId: 'user-1',
      accion: 'APROBAR_REMITO',
      entidadId: REMITO_ID,
      datosAnteriores: { estado: 'borrador' },
      datosNuevos: { estado: 'aprobado' },
    });
  });

  it('en un rechazo conserva el motivo junto al estado nuevo', async () => {
    const log = await ejecutar(
      {
        accion: 'RECHAZAR_REMITO',
        entidad: 'remito',
        idDesde: 'param:id',
        transicion: { campo: 'estado', desde: 'borrador' },
      },
      { motivoRechazo: 'Los kilos no coinciden con la balanza' },
      { id: REMITO_ID, estado: 'rechazado' },
    );

    expect(log.datosAnteriores).toEqual({ estado: 'borrador' });
    expect(log.datosNuevos).toEqual({
      motivoRechazo: 'Los kilos no coinciden con la balanza',
      estado: 'rechazado',
    });
  });

  it('si el handler no devuelve el campo, no inventa la transición', async () => {
    const log = await ejecutar(
      {
        accion: 'APROBAR_REMITO',
        entidad: 'remito',
        idDesde: 'param:id',
        transicion: { campo: 'estado', desde: 'borrador' },
      },
      undefined,
      undefined,
    );

    expect(log.datosAnteriores).toBeNull();
    expect(log.datosNuevos).toBeNull();
  });
});
