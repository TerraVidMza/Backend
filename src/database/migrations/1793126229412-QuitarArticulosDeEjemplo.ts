import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Borra los cuatro artículos de ejemplo que sembraba el seed (D-036).
 *
 * El manual de usuario pasó a viajar con la Web y la app móvil, y estos
 * artículos repetían en una línea lo que el manual explica con capturas. Se
 * borran por título exacto: cualquier artículo que haya cargado un Propietario
 * queda intacto.
 */
const EJEMPLOS: Array<[string, string, string, string]> = [
  [
    'manual',
    'autenticacion',
    'Cómo iniciar sesión',
    'Ingresá tu email y contraseña en la pantalla de login. Si olvidaste tu contraseña, usá el enlace "Recuperar contraseña".',
  ],
  [
    'faq',
    'autenticacion',
    '¿Qué pasa si fallo el login varias veces?',
    'Después de 5 intentos fallidos, la cuenta se bloquea temporalmente por 15 minutos por seguridad.',
  ],
  [
    'manual',
    'operaciones',
    'Registrar una labor en modo offline',
    'La app móvil permite registrar labores sin conexión. Los registros se sincronizan automáticamente al recuperar señal, usando un identificador único para evitar duplicados.',
  ],
  [
    'manual',
    'vendimia',
    'Generar un remito de vendimia',
    'Desde el cuartel con pesajes pendientes, generá un borrador de remito. El Propietario o Agrónomo debe aprobarlo o rechazarlo antes de liquidar.',
  ],
];

export class QuitarArticulosDeEjemplo1793126229412 implements MigrationInterface {
  name = 'QuitarArticulosDeEjemplo1793126229412';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [tipo, modulo, titulo] of EJEMPLOS) {
      await queryRunner.query(
        `DELETE FROM "articulos_ayuda" WHERE "tipo" = $1 AND "modulo" = $2 AND "titulo" = $3`,
        [tipo, modulo, titulo],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [tipo, modulo, titulo, contenido] of EJEMPLOS) {
      await queryRunner.query(
        `INSERT INTO "articulos_ayuda" ("tipo", "modulo", "titulo", "contenido", "orden", "activo") VALUES ($1, $2, $3, $4, 1, true)`,
        [tipo, modulo, titulo, contenido],
      );
    }
  }
}
