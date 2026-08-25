import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Flag booleano opcional que llega por query string.
 *
 * Los query params son siempre strings y `Boolean('false')` es `true`, así que
 * sin conversión explícita `?activo=false` filtra por activos: justo lo
 * contrario de lo que pide quien llama.
 *
 * ## Por qué lee `obj[key]` y no `value`
 *
 * Ese detalle es el arreglo, no un rodeo. La app corre con
 * `transformOptions: { enableImplicitConversion: true }` (ver `main.ts`), y la
 * conversión implícita se aplica **antes** que este `@Transform`: mira el tipo
 * declarado —`boolean`— y hace `Boolean('false')`, que es `true`. Para cuando
 * el `@Transform` recibía `value`, ya era `true`, y comparar contra `'false'`
 * no encontraba nada que corregir.
 *
 * Verificado contra la API: con la versión anterior,
 * `GET /usuarios?activo=false` devolvía los usuarios **activos**, y
 * `?activo=basura` también, sin error. Lo mismo en
 * `/notificaciones?soloNoLeidas=` y `/cuarteles/buscar?activo=`.
 *
 * `obj` es el objeto plano de origen, así que `obj[key]` es la cadena tal como
 * la mandó el cliente, sin importar qué le hizo el pipeline. De ahí sí se puede
 * decidir, y lo que no sea `'true'` ni `'false'` se devuelve intacto para que
 * el `@IsBoolean` lo rechace con un 400 en vez de adivinar.
 */
export function EsBooleanoDeQuery(): PropertyDecorator {
  return applyDecorators(
    IsOptional(),
    Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
      const crudo = obj[key];
      // Ausente no es un valor inválido: `@IsOptional` lo deja pasar.
      if (crudo === undefined || crudo === null) return undefined;
      if (crudo === 'true' || crudo === true) return true;
      if (crudo === 'false' || crudo === false) return false;
      return crudo;
    }),
    IsBoolean({
      message: 'El valor debe ser "true" o "false".',
    }),
  );
}
