import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Configuracion } from './entities/configuracion.entity';
import { SetConfiguracionDto } from './dto/set-configuracion.dto';
import {
  CLAVES_PREFERENCIAS,
  CLAVES_SECRETAS,
  LIMITES_SESION,
  VALOR_ENMASCARADO,
} from './configuracion.keys';

export interface DuracionesSesion {
  accessMinutos: number;
  refreshDias: number;
}

/** El proyecto es de Mendoza; es el default sensato mientras no se configure. */
export const ZONA_HORARIA_POR_DEFECTO = 'America/Argentina/Mendoza';

@Injectable()
export class ConfiguracionService {
  private readonly logger = new Logger(ConfiguracionService.name);

  constructor(
    @InjectRepository(Configuracion)
    private readonly configuracionRepository: Repository<Configuracion>,
  ) {}

  /** Lectura para la API: los valores secretos salen enmascarados. */
  async findAll(empresaId: string): Promise<Configuracion[]> {
    const configs = await this.configuracionRepository.find({
      where: { empresaId },
      order: { clave: 'ASC' },
    });
    return configs.map((c) => this.enmascarar(c));
  }

  /**
   * Preferencias de presentación de la empresa (D-020).
   *
   * Es el mismo dato que `findAll` pero acotado a `CLAVES_PREFERENCIAS`, para
   * que los formateadores de la interfaz —moneda, unidades, zona horaria— estén
   * disponibles para todos los roles sin abrirles la configuración del sistema,
   * que incluye el SMTP sin enmascarar salvo la contraseña.
   *
   * Devuelve solo las claves cargadas: una empresa recién creada no tiene
   * ninguna fila y el cliente cae a sus propios valores por defecto.
   */
  async findPreferencias(empresaId: string): Promise<Configuracion[]> {
    const configs = await this.configuracionRepository.find({
      where: { empresaId, clave: In([...CLAVES_PREFERENCIAS]) },
      order: { clave: 'ASC' },
    });
    // Hoy ninguna preferencia es secreta y el tipo de `CLAVES_PREFERENCIAS` no
    // lo impide: enmascarar igual evita que agregar una clave a la lista se
    // convierta en una filtración silenciosa.
    return configs.map((c) => this.enmascarar(c));
  }

  async findByClave(
    clave: string,
    empresaId: string,
  ): Promise<Configuracion | null> {
    const config = await this.configuracionRepository.findOne({
      where: { clave, empresaId },
    });
    return config ? this.enmascarar(config) : null;
  }

  /**
   * Lectura interna, sin enmascarar. Es la que deben usar los servicios que
   * realmente necesitan el valor (por ejemplo el envío de mails con el SMTP),
   * y nunca un controller.
   */
  async getValorInterno(
    clave: string,
    empresaId: string,
  ): Promise<string | null> {
    const config = await this.configuracionRepository.findOne({
      where: { clave, empresaId },
    });
    return config?.valor ?? null;
  }

  /**
   * Zona horaria de la empresa (HU-33), con Mendoza como valor por defecto.
   *
   * Se usa para agrupar `timestamptz` por día o por hora. Agrupar en UTC hace
   * que en Argentina (UTC−3) las lecturas de 21:00 a 24:00 caigan al día
   * siguiente: los promedios diarios mezclan dos jornadas y, en HU-32, los
   * pares de correlación quedan desalineados contra las fechas locales de las
   * labores.
   *
   * Se valida contra la base de zonas de PostgreSQL antes de devolverla: un
   * valor cargado a mano que Postgres no reconozca haría fallar toda consulta
   * que la use, y es preferible caer al default.
   */
  async getZonaHoraria(empresaId: string): Promise<string> {
    const valor = await this.getValorInterno('zona_horaria', empresaId);
    if (!valor) return ZONA_HORARIA_POR_DEFECTO;

    const conocida = await this.configuracionRepository.query<
      Array<{ existe: boolean }>
    >(
      `SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = $1) AS existe`,
      [valor],
    );

    if (!conocida[0]?.existe) {
      this.logger.warn(
        `Zona horaria "${valor}" no reconocida por PostgreSQL; se usa ${ZONA_HORARIA_POR_DEFECTO}.`,
      );
      return ZONA_HORARIA_POR_DEFECTO;
    }
    return valor;
  }

  /**
   * Duración de las sesiones de la empresa (D-023). Un valor fuera de rango
   * cargado a mano en la base se ignora y se usa el valor por defecto: una
   * configuración rota no puede dejar a nadie sin poder iniciar sesión.
   */
  async getDuracionesSesion(empresaId: string): Promise<DuracionesSesion> {
    const configs = await this.configuracionRepository.find({
      where: { empresaId, clave: In(Object.keys(LIMITES_SESION)) },
    });
    const leer = (clave: keyof typeof LIMITES_SESION): number => {
      const { min, max, porDefecto } = LIMITES_SESION[clave];
      const valor = Number(configs.find((c) => c.clave === clave)?.valor);
      return Number.isInteger(valor) && valor >= min && valor <= max
        ? valor
        : porDefecto;
    };
    return {
      accessMinutos: leer('sesion_access_minutos'),
      refreshDias: leer('sesion_refresh_dias'),
    };
  }

  async set(
    dto: SetConfiguracionDto,
    updatedById: string,
    empresaId: string,
  ): Promise<Configuracion> {
    this.validarValor(dto);

    let config = await this.configuracionRepository.findOne({
      where: { clave: dto.clave, empresaId },
    });
    if (!config) {
      config = this.configuracionRepository.create({
        clave: dto.clave,
        empresaId,
      });
    }
    config.valor = dto.valor;
    config.updatedById = updatedById;
    const guardada = await this.configuracionRepository.save(config);
    return this.enmascarar(guardada);
  }

  /** Validaciones por clave que el DTO genérico (clave + texto) no puede expresar. */
  private validarValor(dto: SetConfiguracionDto): void {
    if (dto.clave in LIMITES_SESION) {
      const { min, max } =
        LIMITES_SESION[dto.clave as keyof typeof LIMITES_SESION];
      const valor = Number(dto.valor);
      if (!/^\d+$/.test(dto.valor) || valor < min || valor > max) {
        throw new BadRequestException(
          `${dto.clave} debe ser un número entero entre ${min} y ${max}`,
        );
      }
    }
  }

  private enmascarar(config: Configuracion): Configuracion {
    if (!CLAVES_SECRETAS.has(config.clave) || !config.valor) {
      return config;
    }
    // Copia: no mutamos la entidad, que puede seguir viva en el contexto de
    // persistencia de TypeORM.
    return { ...config, valor: VALOR_ENMASCARADO };
  }
}
