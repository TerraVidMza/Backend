import { Module } from '@nestjs/common';
import { MqttConexionService } from './mqtt-conexion.service';
import { DynsecService } from './dynsec.service';

/**
 * Conexión al broker y credenciales por sensor (D-026). Separado de la
 * ingesta para que `SensoresModule` lo pueda usar sin formar un ciclo con
 * `LecturasIotModule`, que a su vez importa sensores.
 */
@Module({
  providers: [MqttConexionService, DynsecService],
  exports: [MqttConexionService, DynsecService],
})
export class MqttModule {}
