import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogAuditoria } from './entities/log-auditoria.entity';
import { LogAuditoriaService } from './log-auditoria.service';
import { LogAuditoriaController } from './log-auditoria.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LogAuditoria])],
  providers: [LogAuditoriaService],
  controllers: [LogAuditoriaController],
  exports: [LogAuditoriaService],
})
export class LogAuditoriaModule {}
