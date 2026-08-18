import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateCatalogoItemDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  nombre?: string;
}
