import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  armarResultado,
  calcularPaginacion,
  PaginationQueryDto,
  TAMANIO_PAGINA_MAXIMO,
  TAMANIO_PAGINA_POR_DEFECTO,
} from './pagination-query.dto';

function validar(payload: Record<string, unknown>) {
  return validateSync(plainToInstance(PaginationQueryDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('PaginationQueryDto', () => {
  // Los query params llegan como string: sin @Type(() => Number) esto falla.
  it('acepta los parámetros como string, que es como llegan por querystring', () => {
    expect(validar({ page: '2', pageSize: '50' })).toHaveLength(0);
  });

  it('acepta la ausencia de parámetros', () => {
    expect(validar({})).toHaveLength(0);
  });

  it('rechaza una página menor a 1', () => {
    expect(validar({ page: '0' })).not.toHaveLength(0);
  });

  it('rechaza un pageSize por encima del techo', () => {
    expect(
      validar({ pageSize: String(TAMANIO_PAGINA_MAXIMO + 1) }),
    ).not.toHaveLength(0);
  });

  it('rechaza un valor no numérico', () => {
    expect(validar({ page: 'muchas' })).not.toHaveLength(0);
  });
});

describe('calcularPaginacion', () => {
  it('aplica los valores por defecto', () => {
    expect(calcularPaginacion({})).toEqual({
      page: 1,
      pageSize: TAMANIO_PAGINA_POR_DEFECTO,
      skip: 0,
      take: TAMANIO_PAGINA_POR_DEFECTO,
    });
  });

  it('calcula el offset a partir de la página', () => {
    expect(calcularPaginacion({ page: 3, pageSize: 10 })).toMatchObject({
      skip: 20,
      take: 10,
    });
  });

  // Defensa en profundidad: aunque el DTO ya valide, un service que llame
  // directo a esta función no puede quedar sin techo.
  it('recorta un pageSize excesivo aunque el DTO no lo haya validado', () => {
    expect(calcularPaginacion({ pageSize: 100_000 }).take).toBe(
      TAMANIO_PAGINA_MAXIMO,
    );
  });
});

describe('armarResultado', () => {
  it('calcula el total de páginas', () => {
    expect(armarResultado([[1, 2, 3], 25], 1, 10)).toMatchObject({
      total: 25,
      totalPages: 3,
    });
  });

  // Un listado vacío tiene 1 página, no 0: el front pagina sobre este número.
  it('un resultado vacío informa una página', () => {
    expect(armarResultado([[], 0], 1, 20).totalPages).toBe(1);
  });
});
