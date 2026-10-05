import { IsNumber, Max, Min } from 'class-validator';

export class FijarMetaDto {
  /** 0 borra la meta del cuartel. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999)
  metaKg: number;
}
