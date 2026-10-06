import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class ActualizarEmpresaDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  nombre?: string;

  @IsOptional()
  @Matches(/^\d{2}-\d{8}-\d$/, {
    message: 'El CUIT debe tener el formato 30-12345678-9',
  })
  cuit?: string;
}
