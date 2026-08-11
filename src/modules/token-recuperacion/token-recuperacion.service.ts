import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { TokenRecuperacion } from './entities/token-recuperacion.entity';

const TOKEN_TTL_MINUTES = 30;

@Injectable()
export class TokenRecuperacionService {
  constructor(
    @InjectRepository(TokenRecuperacion)
    private readonly tokenRepository: Repository<TokenRecuperacion>,
  ) {}

  async generar(usuarioId: string): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const token = this.tokenRepository.create({
      usuarioId,
      tokenHash,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000),
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
}
