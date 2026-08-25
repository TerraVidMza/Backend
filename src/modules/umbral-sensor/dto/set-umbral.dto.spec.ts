import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SetUmbralDto } from './set-umbral.dto';

function validar(payload: Record<string, unknown>) {
  return validateSync(plainToInstance(SetUmbralDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('SetUmbralDto', () => {
  it('acepta ambos umbrales numéricos', () => {
    expect(validar({ umbralMinimo: 10, umbralMaximo: 40 })).toHaveLength(0);
  });

  it('acepta solo uno de los dos', () => {
    expect(validar({ umbralMaximo: 40 })).toHaveLength(0);
  });

  // El criterio "el usuario elimina un umbral" (HU-21) exige poder enviar null.
  // Con @IsOptional class-validator también saltea el null, así que el service
  // no podía distinguir "borralo" de "no lo toques".
  it('acepta null para borrar un umbral', () => {
    expect(validar({ umbralMinimo: null })).toHaveLength(0);
  });

  it('acepta null en ambos', () => {
    expect(validar({ umbralMinimo: null, umbralMaximo: null })).toHaveLength(0);
  });

  it('rechaza un valor no numérico', () => {
    expect(validar({ umbralMinimo: 'mucho' })).not.toHaveLength(0);
  });
});
