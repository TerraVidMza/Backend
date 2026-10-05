import { CatalogoTipo } from './entities/catalogo-item.entity';

/**
 * Catálogos maestros con los que arranca toda empresa (D-011: son por
 * empresa). Los usa el seed para la empresa demo y el alta de empresas
 * (D-025), así una empresa nueva no empieza con los selectores vacíos.
 */
export const CATALOGOS_POR_DEFECTO: ReadonlyArray<{
  tipo: CatalogoTipo;
  nombre: string;
}> = [
  { tipo: CatalogoTipo.VARIEDAD, nombre: 'Malbec' },
  { tipo: CatalogoTipo.VARIEDAD, nombre: 'Cabernet Sauvignon' },
  { tipo: CatalogoTipo.VARIEDAD, nombre: 'Chardonnay' },
  { tipo: CatalogoTipo.SISTEMA_CONDUCCION, nombre: 'Espaldero Alto' },
  { tipo: CatalogoTipo.SISTEMA_CONDUCCION, nombre: 'Parral' },
  { tipo: CatalogoTipo.ESTADO_CUARTEL, nombre: 'Productivo' },
  { tipo: CatalogoTipo.ESTADO_CUARTEL, nombre: 'En implantación' },
  { tipo: CatalogoTipo.UNIDAD_MEDIDA, nombre: 'kg' },
  { tipo: CatalogoTipo.UNIDAD_MEDIDA, nombre: 'litros' },
  { tipo: CatalogoTipo.UNIDAD_MEDIDA, nombre: 'horas' },
];
