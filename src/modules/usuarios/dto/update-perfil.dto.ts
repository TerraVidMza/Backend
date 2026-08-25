import { IsString, Length } from 'class-validator';

/**
 * Datos que un usuario puede modificar de su propio perfil (HU-04).
 *
 * Deliberadamente NO extiende de CreateUsuarioDto: el perfil propio solo
 * permite cambiar el nombre. Exponer `rolId`, `activo` o `empresaId` acá
 * habilitaría que cualquier usuario se auto-asigne un rol superior o se
 * cambie de empresa.
 */
export class UpdatePerfilDto {
  @IsString()
  @Length(2, 100)
  nombre: string;
}
