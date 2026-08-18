import { IsUUID } from 'class-validator';

export class GenerarRemitoDto {
  @IsUUID()
  cuartelId: string;
}
