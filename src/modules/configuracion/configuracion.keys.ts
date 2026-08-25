/**
 * Claves válidas de la tabla `configuracion` (HU-33).
 *
 * La tabla es clave-valor, así que sin esta lista blanca cualquier Propietario
 * podría escribir claves arbitrarias y ensuciar la configuración del sistema.
 */
export const CLAVES_CONFIGURACION = [
  'nombre_organizacion',
  'moneda',
  'unidades',
  'zona_horaria',
  'support_email',
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_pass',
  'smtp_from',
] as const;

export type ClaveConfiguracion = (typeof CLAVES_CONFIGURACION)[number];

/**
 * Claves cuyo valor nunca se devuelve por la API. Se pueden escribir, pero al
 * leerlas se enmascaran: `GET /configuracion` es un endpoint de administración,
 * no un lugar del que extraer las credenciales del SMTP.
 */
export const CLAVES_SECRETAS: ReadonlySet<string> = new Set(['smtp_pass']);

export const VALOR_ENMASCARADO = '********';
