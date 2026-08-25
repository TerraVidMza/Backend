import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

/**
 * Conjunto completo de fincas asignadas a un usuario (HU-22).
 *
 * Es un reemplazo, no un alta incremental: la pantalla edita la lista entera, y
 * una lista vacía significa "recibe los avisos de todas las fincas".
 */
export class AsignarFincasDto {
  @IsArray()
  @ArrayMaxSize(200)
  // Sin fijar versión, igual que el resto de los DTO y que `ParseUUIDPipe`:
  // exigir v4 acá hacía que un id válido de otra versión se rechazara con un
  // 400 de formato en vez del 404 de pertenencia que corresponde.
  @IsUUID(undefined, { each: true })
  fincaIds: string[];
}
