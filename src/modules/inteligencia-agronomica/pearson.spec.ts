import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { InteligenciaAgronomicaService } from './inteligencia-agronomica.service';
import { Cuartel } from '../cuarteles/entities/cuartel.entity';
import { Sensor } from '../sensores/entities/sensor.entity';
import { LecturaIot } from '../lecturas-iot/entities/lectura-iot.entity';
import { AlertaIot } from '../alertas-iot/entities/alerta-iot.entity';
import { RegistroLabor } from '../registro-labor/entities/registro-labor.entity';
import { DetalleInsumoLabor } from '../registro-labor/entities/detalle-insumo-labor.entity';
import { PesajeVendimia } from '../pesaje-vendimia/entities/pesaje-vendimia.entity';
import { LiquidacionBodega } from '../remitos/entities/liquidacion-bodega.entity';
import { Recomendacion } from './entities/recomendacion.entity';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { CampaniasService } from '../campanias/campanias.service';

/**
 * Pearson y su interpretación (HU-29, F1-10).
 *
 * Los dos son privados: se los alcanza por índice para no ensanchar la API
 * pública del service solo para poder testear. Es deliberado —el cálculo no
 * tiene por qué ser parte del contrato— y está acotado a este archivo.
 */
type ServicioInterno = {
  pearson(x: number[], y: number[]): number | null;
  interpretarCorrelacion(r: number | null): string;
};

const repoFalso = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  query: jest.fn(),
});

describe('Pearson (HU-29)', () => {
  let interno: ServicioInterno;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        InteligenciaAgronomicaService,
        ...[
          Cuartel,
          Sensor,
          LecturaIot,
          AlertaIot,
          RegistroLabor,
          DetalleInsumoLabor,
          PesajeVendimia,
          LiquidacionBodega,
          Recomendacion,
        ].map((entidad) => ({
          provide: getRepositoryToken(entidad),
          useValue: repoFalso(),
        })),
        {
          provide: ConfiguracionService,
          useValue: { getZonaHoraria: jest.fn() },
        },
        { provide: CampaniasService, useValue: { getRango: jest.fn() } },
      ],
    }).compile();

    interno = moduleRef.get(InteligenciaAgronomicaService);
  });

  const serie = (n: number, f: (i: number) => number) =>
    Array.from({ length: n }, (_, i) => f(i));

  it('r = 1 con una relación lineal creciente perfecta', () => {
    const x = serie(10, (i) => i);
    const y = serie(10, (i) => 3 * i + 5);
    expect(interno.pearson(x, y)).toBe(1);
  });

  it('r = −1 con una relación lineal decreciente perfecta', () => {
    const x = serie(10, (i) => i);
    const y = serie(10, (i) => -2 * i + 100);
    expect(interno.pearson(x, y)).toBe(-1);
  });

  /**
   * r = 0 exacto con una parábola simétrica: la covarianza se cancela término a
   * término. Es el caso que conviene tener presente al leer HU-29 — las dos
   * series están **perfectamente relacionadas** y aun así Pearson da cero,
   * porque solo mide relación *lineal*. Un r bajo no prueba independencia.
   */
  it('r = 0 aunque exista una relación no lineal perfecta', () => {
    const x = [-3, -2, -1, 0, 1, 2, 3];
    const y = x.map((v) => v * v);
    expect(interno.pearson(x, y)).toBe(0);
  });

  /**
   * Sin varianza el coeficiente es 0/0. Devolver `null` y no 0 importa: 0 se
   * lee como "no hay relación" cuando en realidad no hay nada que medir.
   */
  it('una serie constante devuelve null, no cero', () => {
    const x = serie(10, () => 20);
    const y = serie(10, (i) => i);
    expect(interno.pearson(x, y)).toBeNull();
    expect(interno.pearson(y, x)).toBeNull();
  });

  /**
   * Regresión de F1-10: el umbral estaba en n<2, así que dos puntos —que son
   * colineales por definición— se publicaban como correlación perfecta.
   */
  it('con menos de 7 pares no calcula', () => {
    for (let n = 2; n < 7; n++) {
      const x = serie(n, (i) => i);
      const y = serie(n, (i) => 2 * i);
      expect(interno.pearson(x, y)).toBeNull();
    }
    expect(
      interno.pearson(
        serie(7, (i) => i),
        serie(7, (i) => 2 * i),
      ),
    ).toBe(1);
  });

  it('interpreta el coeficiente con los cortes de |r|', () => {
    expect(interno.interpretarCorrelacion(null)).toBe('Sin datos suficientes');
    expect(interno.interpretarCorrelacion(0.85)).toBe(
      'Correlación fuerte positiva',
    );
    expect(interno.interpretarCorrelacion(-0.85)).toBe(
      'Correlación fuerte negativa',
    );
    expect(interno.interpretarCorrelacion(0.5)).toBe(
      'Correlación moderada positiva',
    );
    expect(interno.interpretarCorrelacion(-0.25)).toBe(
      'Correlación débil negativa',
    );
    expect(interno.interpretarCorrelacion(0.05)).toBe(
      'Sin correlación apreciable',
    );
  });
});
