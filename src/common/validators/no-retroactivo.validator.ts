import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { hoyLocal } from '../fechas/rango-fechas';

/**
 * Valida que una fecha de vigencia no sea anterior a hoy.
 *
 * Los costos y tarifas son tablas append-only consultadas por
 * `valid_from <= fecha_del_registro`. Permitir una fecha retroactiva deja
 * reescribir el costo que ya se aplicó a labores y pesajes históricos, que es
 * justamente lo que el versionado busca impedir.
 */
export function EsFechaNoRetroactiva(options?: ValidationOptions) {
  return function (objeto: object, propiedad: string) {
    registerDecorator({
      name: 'esFechaNoRetroactiva',
      target: objeto.constructor,
      propertyName: propiedad,
      options,
      validator: {
        validate(valor: unknown) {
          if (typeof valor !== 'string') return false;
          const hoy = hoyLocal();
          return valor.slice(0, 10) >= hoy;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} no puede ser retroactiva: cambiaría el costo ya aplicado a registros históricos.`;
        },
      },
    });
  };
}
