import { IsDateString, IsUUID } from 'class-validator';

/**
 * Parámetros de `GET /inteligencia-agronomica/correlacion/:cuartelId` (HU-29).
 *
 * Los tres se leían crudos del query string, con los mismos dos modos de falla
 * que tenía `/catalogos`:
 *
 * - `?desde=basura` devolvía **500**: la cadena viajaba hasta el SQL y
 *   PostgreSQL contestaba `invalid input syntax for type date`, que el filtro
 *   global no traducía.
 * - Omitir las fechas devolvía **200** diciendo *"No hay suficientes datos"*.
 *   Es la respuesta más engañosa de las dos: parece un veredicto agronómico
 *   sobre el cuartel cuando en realidad nadie mandó el período a analizar.
 *
 * `@IsDateString` acepta el formato ISO, que es el que ya usa el resto de la
 * API (`CompararCampaniasDto`, los filtros de fecha de los listados).
 */
export class CorrelacionDto {
  @IsUUID()
  sensorId: string;

  @IsDateString(
    {},
    { message: 'desde debe ser una fecha ISO (por ejemplo 2026-03-01).' },
  )
  desde: string;

  @IsDateString(
    {},
    { message: 'hasta debe ser una fecha ISO (por ejemplo 2026-03-31).' },
  )
  hasta: string;
}
