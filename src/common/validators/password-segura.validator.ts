import {
  applyDecorators,
  // El decorador compuesto vive acá para que la política sea única.
} from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const PASSWORD_LARGO_MINIMO = 8;

/**
 * El máximo no es cosmético: bcrypt **trunca silenciosamente a 72 bytes**, así
 * que aceptar más largo da una falsa sensación de fortaleza y hace que dos
 * contraseñas distintas con el mismo prefijo sean equivalentes. Se corta antes,
 * con un mensaje claro.
 */
export const PASSWORD_LARGO_MAXIMO = 72;

/** Al menos una letra y al menos un número (HU-01, HU-03, HU-05). */
const AL_MENOS_UNA_LETRA = /[a-zA-Z]/;
const AL_MENOS_UN_NUMERO = /[0-9]/;

/**
 * Política de contraseñas del sistema.
 *
 * Estaba solo en el cliente: cualquiera que llamara a la API directamente
 * —incluida la app móvil— podía fijar `12345678`. Se centraliza en un decorador
 * para que las tres puertas de entrada (alta de usuario, reset por token y
 * cambio con contraseña actual) no puedan divergir.
 *
 * No se aplica al login: ahí validar la política rechazaría contraseñas
 * antiguas todavía válidas y, de paso, le revelaría la política a quien esté
 * probando credenciales.
 */
export function EsPasswordSegura(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MinLength(PASSWORD_LARGO_MINIMO, {
      message: `La contraseña debe tener al menos ${PASSWORD_LARGO_MINIMO} caracteres.`,
    }),
    MaxLength(PASSWORD_LARGO_MAXIMO, {
      message: `La contraseña no puede superar los ${PASSWORD_LARGO_MAXIMO} caracteres.`,
    }),
    Matches(AL_MENOS_UNA_LETRA, {
      message: 'La contraseña debe incluir al menos una letra.',
    }),
    Matches(AL_MENOS_UN_NUMERO, {
      message: 'La contraseña debe incluir al menos un número.',
    }),
  );
}
