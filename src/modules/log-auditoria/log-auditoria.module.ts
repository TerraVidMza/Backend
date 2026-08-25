import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogAuditoria } from './entities/log-auditoria.entity';
import { LogAuditoriaService } from './log-auditoria.service';
import { LogAuditoriaController } from './log-auditoria.controller';

/**
 * `@Global` a propósito.
 *
 * La auditoría es transversal: la necesitan trece módulos y sumará más. Con el
 * import explícito el patrón de falla es silencioso —el módulo que se olvida de
 * importarlo simplemente deja de auditar, y eso no rompe ningún test ni se ve
 * en la respuesta—. Mismo criterio que `AlcanceEmpresaModule`.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([LogAuditoria])],
  providers: [LogAuditoriaService],
  controllers: [LogAuditoriaController],
  exports: [LogAuditoriaService],
})
export class LogAuditoriaModule {}
