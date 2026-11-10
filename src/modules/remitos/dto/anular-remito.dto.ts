import { IsString, Length } from 'class-validator';

export class AnularRemitoDto {
  // Mínimo 10 caracteres: anular un remito aprobado toca dinero, y el motivo es
  // lo único que queda para entender después por qué se hizo.
  @IsString()
  @Length(10, 500)
  motivoAnulacion: string;
}
