import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from '../../modules/notificaciones/entities/device-token.entity';
import { PushService } from './push.service';

/** `@Global` por el mismo motivo que `MailModule`: lo consume cualquier módulo. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([DeviceToken])],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
