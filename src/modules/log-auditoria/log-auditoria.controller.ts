import { Controller, Get, UseGuards } from '@nestjs/common';
import { LogAuditoriaService } from './log-auditoria.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolNombre } from '../../common/enums/rol.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('log-auditoria')
export class LogAuditoriaController {
  constructor(private readonly logAuditoriaService: LogAuditoriaService) {}

  @Get()
  @Roles(RolNombre.PROPIETARIO, RolNombre.AUDITOR)
  findAll() {
    return this.logAuditoriaService.findAll();
  }
}
