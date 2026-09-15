import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService, EstadoDeSalud } from './app.service';
import { Public } from './common/decorators/public.decorator';
import { AnyRole } from './common/decorators/any-role.decorator';

@ApiTags('Estado')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Estado de la API y de sus dependencias.
   *
   * Pública a propósito: la usan el despliegue y cualquier monitor externo, que
   * por definición no tienen token. No expone nada que no se pueda deducir
   * probando la API.
   */
  @Public()
  @Get('salud')
  @ApiOperation({ summary: 'Prueba de vida de la API y de la base' })
  @ApiResponse({
    status: 200,
    description: 'Todas las dependencias responden.',
  })
  @ApiResponse({
    status: 503,
    description:
      'La API está arriba pero alguna dependencia no responde. El cuerpo dice cuál.',
  })
  async salud(
    @Res({ passthrough: true }) res: Response,
  ): Promise<EstadoDeSalud> {
    const estado = await this.appService.salud();

    // El código HTTP tiene que reflejar el estado: un monitor mira el código,
    // no el cuerpo, y un 200 con `"estado": "degradado"` adentro no despierta a
    // nadie.
    res.status(
      estado.estado === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return estado;
  }

  /**
   * Raíz de la API.
   *
   * No es pública: sin token responde 401, y ese 401 es lo que históricamente
   * usó el despliegue como señal de vida. Se mantiene para no romper monitores
   * viejos, pero la verificación buena es `/api/salud`.
   */
  @AnyRole()
  @Get()
  @ApiOperation({ summary: 'Raíz de la API' })
  raiz(): { api: string; documentacion: string } {
    return {
      api: 'TerraVid',
      documentacion: '/api/docs',
    };
  }
}
