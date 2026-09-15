import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LogAuditoriaService } from './log-auditoria.service';
import { ListarLogAuditoriaDto } from './dto/listar-log-auditoria.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Auditoría')
@ApiBearerAuth('jwt')
@Controller('log-auditoria')
export class LogAuditoriaController {
  constructor(private readonly logAuditoriaService: LogAuditoriaService) {}

  @Get()
  @Roles(RolNombre.PROPIETARIO, RolNombre.AUDITOR)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListarLogAuditoriaDto,
  ) {
    return this.logAuditoriaService.findAll(user.empresaId, query);
  }
}
