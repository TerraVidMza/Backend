import {
  fechaLocal,
  finDelDia,
  hoyLocal,
  inicioDelDia,
  rangoDeFechas,
} from './rango-fechas';

describe('fechaLocal / hoyLocal', () => {
  /**
   * Regresión del bug que solo se manifiesta unas horas por día: a las 21:30 de
   * Mendoza, `toISOString()` ya informa el día siguiente. Un `valid_from`
   * calculado así quedaba vigente recién mañana, y las labores de esa misma
   * jornada se rechazaban por "sin costo vigente".
   */
  it('usa el día local, no el UTC, para un instante de la noche', () => {
    // 2026-08-24 21:30 hora local del entorno de test.
    const nocheLocal = new Date(2026, 7, 24, 21, 30, 0);
    expect(fechaLocal(nocheLocal)).toBe('2026-08-24');
  });

  it('coincide con el día local también de madrugada', () => {
    const madrugada = new Date(2026, 7, 24, 0, 30, 0);
    expect(fechaLocal(madrugada)).toBe('2026-08-24');
  });

  it('rellena mes y día con cero a la izquierda', () => {
    expect(fechaLocal(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('hoyLocal devuelve la fecha de hoy en formato ISO corto', () => {
    const ahora = new Date();
    expect(hoyLocal()).toBe(fechaLocal(ahora));
    expect(hoyLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // La ida y vuelta tiene que ser estable: la fecha que genera `fechaLocal`
  // debe caer dentro del rango que `inicioDelDia`/`finDelDia` arman para ella.
  it('la fecha generada cae dentro de su propio rango de día', () => {
    const ahora = new Date();
    const fecha = fechaLocal(ahora);
    expect(ahora >= inicioDelDia(fecha)).toBe(true);
    expect(ahora <= finDelDia(fecha)).toBe(true);
  });
});

describe('inicioDelDia / finDelDia', () => {
  /**
   * El bug que motivó esta utilidad: `new Date('2026-08-24')` es medianoche
   * UTC, que en una zona negativa cae el día anterior. Al usarlo como extremo
   * de un filtro, el rango quedaba corrido y "hoy" devolvía cero resultados.
   */
  it('interpreta una fecha sin hora en la zona local, no en UTC', () => {
    const inicio = inicioDelDia('2026-08-24');
    expect(inicio.getFullYear()).toBe(2026);
    expect(inicio.getMonth()).toBe(7); // agosto
    expect(inicio.getDate()).toBe(24);
    expect(inicio.getHours()).toBe(0);
    expect(inicio.getMinutes()).toBe(0);
  });

  it('el fin del día es inclusive hasta el último milisegundo', () => {
    const fin = finDelDia('2026-08-24');
    expect(fin.getDate()).toBe(24);
    expect(fin.getHours()).toBe(23);
    expect(fin.getMinutes()).toBe(59);
    expect(fin.getSeconds()).toBe(59);
    expect(fin.getMilliseconds()).toBe(999);
  });

  it('un mismo día cubre las 24 horas completas', () => {
    const inicio = inicioDelDia('2026-08-24');
    const fin = finDelDia('2026-08-24');
    const horas = (fin.getTime() - inicio.getTime()) / 3_600_000;
    // 23,999… salvo en los días de cambio de horario de verano.
    expect(horas).toBeGreaterThan(22.9);
    expect(horas).toBeLessThan(25);
  });

  it('un instante de la tarde cae dentro del rango de su propio día', () => {
    const tarde = new Date(2026, 7, 24, 19, 54, 0);
    expect(tarde >= inicioDelDia('2026-08-24')).toBe(true);
    expect(tarde <= finDelDia('2026-08-24')).toBe(true);
  });

  it('respeta un ISO completo en vez de recortarlo al día', () => {
    const exacto = inicioDelDia('2026-08-24T10:30:00.000Z');
    expect(exacto.toISOString()).toBe('2026-08-24T10:30:00.000Z');
  });
});

describe('rangoDeFechas', () => {
  it('sin extremos no genera filtro', () => {
    expect(rangoDeFechas()).toBeUndefined();
  });

  it('con un solo extremo genera un operador abierto', () => {
    expect(rangoDeFechas('2026-08-01')).toBeDefined();
    expect(rangoDeFechas(undefined, '2026-08-31')).toBeDefined();
  });

  it('con ambos extremos genera un Between', () => {
    const operador = rangoDeFechas('2026-08-01', '2026-08-31');
    expect(operador?.type).toBe('between');
  });
});
