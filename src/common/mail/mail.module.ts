import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { ConfiguracionModule } from '../../modules/configuracion/configuracion.module';

/**
 * `@Global` por el mismo motivo que la auditoría: lo necesitan auth, usuarios,
 * alertas, remitos y soporte, y un módulo que se olvide de importarlo
 * simplemente deja de mandar correo sin que nada falle.
 */
@Global()
@Module({
  imports: [ConfiguracionModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
