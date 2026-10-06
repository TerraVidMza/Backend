import { Type } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';

export class PropietarioInicialDto {
  @IsString()
  @Length(2, 100)
  nombre: string;

  /** Recibe el correo de bienvenida con el enlace para definir su contraseña. */
  @IsEmail()
  email: string;
}

/** Alta de una empresa cliente con su primer Propietario (D-025). */
export class CrearEmpresaDto {
  @IsString()
  @Length(2, 100)
  nombre: string;

  /** Formato argentino con guiones: 30-12345678-9. */
  @Matches(/^\d{2}-\d{8}-\d$/, {
    message: 'El CUIT debe tener el formato 30-12345678-9',
  })
  cuit: string;

  @ValidateNested()
  @Type(() => PropietarioInicialDto)
  propietario: PropietarioInicialDto;
}
