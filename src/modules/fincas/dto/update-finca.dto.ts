import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateFincaDto } from './create-finca.dto';

export class UpdateFincaDto extends PartialType(
  OmitType(CreateFincaDto, ['empresaId'] as const),
) {}
