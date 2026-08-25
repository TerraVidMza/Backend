import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { IsDateString } from 'class-validator';
import { EsFechaNoRetroactiva } from './no-retroactivo.validator';
import { fechaLocal } from '../fechas/rango-fechas';

class Ejemplo {
  @IsDateString()
  @EsFechaNoRetroactiva()
  validFrom: string;
}

function validar(validFrom: string) {
  return validateSync(plainToInstance(Ejemplo, { validFrom }));
}

/**
 * Fecha local, igual que el validador. Con `toISOString()` este helper heredaba
 * el mismo corrimiento de un día que se corrigió en el código: "ayer" a las
 * 21:30 de Mendoza devolvía la fecha de hoy y el test pasaba por casualidad.
 */
function fechaRelativa(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return fechaLocal(d);
}

describe('EsFechaNoRetroactiva', () => {
  it('acepta hoy', () => {
    expect(validar(fechaRelativa(0))).toHaveLength(0);
  });

  it('acepta una fecha futura', () => {
    expect(validar(fechaRelativa(30))).toHaveLength(0);
  });

  // Backdating: reescribiría el costo vigente que ya se aplicó a labores y
  // pesajes históricos, que es lo que el versionado append-only evita.
  it('rechaza ayer', () => {
    expect(validar(fechaRelativa(-1))).not.toHaveLength(0);
  });

  it('rechaza una fecha muy anterior', () => {
    expect(validar('2020-01-01')).not.toHaveLength(0);
  });
});
