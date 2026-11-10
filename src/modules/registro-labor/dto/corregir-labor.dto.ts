import { IsNumber, IsString, Length, Min } from 'class-validator';

/**
 * Corrección de una labor ya sincronizada. Se corrige la cantidad, que es el
 * error de carga habitual. Cambiar el tipo de labor, el cuartel o los insumos
 * cambiaría el costo unitario congelado al sincronizar: eso es otra labor, y se
 * resuelve anulando esta y cargando una nueva.
 */
export class CorregirLaborDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  cantidad: number;
}

export class AnularLaborDto {
  // Mínimo 10 caracteres: anular una labor la saca del costeo, y el motivo es
  // lo único que queda para entender después por qué.
  @IsString()
  @Length(10, 500)
  motivoAnulacion: string;
}
