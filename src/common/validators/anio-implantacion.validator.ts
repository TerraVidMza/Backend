import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/** Antes de 1900 no hay viñedos en producción en Mendoza; es el piso razonable. */
export const ANIO_IMPLANTACION_MINIMO = 1900;

/**
 * Valida que el año esté entre 1900 y el año en curso (HU-09).
 *
 * Es un decorador propio y no `@Max(new Date().getFullYear())` porque ese
 * argumento se evalúa **una vez, al cargar el módulo**: un proceso que siga
 * vivo el 1 de enero seguiría rechazando el año nuevo. Acá el tope se calcula
 * en cada validación.
 */
export function EsAnioImplantacionValido(opciones?: ValidationOptions) {
  return function (objeto: object, propiedad: string): void {
    registerDecorator({
      name: 'esAnioImplantacionValido',
      target: objeto.constructor,
      propertyName: propiedad,
      options: opciones,
      validator: {
        validate(valor: unknown): boolean {
          if (!Number.isInteger(valor)) return false;
          const anio = valor as number;
          return (
            anio >= ANIO_IMPLANTACION_MINIMO && anio <= new Date().getFullYear()
          );
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} debe ser un año entre ${ANIO_IMPLANTACION_MINIMO} y ${new Date().getFullYear()}.`;
        },
      },
    });
  };
}
