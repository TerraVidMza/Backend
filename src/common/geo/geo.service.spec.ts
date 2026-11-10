import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GeoService, HECTAREAS_MAXIMAS } from './geo.service';
import { PoligonoGeoJson } from './poligono';

const POLIGONO: PoligonoGeoJson = {
  type: 'Polygon',
  coordinates: [
    [
      [-68.9, -33.0],
      [-68.89, -33.0],
      [-68.89, -33.01],
      [-68.9, -33.01],
      [-68.9, -33.0],
    ],
  ],
};

/** Fila que devuelve PostGIS para un polígono válido de ~103,64 ha. */
const FILA_VALIDA = {
  valido: true,
  motivo: 'Valid Geometry',
  hectareas: '103.6412345',
  latitud: '-33.0050000001',
  longitud: '-68.8950000001',
};

describe('GeoService', () => {
  let query: jest.Mock;
  let service: GeoService;

  beforeEach(() => {
    query = jest.fn(() => Promise.resolve([FILA_VALIDA]));
    service = new GeoService({ query } as unknown as DataSource);
  });

  describe('analizar', () => {
    it('devuelve hectáreas a 2 decimales y el punto a 7', async () => {
      await expect(service.analizar(POLIGONO)).resolves.toEqual({
        hectareas: 103.64,
        latitud: -33.005,
        longitud: -68.895,
      });
    });

    it('manda el polígono como GeoJSON en texto, no armando SQL a mano', async () => {
      await service.analizar(POLIGONO);

      const [sql, parametros] = query.mock.calls[0] as [string, string[]];
      expect(sql).not.toContain('-68.9');
      expect(parametros).toEqual([JSON.stringify(POLIGONO)]);
    });

    it('rechaza con 400 un polígono que se cruza a sí mismo', async () => {
      query.mockResolvedValueOnce([
        {
          valido: false,
          motivo: 'Self-intersection[1 1]',
          hectareas: null,
          latitud: null,
          longitud: null,
        },
      ]);

      await expect(service.analizar(POLIGONO)).rejects.toThrow(
        /se cruza a sí mismo.*Self-intersection/,
      );
    });

    it('rechaza con 400 un polígono demasiado chico', async () => {
      query.mockResolvedValueOnce([{ ...FILA_VALIDA, hectareas: '0.001' }]);

      await expect(service.analizar(POLIGONO)).rejects.toThrow(
        /demasiado chico/,
      );
    });

    it('rechaza con 400 un polígono absurdamente grande y sugiere el orden de las coordenadas', async () => {
      query.mockResolvedValueOnce([
        { ...FILA_VALIDA, hectareas: String(HECTAREAS_MAXIMAS + 1) },
      ]);

      await expect(service.analizar(POLIGONO)).rejects.toThrow(
        /demasiado grande.*longitud, latitud/,
      );
    });

    it('traduce un GeoJSON que la base no puede interpretar a un 400, no a un 500', async () => {
      query.mockRejectedValueOnce(new Error('invalid GeoJSON representation'));

      await expect(service.analizar(POLIGONO)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('derivar', () => {
    const conPoligono = {
      poligono: POLIGONO,
      hectareas: 25 as number | string | null,
      latitud: -33.1 as number | string | null,
      longitud: -68.5 as number | string | null,
    };
    const sinPoligono = { ...conPoligono, poligono: null };

    it('con polígono, deriva los tres campos y pisa lo que venga en el pedido', async () => {
      const resultado = await service.derivar(
        { poligono: POLIGONO, hectareas: 999 },
        null,
        'finca',
      );

      expect(resultado.hectareas).toBe(103.64);
    });

    it('sin polígono en el pedido ni en la entidad, no toca nada', async () => {
      await expect(
        service.derivar({ hectareas: 30 }, sinPoligono, 'finca'),
      ).resolves.toEqual({});
      expect(query).not.toHaveBeenCalled();
    });

    it('poligono: null quita el contorno y acepta los valores a mano', async () => {
      await expect(
        service.derivar(
          { poligono: null, hectareas: 30 },
          conPoligono,
          'finca',
        ),
      ).resolves.toEqual({});
    });

    it('no deja cambiar a mano las hectáreas de una finca que tiene polígono', async () => {
      await expect(
        service.derivar({ hectareas: 30 }, conPoligono, 'finca'),
      ).rejects.toThrow(/Esta finca tiene polígono: hectareas/);
    });

    it('usa el artículo correcto para un cuartel', async () => {
      await expect(
        service.derivar({ latitud: -33.5 }, conPoligono, 'cuartel'),
      ).rejects.toThrow(/Este cuartel tiene polígono: latitud/);
    });

    it('mandar el valor que ya tiene no cuenta como un cambio, aunque venga como texto', async () => {
      // `decimal` vuelve como string desde Postgres: '25.00' es lo mismo que 25.
      await expect(
        service.derivar(
          { hectareas: 25 },
          { ...conPoligono, hectareas: '25.00' },
          'finca',
        ),
      ).resolves.toEqual({});
    });

    it('lista todos los campos que se quisieron cambiar', async () => {
      await expect(
        service.derivar(
          { hectareas: 30, latitud: -33.5, longitud: -68.1 },
          conPoligono,
          'finca',
        ),
      ).rejects.toThrow(/hectareas, latitud, longitud/);
    });
  });

  describe('advertenciaCuartelFueraDeFinca', () => {
    it('no avisa si la finca no tiene polígono (la consulta no devuelve filas)', async () => {
      query.mockResolvedValueOnce([]);

      await expect(
        service.advertenciaCuartelFueraDeFinca('finca-1', POLIGONO),
      ).resolves.toBeNull();
    });

    it('no avisa si el cuartel queda adentro', async () => {
      query.mockResolvedValueOnce([{ fuera: false, porcentaje: '0' }]);

      await expect(
        service.advertenciaCuartelFueraDeFinca('finca-1', POLIGONO),
      ).resolves.toBeNull();
    });

    it('avisa, con el porcentaje que queda afuera, si el cuartel se sale', async () => {
      query.mockResolvedValueOnce([{ fuera: true, porcentaje: '37.456' }]);

      await expect(
        service.advertenciaCuartelFueraDeFinca('finca-1', POLIGONO),
      ).resolves.toMatch(/37,5|37\.5 %/);
    });
  });

  describe('advertenciaCuartelesFueraDelContorno', () => {
    it('no avisa si todos los cuarteles siguen adentro', async () => {
      query.mockResolvedValueOnce([]);

      await expect(
        service.advertenciaCuartelesFueraDelContorno('finca-1', POLIGONO),
      ).resolves.toBeNull();
    });

    it('nombra al cuartel que queda afuera, en singular', async () => {
      query.mockResolvedValueOnce([{ nombre: 'Cuartel 3' }]);

      await expect(
        service.advertenciaCuartelesFueraDelContorno('finca-1', POLIGONO),
      ).resolves.toMatch(/Un cuartel.*Cuartel 3/);
    });

    it('cuenta y nombra a varios, en plural', async () => {
      query.mockResolvedValueOnce([{ nombre: 'A' }, { nombre: 'B' }]);

      await expect(
        service.advertenciaCuartelesFueraDelContorno('finca-1', POLIGONO),
      ).resolves.toMatch(/2 cuarteles.*A, B/);
    });
  });
});
