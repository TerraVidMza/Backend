import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { TokenRevocado } from './entities/token-revocado.entity';

@Injectable()
export class TokenRevocadoService {
  private readonly logger = new Logger(TokenRevocadoService.name);

  constructor(
    @InjectRepository(TokenRevocado)
    private readonly revocadoRepository: Repository<TokenRevocado>,
  ) {}

  /**
   * Revoca un token por su `jti`.
   *
   * Idempotente: cerrar sesión dos veces con el mismo token no puede fallar, y
   * el UNIQUE de `jti` haría estallar el segundo intento.
   */
  async revocar(jti: string, usuarioId: string, expiraEn: Date): Promise<void> {
    try {
      await this.revocadoRepository.insert({
        jti,
        usuarioId,
        expiresAt: expiraEn,
      });
    } catch (error) {
      const yaRevocado = await this.estaRevocado(jti);
      if (!yaRevocado) {
        throw error;
      }
      this.logger.debug(`El token ${jti} ya estaba revocado.`);
    }
  }

  /**
   * Está en el camino crítico de **cada request autenticada**, por eso consulta
   * solo por el índice único de `jti` y devuelve un booleano en vez de la fila.
   */
  async estaRevocado(jti: string): Promise<boolean> {
    return this.revocadoRepository.exists({ where: { jti } });
  }

  /**
   * Borra las revocaciones cuyo token ya venció por su cuenta: a partir de ahí
   * el JWT se rechaza por `exp` y recordarlo no aporta nada.
   */
  async purgarVencidos(): Promise<number> {
    const resultado = await this.revocadoRepository.delete({
      expiresAt: LessThan(new Date()),
    });
    return resultado.affected ?? 0;
  }
}
