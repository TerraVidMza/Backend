import { IsDateString, IsString, Length } from 'class-validator';

export class CreateCampaniaDto {
  @IsString()
  @Length(2, 50)
  nombre: string;

  /**
   * Sin `EsFechaNoRetroactiva`: a diferencia de un costo, una campaña se carga
   * con frecuencia después de haber empezado —o incluso terminado— para poder
   * comparar contra el histórico ya registrado.
   */
  @IsDateString()
  fechaDesde: string;

  /** Inclusivo. El service valida que sea posterior a `fechaDesde`. */
  @IsDateString()
  fechaHasta: string;
}
