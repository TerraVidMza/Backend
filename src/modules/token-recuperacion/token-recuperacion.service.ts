import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { TokenRecuperacion } from './entities/token-recuperacion.entity';

/** Se exporta para que el mail de recuperación anuncie la vigencia real. */
export const TOKEN_TTL_MINUTES = 30;

/**
 * El enlace de bienvenida dura mucho más que el de recuperación (HU-05): el
 * usuario nuevo no lo pidió y puede tardar días en ver el correo, mientras que
 * un reset lo solicita alguien que está mirando la pantalla en ese momento.
 */
export const TOKEN_BIENVENIDA_TTL_MINUTES = 48 * 60;

@Injectable()
export class TokenRecuperacionService {
  constructor(
    @InjectRepository(TokenRecuperacion)
    private readonly tokenRepository: Repository<TokenRecuperacion>,
  ) {}

  /**
   * Genera un token de un solo uso. Solo se persiste el hash: si se filtrara la
   * tabla, los tokens en vuelo siguen sin ser utilizables.
   */
  async generar(
    usuarioId: string,
    ttlMinutos = TOKEN_TTL_MINUTES,
  ): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const token = this.tokenRepository.create({
      usuarioId,
      tokenHash,
      expiresAt: new Date(Date.now() + ttlMinutos * 60_000),
    });
    await this.tokenRepository.save(token);

    return rawToken;
  }

  async validarYConsumir(rawToken: string): Promise<string | null> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const token = await this.tokenRepository.findOne({ where: { tokenHash } });

    if (!token || token.usedAt || token.expiresAt < new Date()) {
      return null;
    }

    token.usedAt = new Date();
    await this.tokenRepository.save(token);

    return token.usuarioId;
  }

  /**
   * Borra los tokens vencidos o ya usados con más de `dias` días.
   *
   * Un token consumido no vuelve a servir para nada, pero la tabla crece con
   * cada solicitud de recuperación y nunca se limpiaba. Se conserva una ventana
   * corta para poder investigar un incidente reciente.
   */
  async purgarVencidos(dias = 7): Promise<number> {
    const corte = new Date();
    corte.setDate(corte.getDate() - dias);

    const resultado = await this.tokenRepository
      .createQueryBuilder()
      .delete()
      .where('expires_at < :corte', { corte })
      .orWhere('used_at IS NOT NULL AND used_at < :corte', { corte })
      .execute();

    return resultado.affected ?? 0;
  }
}
