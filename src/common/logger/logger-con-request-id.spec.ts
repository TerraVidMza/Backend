import { LoggerConRequestId } from './logger-con-request-id';
import { almacenContexto, ContextoRequest } from '../audit/request-context';

/**
 * Lo que hace útil a este logger es que funcione **sin que nadie le pase nada**:
 * el id sale del `AsyncLocalStorage`, así que ningún service tiene que
 * acordarse de propagarlo. Se prueba escribiendo de verdad y leyendo lo que
 * salió por stdout, porque el punto es el texto final de la línea.
 */
describe('LoggerConRequestId', () => {
  let escrito: string[];
  let spy: jest.SpyInstance;

  const contexto = (requestId: string): ContextoRequest => ({
    ip: '10.0.0.1',
    usuarioId: null,
    userAgent: null,
    requestId,
  });

  beforeEach(() => {
    escrito = [];
    spy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((mensaje: string | Uint8Array) => {
        escrito.push(mensaje.toString());
        return true;
      });
  });

  afterEach(() => {
    spy.mockRestore();
  });

  const salida = (): string => escrito.join('');

  it('estampa el id de la request en curso', () => {
    const logger = new LoggerConRequestId('MiServicio');

    almacenContexto.run(contexto('abcd1234-0000-4000-8000-000000000000'), () =>
      logger.log('algo pasó'),
    );

    expect(salida()).toContain('abcd1234');
    expect(salida()).toContain('MiServicio');
    expect(salida()).toContain('algo pasó');
  });

  it('acorta el id a ocho caracteres para no empujar el mensaje', () => {
    // El valor completo viaja en la cabecera X-Request-Id de la respuesta; en
    // el log alcanza con lo suficiente para correlacionar.
    const logger = new LoggerConRequestId('MiServicio');
    const id = 'abcd1234-ffff-4000-8000-000000000000';

    almacenContexto.run(contexto(id), () => logger.log('algo pasó'));

    expect(salida()).toContain('abcd1234');
    expect(salida()).not.toContain(id);
  });

  it('fuera de una request escribe igual que el logger de Nest', () => {
    // Arranque, cron y tests no tienen contexto: no pueden quedarse sin log ni
    // romper por buscar un id que no existe.
    const logger = new LoggerConRequestId('Cron');

    logger.log('consolidación nocturna');

    expect(salida()).toContain('Cron');
    expect(salida()).toContain('consolidación nocturna');
  });

  it('dos requests distintas no comparten el id', () => {
    const logger = new LoggerConRequestId('MiServicio');

    almacenContexto.run(contexto('11111111-aaaa-4000-8000-000000000000'), () =>
      logger.log('primera'),
    );
    almacenContexto.run(contexto('22222222-bbbb-4000-8000-000000000000'), () =>
      logger.log('segunda'),
    );

    const lineas = salida().split('\n').filter(Boolean);
    const primera = lineas.find((l) => l.includes('primera'));
    const segunda = lineas.find((l) => l.includes('segunda'));

    expect(primera).toContain('11111111');
    expect(segunda).toContain('22222222');
    expect(primera).not.toContain('22222222');
  });
});
