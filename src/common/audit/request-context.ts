import { AsyncLocalStorage } from 'node:async_hooks';

export interface ContextoRequest {
  ip: string | null;
  usuarioId: string | null;
  userAgent: string | null;
  /**
   * Identificador de la request, para poder seguir una operación entera en el
   * log.
   *
   * Sin esto, en la VM conviven las líneas de todos los requests en curso y no
   * hay forma de saber cuáles pertenecen a la misma operación: un error dice
   * qué pasó pero no qué lo precedió. Es el dato que falta cuando hay que
   * reconstruir un incidente y lo único que queda es `journalctl`.
   */
  requestId: string;
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

/** Id de la request en curso, o `null` fuera de una (cron, arranque, tests). */
export function requestIdActual(): string | null {
  return almacenContexto.getStore()?.requestId ?? null;
}
