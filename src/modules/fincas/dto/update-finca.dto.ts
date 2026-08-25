import { PartialType } from '@nestjs/mapped-types';
import { CreateFincaDto } from './create-finca.dto';

// No hace falta omitir `empresaId`: `CreateFincaDto` ya no lo expone, la
// empresa sale del token del usuario autenticado.
export class UpdateFincaDto extends PartialType(CreateFincaDto) {}
