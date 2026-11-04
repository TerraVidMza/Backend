import { motivoPoligonoInvalido } from './es-poligono-geojson.validator';
import { MAXIMO_ANILLOS, MAXIMO_VERTICES } from './poligono';

const anillo = [
  [-68.9, -33.0],
  [-68.89, -33.0],
  [-68.89, -33.01],
  [-68.9, -33.01],
  [-68.9, -33.0],
];
const poligono = (coordinates: unknown) => ({ type: 'Polygon', coordinates });

describe('motivoPoligonoInvalido', () => {
  it('acepta un polígono GeoJSON bien formado', () => {
    expect(motivoPoligonoInvalido(poligono([anillo]))).toBeNull();
  });

  it('acepta un polígono con un hueco (contorno + anillo interior)', () => {
    const hueco = [
      [-68.897, -33.003],
      [-68.895, -33.003],
      [-68.895, -33.005],
      [-68.897, -33.005],
      [-68.897, -33.003],
    ];
    expect(motivoPoligonoInvalido(poligono([anillo, hueco]))).toBeNull();
  });

  it.each([
    ['null', null],
    ['un texto', 'POLYGON((0 0,1 0,1 1,0 0))'],
    ['un array', []],
    ['un número', 5],
  ])('rechaza %s', (_nombre, valor) => {
    expect(motivoPoligonoInvalido(valor)).toMatch(/objeto GeoJSON/);
  });

  it('rechaza otros tipos de geometría', () => {
    expect(
      motivoPoligonoInvalido({ type: 'Point', coordinates: [-68.9, -33] }),
    ).toMatch(/Polygon/);
    expect(
      motivoPoligonoInvalido({ type: 'MultiPolygon', coordinates: [[anillo]] }),
    ).toMatch(/Polygon/);
  });

  it('rechaza coordinates ausente o vacío', () => {
    expect(motivoPoligonoInvalido({ type: 'Polygon' })).toMatch(/anillos/);
    expect(motivoPoligonoInvalido(poligono([]))).toMatch(/anillos/);
  });

  it('rechaza un anillo con menos de 4 vértices', () => {
    expect(motivoPoligonoInvalido(poligono([[...anillo.slice(0, 3)]]))).toMatch(
      /al menos 4 vértices/,
    );
  });

  it('rechaza un anillo abierto (el último vértice no repite el primero)', () => {
    const abierto = [...anillo.slice(0, 4), [-68.8, -33.2]];
    expect(motivoPoligonoInvalido(poligono([abierto]))).toMatch(
      /no está cerrado/,
    );
  });

  it('rechaza vértices que no son [longitud, latitud]', () => {
    const conAltura = anillo.map((v) => [...v, 800]);
    expect(motivoPoligonoInvalido(poligono([conAltura]))).toMatch(
      /\[longitud, latitud\]/,
    );
  });

  it('rechaza vértices que no son números', () => {
    const mal = [...anillo.slice(0, 3), ['-68.9', '-33.0'], anillo[0]];
    expect(motivoPoligonoInvalido(poligono([mal]))).toMatch(/números/);
  });

  it('rechaza coordenadas fuera de rango', () => {
    const lngFuera = anillo.map(([, lat]) => [200, lat]);
    expect(motivoPoligonoInvalido(poligono([lngFuera]))).toMatch(/longitud/);
    const latFuera = anillo.map(([lng]) => [lng, 95]);
    expect(motivoPoligonoInvalido(poligono([latFuera]))).toMatch(/latitud/);
  });

  it('rechaza NaN e Infinity, que JSON no puede transportar pero un objeto sí', () => {
    const conNaN = [...anillo.slice(0, 3), [Number.NaN, -33.0], anillo[0]];
    expect(motivoPoligonoInvalido(poligono([conNaN]))).toMatch(/números/);
  });

  it(`rechaza más de ${MAXIMO_ANILLOS} anillos`, () => {
    const demasiados = Array.from({ length: MAXIMO_ANILLOS + 1 }, () => anillo);
    expect(motivoPoligonoInvalido(poligono(demasiados))).toMatch(/anillos/);
  });

  it(`rechaza más de ${MAXIMO_VERTICES} vértices en total`, () => {
    const grande = Array.from({ length: MAXIMO_VERTICES + 1 }, (_, i) => [
      -68.9 + i * 1e-7,
      -33.0,
    ]);
    grande[grande.length - 1] = grande[0];
    expect(motivoPoligonoInvalido(poligono([grande]))).toMatch(
      /demasiados vértices/,
    );
  });
});
