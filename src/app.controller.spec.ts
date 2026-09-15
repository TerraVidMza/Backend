import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Response } from 'express';
import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * El endpoint de salud tiene una sola responsabilidad que importa: que el
 * **código HTTP** refleje el estado real. Un monitor mira el código, no el
 * cuerpo, y un 200 con `"estado": "degradado"` adentro no despierta a nadie.
 */
describe('AppController · salud', () => {
  let controller: AppController;
  let consultar: jest.Mock;

  const armar = async (): Promise<void> => {
    consultar = jest.fn();
    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: getDataSourceToken(), useValue: { query: consultar } },
      ],
    }).compile();

    controller = modulo.get<AppController>(AppController);
  };

  const respuestaFalsa = (): { res: Response; codigo: () => number } => {
    let codigo = 0;
    const res = { status: (c: number) => (codigo = c) } as unknown as Response;
    return { res, codigo: () => codigo };
  };

  beforeEach(armar);

  it('con la base respondiendo devuelve 200 y estado ok', async () => {
    consultar.mockResolvedValue([{ '?column?': 1 }]);
    const { res, codigo } = respuestaFalsa();

    const estado = await controller.salud(res);

    expect(estado.estado).toBe('ok');
    expect(estado.base).toBe('ok');
    expect(codigo()).toBe(HttpStatus.OK);
  });

  it('con la base caída devuelve 503 y dice cuál dependencia falló', async () => {
    consultar.mockRejectedValue(new Error('ECONNREFUSED'));
    const { res, codigo } = respuestaFalsa();

    const estado = await controller.salud(res);

    expect(estado.estado).toBe('degradado');
    expect(estado.base).toBe('caida');
    expect(codigo()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('no se cae por lo mismo que está reportando', async () => {
    consultar.mockRejectedValue(new Error('la base explotó'));
    const { res } = respuestaFalsa();

    // El endpoint tiene que contestar, no propagar el error: si se cayera, el
    // monitor vería un 500 genérico y no sabría qué dependencia falló.
    await expect(controller.salud(res)).resolves.toBeDefined();
  });
});
