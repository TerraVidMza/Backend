import { IsOptional, IsUUID } from 'class-validator';

export class AvanceQueryDto {
  /** Sin finca, el avance de toda la empresa. */
  @IsOptional()
  @IsUUID()
  fincaId?: string;
}
