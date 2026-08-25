import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AlcanceEmpresaService } from './alcance-empresa.service';

const EMPRESA_PROPIA = 'empresa-a';
const EMPRESA_AJENA = 'empresa-b';

/**
 * Repositorio simulado: `exists` devuelve true solo si el `where` pide la
 * empresa propia. Es lo mismo que haría Postgres con el filtro aplicado.
 */
function repoQueSoloConoce(empresaId: string) {
  const empresaPedida = (where: Record<string, unknown>) =>
    (where.empresaId as string | undefined) ??
    (where.finca as { empresaId?: string } | undefined)?.empresaId ??
    null;

  return {
    exists: jest.fn((opts: { where: Record<string, unknown> }) =>
      Promise.resolve(empresaPedida(opts.where) === empresaId),
    ),
    // `verificarInsumos` compara contra la cantidad de ids pedidos: se devuelve
    // el total solo cuando la empresa coincide, y 0 cuando no.
    count: jest.fn((opts: { where: Record<string, unknown> }) => {
      if (empresaPedida(opts.where) !== empresaId) return Promise.resolve(0);
      const ids = opts.where.id as { value?: string[] } | undefined;
      return Promise.resolve(ids?.value?.length ?? 0);
    }),
  } as unknown as Repository<never>;
}

describe('AlcanceEmpresaService', () => {
  let service: AlcanceEmpresaService;

  beforeEach(() => {
    service = new AlcanceEmpresaService(
      repoQueSoloConoce(EMPRESA_PROPIA), // finca
      repoQueSoloConoce(EMPRESA_PROPIA), // cuartel
      repoQueSoloConoce(EMPRESA_PROPIA), // sensor
      repoQueSoloConoce(EMPRESA_PROPIA), // cuadrilla
      repoQueSoloConoce(EMPRESA_PROPIA), // tipo de labor
      repoQueSoloConoce(EMPRESA_PROPIA), // insumo
    );
  });

  describe('recursos de la propia empresa', () => {
    it('acepta una finca propia', async () => {
      await expect(
        service.verificarFinca('finca-1', EMPRESA_PROPIA),
      ).resolves.toBeUndefined();
    });

    it('acepta un cuartel propio', async () => {
      await expect(
        service.verificarCuartel('cuartel-1', EMPRESA_PROPIA),
      ).resolves.toBeUndefined();
    });

    it('acepta un sensor propio', async () => {
      await expect(
        service.verificarSensor('sensor-1', EMPRESA_PROPIA),
      ).resolves.toBeUndefined();
    });

    it('acepta una cuadrilla propia', async () => {
      await expect(
        service.verificarCuadrilla('cuadrilla-1', EMPRESA_PROPIA),
      ).resolves.toBeUndefined();
    });
  });

  // Estos son los casos que antes pasaban: conociendo el UUID se leía —y en el
  // caso de los remitos, se aprobaba— un recurso de otra empresa.
  describe('recursos de otra empresa', () => {
    it('rechaza una finca ajena con 404, no 403', async () => {
      await expect(
        service.verificarFinca('finca-1', EMPRESA_AJENA),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza un cuartel ajeno', async () => {
      await expect(
        service.verificarCuartel('cuartel-1', EMPRESA_AJENA),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza un sensor ajeno', async () => {
      await expect(
        service.verificarSensor('sensor-1', EMPRESA_AJENA),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza una cuadrilla ajena', async () => {
      await expect(
        service.verificarCuadrilla('cuadrilla-1', EMPRESA_AJENA),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('catálogos por empresa (D-h)', () => {
    it('acepta un tipo de labor propio', async () => {
      await expect(
        service.verificarTipoLabor('tipo-1', EMPRESA_PROPIA),
      ).resolves.toBeUndefined();
    });

    it('rechaza el tipo de labor de otra empresa', async () => {
      await expect(
        service.verificarTipoLabor('tipo-1', EMPRESA_AJENA),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('acepta insumos propios', async () => {
      await expect(
        service.verificarInsumos(['ins-1', 'ins-2'], EMPRESA_PROPIA),
      ).resolves.toBeUndefined();
    });

    it('rechaza insumos de otra empresa', async () => {
      await expect(
        service.verificarInsumos(['ins-1'], EMPRESA_AJENA),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    // Un lote sin insumos no debe pegarle a la base.
    it('una lista vacía no consulta nada', async () => {
      await expect(
        service.verificarInsumos([], EMPRESA_AJENA),
      ).resolves.toBeUndefined();
    });
  });
});
