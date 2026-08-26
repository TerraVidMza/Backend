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

/**
 * Claves que puede leer cualquier rol autenticado (D-020).
 *
 * `moneda`, `unidades` y `zona_horaria` no son configuración de administración:
 * son las que deciden cómo la interfaz formatea importes, cantidades y fechas
 * en **todas** las pantallas, y `nombre_organizacion` es el rótulo de la
 * empresa. Sin ellas, un Capataz o un Auditor ven los números con el formato
 * por defecto del navegador en lugar del que configuró su empresa.
 *
 * Es una lista blanca y no una lista negra a propósito: `GET /configuracion`
 * solo enmascara `smtp_pass`, así que el host, el puerto, el usuario y el
 * remitente del SMTP viajan en claro. Abrir ese endpoint a todos los roles
 * repartiría media credencial de correo; enumerar lo que sí puede salir hace
 * que agregar una clave nueva sea privado por omisión.
 */
export const CLAVES_PREFERENCIAS = [
  'nombre_organizacion',
  'moneda',
  'unidades',
  'zona_horaria',
] as const satisfies readonly ClaveConfiguracion[];
