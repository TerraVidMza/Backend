import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateCuartelDto } from './create-cuartel.dto';

export class UpdateCuartelDto extends PartialType(
  OmitType(CreateCuartelDto, ['fincaId'] as const),
) {}
