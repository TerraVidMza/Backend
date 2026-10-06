import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Not, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { RefreshToken } from './entities/refresh-token.entity';

/**
 * Tiempo durante el cual un token recién rotado se rechaza sin castigar a la
 * familia. Cubre a dos pestañas de la Web (o un reintento de red del móvil)
 * que renuevan con el mismo token casi a la vez: la segunda pierde, pero la
 * sesión de la primera sigue viva y la segunda toma el token nuevo del
 * almacenamiento compartido.
 */
export const GRACIA_ROTACION_MS = 30_000;

export interface TokenEmitido {
  token: string;
  expiraEn: Date;
  familiaId: string;
}

function hashear(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly repo: Repository<RefreshToken>,
  ) {}

  /**
   * Emite un refresh token. Sin `familiaId` abre una sesión nueva (login); con
   * él, continúa una existente (rotación).
   */
  async emitir(
    usuarioId: string,
    dias: number,
    familiaId: string = crypto.randomUUID(),
  ): Promise<TokenEmitido & { id: string }> {
    const token = crypto.randomBytes(32).toString('base64url');
    const expiraEn = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    const fila = await this.repo.save(
      this.repo.create({
        tokenHash: hashear(token),
        usuarioId,
        familiaId,
        expiresAt: expiraEn,
        revocadoAt: null,
        reemplazadoPorId: null,
      }),
    );
    return { token, expiraEn, familiaId, id: fila.id };
  }

  /**
   * Valida y consume un refresh token. Devuelve a quién pertenece y la familia
   * para emitir el siguiente; quien llama tiene que avisar el reemplazo con
   * `marcarReemplazo`.
   *
   * Todos los rechazos son 401 con mensajes que no distinguen "no existe" de
   * "vencido" más allá de lo necesario para el cliente: cualquiera de ellos
   * significa "volvé a iniciar sesión".
   */
  async consumir(
    token: string,
  ): Promise<{ id: string; usuarioId: string; familiaId: string }> {
    const fila = await this.repo.findOne({
      where: { tokenHash: hashear(token) },
    });
    if (!fila) {
      throw new UnauthorizedException('Sesión inválida');
    }

    if (fila.revocadoAt) {
      const recienRotado =
        fila.reemplazadoPorId !== null &&
        Date.now() - fila.revocadoAt.getTime() < GRACIA_ROTACION_MS;
      if (!recienRotado) {
        // Un token rotado que vuelve a aparecer fuera de la ventana de gracia
        // lo tiene alguien más: se corta la sesión completa.
        await this.revocarFamilia(fila.familiaId);
        this.logger.warn(
          `Reuso de refresh token detectado (usuario ${fila.usuarioId}): familia ${fila.familiaId} revocada.`,
        );
      }
      throw new UnauthorizedException('La sesión ya no es válida');
    }

    if (fila.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('La sesión expiró');
    }

    // Revocación condicional: si dos requests consumen el mismo token a la
    // vez, solo una afecta la fila; la otra se trata como rotación concurrente.
    const resultado = await this.repo.update(
      { id: fila.id, revocadoAt: IsNull() },
      { revocadoAt: new Date() },
    );
    if (!resultado.affected) {
      throw new UnauthorizedException('La sesión ya no es válida');
    }

    return {
      id: fila.id,
      usuarioId: fila.usuarioId,
      familiaId: fila.familiaId,
    };
  }

  async marcarReemplazo(id: string, reemplazoId: string): Promise<void> {
    await this.repo.update({ id }, { reemplazadoPorId: reemplazoId });
  }

  /** Cierra una sesión: logout o reuso detectado. */
  async revocarFamilia(familiaId: string): Promise<void> {
    await this.repo.update(
      { familiaId, revocadoAt: IsNull() },
      { revocadoAt: new Date() },
    );
  }

  /**
   * Cierra todas las sesiones del usuario, salvo opcionalmente una. Se usa al
   * cambiar o restablecer la contraseña: quien la cambió sigue conectado y
   * cualquier otro dispositivo tiene que volver a entrar.
   */
  async revocarDeUsuario(
    usuarioId: string,
    salvoFamiliaId?: string,
  ): Promise<void> {
    await this.repo.update(
      {
        usuarioId,
        revocadoAt: IsNull(),
        ...(salvoFamiliaId ? { familiaId: Not(salvoFamiliaId) } : {}),
      },
      { revocadoAt: new Date() },
    );
  }

  /** Borra los tokens vencidos: a partir de ahí no sirven ni para detectar reuso. */
  async purgarVencidos(): Promise<number> {
    const resultado = await this.repo.delete({
      expiresAt: LessThan(new Date()),
    });
    return resultado.affected ?? 0;
  }
}
