import { AsyncLocalStorage } from 'node:async_hooks';

export interface ContextoRequest {
  ip: string | null;
  usuarioId: string | null;
  userAgent: string | null;
}

/**
 * Contexto de la request en curso.
 *
 * La alternativa era agregar `ip` a la firma de cada método de service que
 * audita: ~40 firmas atravesando controller → service → service, donde
 * olvidarse un parámetro no rompe nada y solo deja el campo en null. El
 * `AsyncLocalStorage` de Node lo resuelve sin dependencias y sin tocar firmas.
 */
export const almacenContexto = new AsyncLocalStorage<ContextoRequest>();

export function contextoActual(): ContextoRequest | undefined {
  return almacenContexto.getStore();
}

export function ipActual(): string | null {
  return almacenContexto.getStore()?.ip ?? null;
}
