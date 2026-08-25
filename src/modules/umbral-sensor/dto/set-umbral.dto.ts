import { IsNumber, ValidateIf } from 'class-validator';

export class SetUmbralDto {
  /**
   * `null` borra el umbral; omitir el campo lo deja como estaba.
   *
   * Se usa `@ValidateIf` en lugar de `@IsOptional` porque este último también
   * salta la validación cuando el valor es `null`, y necesitamos distinguir
   * "no lo mandes" de "borralo".
   */
  @ValidateIf((_, valor) => valor !== null && valor !== undefined)
  @IsNumber()
  umbralMinimo?: number | null;

  @ValidateIf((_, valor) => valor !== null && valor !== undefined)
  @IsNumber()
  umbralMaximo?: number | null;
}
