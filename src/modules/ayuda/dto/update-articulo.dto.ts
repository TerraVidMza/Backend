import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateArticuloDto } from './create-articulo.dto';

export class UpdateArticuloDto extends PartialType(OmitType(CreateArticuloDto, ['tipo', 'modulo'] as const)) {}
