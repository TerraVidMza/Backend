import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

/**
 * Entero opcional que llega por query string.
 *
 * Trata el parámetro vacío (`?anio=`) como ausente, que es lo que significa: un
 * formulario de búsqueda manda la clave con valor vacío cuando el usuario no
 * completó el campo, y filtrar por eso no es lo que pidió nadie.
 *
 * ## El mismo problema de orden que `EsBooleanoDeQuery`
 *
 * Lee `obj[key]` y no `value` por la misma razón: con
 * `enableImplicitConversion: true`, la conversión implícita corre **antes** del
 * `@Transform` y hace `Number('')`, que es `0`. El `@Transform` recibía `0`, la
 * comparación contra `''` no encontraba nada, y `@IsInt()` aceptaba el `0`
 * porque es un entero válido.
 *
 * Verificado: `GET /cuarteles/buscar?anioImplantacion=` filtraba por el año
 * **0** y devolvía la lista vacía, sin ningún error. El caso importa porque el
 * vacío no es un borde raro: es lo que manda el buscador de HU-11 cada vez que
 * ese campo se deja sin completar.
 */
export function EsEnteroDeQuery(): PropertyDecorator {
  return applyDecorators(
    IsOptional(),
    Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
      const crudo = obj[key];
      if (crudo === undefined || crudo === null || crudo === '') {
        return undefined;
      }
      // `Number` y no `parseInt`: parseInt('2020abc') da 2020 y se comería la
      // basura en silencio, que es justo lo que este validador evita.
      return Number(crudo);
    }),
    IsInt(),
  );
}
