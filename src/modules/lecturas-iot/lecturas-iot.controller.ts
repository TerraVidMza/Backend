import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { LecturasIotService } from './lecturas-iot.service';
import { IngestLecturaDto } from './dto/ingest-lectura.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('lecturas-iot')
export class LecturasIotController {
  constructor(private readonly lecturasIotService: LecturasIotService) {}

  @Get('sensor/:sensorId')
  findBySensor(@Param('sensorId', ParseUUIDPipe) sensorId: string, @Query('limit') limit?: string) {
    return this.lecturasIotService.findBySensor(sensorId, limit ? parseInt(limit, 10) : undefined);
  }

  @Post()
  ingest(@Body() dto: IngestLecturaDto) {
    return this.lecturasIotService.ingest(dto);
  }
}
