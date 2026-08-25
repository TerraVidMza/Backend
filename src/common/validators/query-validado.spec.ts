import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ListarCatalogoDto } from '../../modules/catalogo-item/dto/listar-catalogo.dto';
import { CorrelacionDto } from '../../modules/inteligencia-agronomica/dto/correlacion.dto';
import { ListarArticulosDto } from '../../modules/ayuda/dto/listar-articulos.dto';
import { ListarConInactivosDto } from '../dto/listar-con-inactivos.dto';
import { CatalogoTipo } from '../../modules/catalogo-item/entities/catalogo-item.entity';

/**
 * Los parámetros de query que llegaban sin validar.
 *
 * Dos de ellos devolvían **500** a una entrada inválida del cliente, y se
 * encontraron probando la API de verdad, no leyendo el código:
 *
 *   GET /api/catalogos                          -> 500
 *     TypeORMError: Undefined value encountered in property 'CatalogoItem.tipo'
 *   GET /api/…/correlacion/:id?desde=basura      -> 500
 *     QueryFailedError: invalid input syntax for type date: "basura"
 *
 * Y los demás tenían el modo de falla contrario, que es peor: devolvían **200
 * con una lista vacía**, así que un parámetro mal escrito era indistinguible de
 * "no hay datos". Los tests cubren los dos sentidos: que lo inválido se
 * rechace, y que lo válido siga pasando.
 */

/**
 * Valida con la **misma configuración que `main.ts`**, incluida
 * `enableImplicitConversion: true`. No es un detalle: esa opción es la que
 * derrotaba al `@Transform` de los booleanos, así que un test que la omita
 * pasa mientras la aplicación real falla.
 */
async function errores(cls: new () => object, query: Record<string, unknown>) {
  const dto = plainToInstance(cls, query, {
    enableImplicitConversion: true,
  });
  const fallos = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return fallos.flatMap((f) => Object.keys(f.constraints ?? {}));
}

describe('ListarCatalogoDto', () => {
  // La regresión del 500: `tipo` ausente llegaba al where de TypeORM.
  it('rechaza la falta de tipo', async () => {
    expect(await errores(ListarCatalogoDto, {})).toContain('isEnum');
  });

  // El otro modo de falla: 200 con [] es indistinguible de "no hay variedades".
  it('rechaza un tipo que no existe', async () => {
    expect(await errores(ListarCatalogoDto, { tipo: 'basura' })).toContain(
      'isEnum',
    );
  });

  it.each(Object.values(CatalogoTipo))('acepta el tipo %s', async (tipo) => {
    expect(await errores(ListarCatalogoDto, { tipo })).toEqual([]);
  });

  it('acepta incluirInactivos como string de query', async () => {
    expect(
      await errores(ListarCatalogoDto, {
        tipo: CatalogoTipo.VARIEDAD,
        incluirInactivos: 'true',
      }),
    ).toEqual([]);
  });

  it('rechaza un incluirInactivos que no es booleano', async () => {
    expect(
      await errores(ListarCatalogoDto, {
        tipo: CatalogoTipo.VARIEDAD,
        incluirInactivos: 'basura',
      }),
    ).toContain('isBoolean');
  });
});

describe('CorrelacionDto', () => {
  const validos = {
    sensorId: '11111111-1111-4111-8111-111111111111',
    desde: '2026-03-01',
    hasta: '2026-03-31',
  };

  it('acepta el caso válido', async () => {
    expect(await errores(CorrelacionDto, validos)).toEqual([]);
  });

  // La regresión del 500: la cadena viajaba hasta el SQL.
  it('rechaza una fecha que no es fecha', async () => {
    expect(
      await errores(CorrelacionDto, { ...validos, desde: 'basura' }),
    ).toContain('isDateString');
  });

  /**
   * Sin fechas la respuesta era 200 diciendo "No hay suficientes datos": parece
   * un veredicto agronómico sobre el cuartel cuando en realidad nadie mandó el
   * período. Es el caso que más confunde de los cuatro.
   */
  it('rechaza la falta de fechas', async () => {
    const fallos = await errores(CorrelacionDto, {
      sensorId: validos.sensorId,
    });
    expect(fallos.filter((c) => c === 'isDateString')).toHaveLength(2);
  });

  it('rechaza un sensorId que no es UUID', async () => {
    expect(
      await errores(CorrelacionDto, { ...validos, sensorId: '123' }),
    ).toContain('isUuid');
  });
});

describe('ListarArticulosDto', () => {
  // Los dos filtros del centro de ayuda son opcionales.
  it('acepta la consulta sin filtros', async () => {
    expect(await errores(ListarArticulosDto, {})).toEqual([]);
  });

  it('rechaza un módulo mal escrito', async () => {
    expect(await errores(ListarArticulosDto, { modulo: 'vendmia' })).toContain(
      'isEnum',
    );
  });

  it('acepta un módulo válido', async () => {
    expect(await errores(ListarArticulosDto, { modulo: 'vendimia' })).toEqual(
      [],
    );
  });
});

describe('ListarConInactivosDto', () => {
  it('acepta la ausencia del flag', async () => {
    expect(await errores(ListarConInactivosDto, {})).toEqual([]);
  });

  /**
   * La regresión de fondo, verificada contra la API antes de arreglarla:
   * `GET /usuarios?activo=false` devolvía los usuarios **activos**.
   *
   * `Boolean('false')` es `true`, y la conversión implícita de `main.ts` corre
   * antes del `@Transform`, así que el valor ya llegaba convertido y no había
   * nada que corregir. El `enableImplicitConversion: true` del helper es lo que
   * hace que este test valga: sin él pasaba igual con el código roto.
   */
  it.each([
    ['false', false],
    ['true', true],
    [false, false],
    [true, true],
  ])('convierte %p en %p', (entrada, esperado) => {
    const dto = plainToInstance(
      ListarConInactivosDto,
      { incluirInactivos: entrada },
      { enableImplicitConversion: true },
    );
    expect(dto.incluirInactivos).toBe(esperado);
  });

  // Sin esto, `?incluirInactivos=basura` se interpretaba como `true` en silencio.
  it.each(['1', '0', '', 'basura', 'si'])(
    'rechaza %p en vez de adivinar',
    async (entrada) => {
      expect(
        await errores(ListarConInactivosDto, { incluirInactivos: entrada }),
      ).toContain('isBoolean');
    },
  );
});
