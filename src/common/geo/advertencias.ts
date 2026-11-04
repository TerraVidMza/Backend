/**
 * Respuesta de un alta o edición que pudo guardarse pero tiene algo para
 * revisar. `advertencias` solo está cuando hay alguna: un cliente que no la
 * conoce sigue recibiendo exactamente la misma forma de antes.
 */
export type ConAdvertencias<T> = T & { advertencias?: string[] };

export function conAdvertencias<T extends object>(
  entidad: T,
  advertencias: Array<string | null | undefined>,
): ConAdvertencias<T> {
  const reales = advertencias.filter((a): a is string => Boolean(a));
  return reales.length > 0
    ? Object.assign(entidad, { advertencias: reales })
    : entidad;
}
