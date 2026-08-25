import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class GenerarRemitoDto {
  @IsUUID()
  cuartelId: string;

  /**
   * Jornada a liquidar (HU-26).
   *
   * Sin fecha el borrador arrastraba **todos** los pesajes pendientes del
   * cuartel, sin importar de cuándo fueran: un remito de vendimia documenta el
   * despacho de un día, no el acumulado histórico. Se mantiene opcional para no
   * romper a los clientes actuales; omitirla conserva el comportamiento previo.
   */
  @IsOptional()
  @IsDateString()
  fecha?: string;
}
