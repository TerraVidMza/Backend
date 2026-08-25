import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdatePerfilDto } from './update-perfil.dto';

/**
 * Réplica del ValidationPipe global (`main.ts`): con `whitelist` +
 * `forbidNonWhitelisted`, una propiedad que no existe en el DTO produce error.
 */
function validar(payload: Record<string, unknown>) {
  const dto = plainToInstance(UpdatePerfilDto, payload);
  return validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('UpdatePerfilDto', () => {
  it('acepta un cambio de nombre válido', () => {
    expect(validar({ nombre: 'Sergio Farías' })).toHaveLength(0);
  });

  // Este es el caso de la escalada de privilegios: el DTO anterior derivaba de
  // CreateUsuarioDto e incluía rolId, así que cualquier usuario podía
  // asignarse el rol Propietario desde su propio perfil.
  it('rechaza rolId', () => {
    const errores = validar({
      nombre: 'Sergio Farías',
      rolId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    });
    expect(errores).not.toHaveLength(0);
    expect(errores.some((e) => e.property === 'rolId')).toBe(true);
  });

  it('rechaza empresaId', () => {
    const errores = validar({
      nombre: 'Sergio Farías',
      empresaId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    });
    expect(errores.some((e) => e.property === 'empresaId')).toBe(true);
  });

  it('rechaza activo', () => {
    const errores = validar({ nombre: 'Sergio Farías', activo: true });
    expect(errores.some((e) => e.property === 'activo')).toBe(true);
  });

  it('rechaza email (solo el Propietario puede cambiarlo)', () => {
    const errores = validar({
      nombre: 'Sergio Farías',
      email: 'otro@terravid.demo',
    });
    expect(errores.some((e) => e.property === 'email')).toBe(true);
  });

  it('rechaza un nombre de menos de 2 caracteres', () => {
    expect(validar({ nombre: 'A' })).not.toHaveLength(0);
  });

  it('rechaza un nombre de más de 100 caracteres', () => {
    expect(validar({ nombre: 'a'.repeat(101) })).not.toHaveLength(0);
  });
});
