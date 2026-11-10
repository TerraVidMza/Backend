import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateFincaDto } from './create-finca.dto';
import { UpdateFincaDto } from './update-finca.dto';

/**
 * Réplica del ValidationPipe global (`main.ts`): con `whitelist` +
 * `forbidNonWhitelisted`, una propiedad que no existe en el DTO es un error.
 */
function validar<T extends object>(
  clase: new () => T,
  payload: Record<string, unknown>,
) {
  return validateSync(plainToInstance(clase, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

const poligono = {
  type: 'Polygon',
  coordinates: [
    [
      [-68.9, -33.0],
      [-68.89, -33.0],
      [-68.89, -33.01],
      [-68.9, -33.01],
      [-68.9, -33.0],
    ],
  ],
};

describe('CreateFincaDto — polígono (HU-08)', () => {
  it('sin polígono, las hectáreas siguen siendo obligatorias', () => {
    const errores = validar(CreateFincaDto, { nombre: 'La Esperanza' });
    expect(errores.map((e) => e.property)).toContain('hectareas');
  });

  it('con polígono, las hectáreas ya no hacen falta: se calculan', () => {
    expect(
      validar(CreateFincaDto, { nombre: 'La Esperanza', poligono }),
    ).toEqual([]);
  });

  it('una finca de siempre (hectáreas, sin polígono) sigue siendo válida', () => {
    expect(
      validar(CreateFincaDto, {
        nombre: 'La Esperanza',
        hectareas: 25.5,
        latitud: -33,
        longitud: -68.9,
      }),
    ).toEqual([]);
  });

  it('rechaza un polígono mal formado y dice por qué', () => {
    const abierto = {
      type: 'Polygon',
      coordinates: [poligono.coordinates[0].slice(0, 4)],
    };
    const errores = validar(CreateFincaDto, {
      nombre: 'La Esperanza',
      hectareas: 10,
      poligono: abierto,
    });
    const mensaje = JSON.stringify(errores.map((e) => e.constraints));
    expect(mensaje).toMatch(/polígono GeoJSON válido/);
  });

  it('rechaza un polígono con otra forma de geometría', () => {
    const errores = validar(CreateFincaDto, {
      nombre: 'La Esperanza',
      hectareas: 10,
      poligono: { type: 'Point', coordinates: [-68.9, -33] },
    });
    expect(errores.map((e) => e.property)).toContain('poligono');
  });
});

describe('UpdateFincaDto — polígono (HU-08)', () => {
  it('acepta poligono: null para quitarlo', () => {
    expect(validar(UpdateFincaDto, { poligono: null })).toEqual([]);
  });

  it('acepta editar solo el polígono', () => {
    expect(validar(UpdateFincaDto, { poligono })).toEqual([]);
  });

  it('acepta un cuerpo vacío', () => {
    expect(validar(UpdateFincaDto, {})).toEqual([]);
  });
});
