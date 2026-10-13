import {
  PASSWORD_LARGO_MAXIMO,
  PASSWORD_LARGO_MINIMO,
} from '../../common/validators/password-segura.validator';

/** Credenciales de arranque del primer Propietario. */
export interface CredencialesPropietario {
  email: string;
  password: string;
  /** Si entra obligado a cambiarla en el primer acceso. */
  forzarCambio: boolean;
}

/** Usuario y contraseña de demostración. Solo fuera de producción. */
export const EMAIL_DEMO = 'propietario@terravid.demo';
// NOSONAR: clave pública de la base de demostración, documentada en el README.
// No es un secreto: en producción `credencialesDelPropietario` la rechaza.
export const PASSWORD_DEMO = 'Terravid123!'; // NOSONAR

/**
 * De dónde salen las credenciales del primer Propietario.
 *
 * El seed **se corre en producción** —así lo indica `docs/DESPLIEGUE.md`—,
 * porque los roles, los catálogos maestros y la configuración por defecto hacen
 * falta ahí igual que en desarrollo. El problema no era ese: era que creaba,
 * también en producción, un Propietario con la contraseña escrita en el README.
 * Es la única cuenta que puede crear las demás, así que era la llave de todo el
 * sistema, publicada en el repositorio.
 *
 * Fuera de producción sigue habiendo un usuario demo con credenciales fijas: es
 * lo que hace que `npm run seed && npm run start:dev` alcance para trabajar, y
 * es el usuario que usan el smoke y los e2e.
 *
 * En producción la contraseña se da por entorno y el usuario entra obligado a
 * cambiarla.
 *
 * Vive en su propio módulo, separado de `seed.ts`, porque ese archivo ejecuta
 * el seed al importarlo: sin la separación, probar esta lógica sembraría la
 * base.
 */
export function credencialesDelPropietario(
  entorno: NodeJS.ProcessEnv = process.env,
): CredencialesPropietario {
  const enProduccion = entorno.NODE_ENV === 'production';
  const email = entorno.SEED_PROPIETARIO_EMAIL ?? EMAIL_DEMO;
  const password = entorno.SEED_PROPIETARIO_PASSWORD;

  if (!enProduccion) {
    return {
      email,
      password: password ?? PASSWORD_DEMO,
      forzarCambio: false,
    };
  }

  if (!password) {
    throw new Error(
      'Falta SEED_PROPIETARIO_PASSWORD. En producción no hay contraseña por ' +
        'defecto a propósito: la de desarrollo está escrita en el README, y ' +
        'esta es la cuenta que puede crear todas las demás. Definí también ' +
        'SEED_PROPIETARIO_EMAIL si no querés usar el correo de demostración.',
    );
  }

  if (password === PASSWORD_DEMO) {
    throw new Error(
      'SEED_PROPIETARIO_PASSWORD es la contraseña de demostración, que está ' +
        'publicada en el README. Usá otra.',
    );
  }

  // La misma política que la API exige en el alta de usuario, el reset por
  // token y el cambio con contraseña actual. Si el seed pudiera saltearla, la
  // puerta más importante sería la más débil.
  const problema = validarPassword(password);
  if (problema) {
    throw new Error(
      `SEED_PROPIETARIO_PASSWORD no cumple la política: ${problema}`,
    );
  }

  return { email, password, forzarCambio: true };
}

/** Devuelve el motivo del rechazo, o `null` si la contraseña sirve. */
function validarPassword(password: string): string | null {
  if (password.length < PASSWORD_LARGO_MINIMO) {
    return `debe tener al menos ${PASSWORD_LARGO_MINIMO} caracteres.`;
  }
  // bcrypt trunca en silencio a 72 bytes; ver password-segura.validator.ts.
  if (password.length > PASSWORD_LARGO_MAXIMO) {
    return `no puede superar los ${PASSWORD_LARGO_MAXIMO} caracteres.`;
  }
  if (!/[a-zA-Z]/.test(password)) {
    return 'debe incluir al menos una letra.';
  }
  if (!/[0-9]/.test(password)) {
    return 'debe incluir al menos un número.';
  }
  return null;
}

/** Administrador de plataforma de demostración (D-025). Solo fuera de producción. */
export const EMAIL_ADMIN_DEMO = 'admin@terravid.demo';

/**
 * Credenciales del Administrador de plataforma (D-025), o `null` si no hay que
 * crearlo.
 *
 * Fuera de producción hay uno de demostración con la misma contraseña que el
 * Propietario demo. En producción solo se crea si se define
 * `SEED_ADMIN_PASSWORD`: no es obligatorio porque el seed también se corre para
 * actualizar roles y catálogos de una instancia que ya tiene su Administrador.
 * Valen las mismas reglas que para el Propietario.
 */
export function credencialesDelAdministrador(
  entorno: NodeJS.ProcessEnv = process.env,
): CredencialesPropietario | null {
  const enProduccion = entorno.NODE_ENV === 'production';
  const email = entorno.SEED_ADMIN_EMAIL ?? EMAIL_ADMIN_DEMO;
  const password = entorno.SEED_ADMIN_PASSWORD;

  if (!enProduccion) {
    return { email, password: password ?? PASSWORD_DEMO, forzarCambio: false };
  }
  if (!password) return null;
  if (password === PASSWORD_DEMO) {
    throw new Error(
      'SEED_ADMIN_PASSWORD es la contraseña de demostración, que está ' +
        'publicada en el README. Usá otra.',
    );
  }
  const problema = validarPassword(password);
  if (problema) {
    throw new Error(`SEED_ADMIN_PASSWORD no cumple la política: ${problema}`);
  }
  return { email, password, forzarCambio: true };
}
