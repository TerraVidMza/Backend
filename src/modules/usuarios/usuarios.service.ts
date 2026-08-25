import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Usuario } from './entities/usuario.entity';
import { UsuarioFinca } from './entities/usuario-finca.entity';
import { Finca } from '../fincas/entities/finca.entity';
import { Rol } from '../roles/entities/rol.entity';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UpdatePerfilDto } from './dto/update-perfil.dto';
import { ListarUsuariosDto } from './dto/listar-usuarios.dto';
import { RolNombre } from '../../common/enums/rol.enum';
import {
  armarResultado,
  calcularPaginacion,
  ResultadoPaginado,
} from '../../common/dto/pagination-query.dto';
import { MailService } from '../../common/mail/mail.service';
import {
  TOKEN_BIENVENIDA_TTL_MINUTES,
  TokenRecuperacionService,
} from '../token-recuperacion/token-recuperacion.service';

/**
 * Se lee en cada invocación, no al importar el módulo: `ConfigModule.forRoot()`
 * todavía no cargó el `.env` en tiempo de import, así que una constante a nivel
 * de módulo quedaría fijada en el valor por defecto.
 */
function saltRounds(): number {
  return parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10);
}

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(UsuarioFinca)
    private readonly usuarioFincaRepository: Repository<UsuarioFinca>,
    @InjectRepository(Finca)
    private readonly fincaRepository: Repository<Finca>,
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
    private readonly tokenRecuperacionService: TokenRecuperacionService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Listado de usuarios de la empresa con búsqueda, filtros y paginación
   * (HU-04). Antes devolvía la tabla entera en cada request.
   */
  async findAll(
    empresaId: string,
    query: ListarUsuariosDto = {},
  ): Promise<ResultadoPaginado<Usuario>> {
    const { page, pageSize, skip, take } = calcularPaginacion(query);

    const where: FindOptionsWhere<Usuario>[] = [];
    const filtroBase: FindOptionsWhere<Usuario> = { empresaId };
    if (query.rolId) {
      filtroBase.rolId = query.rolId;
    }
    if (query.activo !== undefined) {
      filtroBase.activo = query.activo;
    }

    if (query.buscar) {
      // Dos condiciones OR: TypeORM no expone un OR dentro de un mismo objeto.
      const patron = ILike(`%${query.buscar}%`);
      where.push({ ...filtroBase, nombre: patron });
      where.push({ ...filtroBase, email: patron });
    } else {
      where.push(filtroBase);
    }

    const resultado = await this.usuarioRepository.findAndCount({
      where,
      relations: { rol: true },
      order: { nombre: 'ASC' },
      skip,
      take,
    });

    return armarResultado(resultado, page, pageSize);
  }

  /**
   * `empresaId` acota la búsqueda al tenant del solicitante. Se omite solo en
   * los flujos internos de autenticación, donde todavía no hay sesión.
   */
  async findById(id: string, empresaId?: string): Promise<Usuario | null> {
    return this.usuarioRepository.findOne({
      where: empresaId ? { id, empresaId } : { id },
      relations: { rol: true, empresa: true },
    });
  }

  async findByEmail(email: string): Promise<Usuario | null> {
    return this.usuarioRepository.findOne({
      where: { email },
      relations: { rol: true, empresa: true },
    });
  }

  /**
   * Alta de usuario (HU-05).
   *
   * Sin `password` en el DTO se genera una **contraseña temporal aleatoria** y
   * se manda el email de bienvenida con un enlace de 48 horas para que el
   * usuario fije la suya. Es el camino recomendado: el Propietario nunca llega
   * a conocer la contraseña de otro, y la temporal no se devuelve por la API.
   */
  async create(dto: CreateUsuarioDto, empresaId: string): Promise<Usuario> {
    const existente = await this.findByEmail(dto.email);
    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese email');
    }

    const esTemporal = !dto.password;
    const passwordPlano = dto.password ?? this.generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(passwordPlano, saltRounds());

    const usuario = await this.usuarioRepository.save(
      this.usuarioRepository.create({
        nombre: dto.nombre,
        email: dto.email,
        passwordHash,
        empresaId,
        rolId: dto.rolId,
        activo: dto.activo ?? true,
        debeCambiarPassword: esTemporal,
      }),
    );

    if (esTemporal) {
      await this.enviarBienvenida(usuario);
    }

    return usuario;
  }

  /**
   * Contraseña temporal de alta entropía. No se muestra a nadie: existe solo
   * para que la cuenta no quede con un hash predecible entre el alta y el
   * primer ingreso, y para que el registro cumpla el NOT NULL de la columna.
   */
  private generarPasswordTemporal(): string {
    // 32 bytes en base64url: muy por encima de cualquier ataque de diccionario
    // y por debajo del truncado a 72 bytes de bcrypt.
    return crypto.randomBytes(32).toString('base64url');
  }

  private async enviarBienvenida(usuario: Usuario): Promise<void> {
    const token = await this.tokenRecuperacionService.generar(
      usuario.id,
      TOKEN_BIENVENIDA_TTL_MINUTES,
    );
    const enlace = `${process.env.APP_URL ?? 'http://localhost:5173'}/reset-password?token=${token}`;
    const horas = TOKEN_BIENVENIDA_TTL_MINUTES / 60;

    await this.mailService.enviar(
      {
        para: usuario.email,
        asunto: '[TerraVid] Te dieron de alta en TerraVid',
        texto: [
          `Hola ${usuario.nombre},`,
          '',
          'Se creó tu cuenta en TerraVid.',
          `Para definir tu contraseña, ingresá en: ${enlace}`,
          '',
          `El enlace vence en ${horas} horas. Si se vence, pedí uno nuevo desde "Recuperar contraseña".`,
        ].join('\n'),
      },
      usuario.empresaId,
    );
  }

  /**
   * Actualización administrativa de un usuario (HU-05, HU-06).
   *
   * `actor` es quien ejecuta la operación: se usa para acotar al tenant y para
   * impedir que un Propietario se cambie el rol a sí mismo, lo que combinado
   * con la baja del último Propietario podría dejar al sistema sin ninguno.
   */
  async update(
    id: string,
    dto: UpdateUsuarioDto,
    actor: { id: string; empresaId: string },
  ): Promise<Usuario> {
    const usuario = await this.findById(id, actor.empresaId);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (dto.rolId && dto.rolId !== usuario.rolId) {
      if (actor.id === id) {
        throw new ForbiddenException('No puedes modificar tu propio rol.');
      }
      await this.verificarRolAsignable(dto.rolId);
    }

    Object.assign(usuario, dto);
    return this.usuarioRepository.save(usuario);
  }

  /**
   * Lista blanca de roles asignables (HU-06).
   *
   * Sin esto `update()` aceptaba cualquier UUID: uno inexistente reventaba
   * contra la FK y uno de una fila de `roles` agregada a mano pasaba derecho.
   *
   * **Se incluye `PROPIETARIO`, aunque el selector de la HU liste solo Agrónomo,
   * Capataz y Auditor.** Excluirlo dejaría al sistema sin forma de delegar por
   * API: nadie puede cambiarse el rol a sí mismo (F0-9) y no se puede dar de
   * baja al último Propietario, así que un Propietario único quedaría atrapado.
   * La restricción del selector es de pantalla; la del backend, de integridad.
   */
  private async verificarRolAsignable(rolId: string): Promise<void> {
    const rol = await this.rolRepository.findOne({ where: { id: rolId } });
    if (!rol) {
      throw new NotFoundException('El rol indicado no existe.');
    }

    const asignables = Object.values(RolNombre) as string[];
    if (!asignables.includes(rol.nombreRol)) {
      throw new BadRequestException(
        `El rol "${rol.nombreRol}" no es asignable. Roles válidos: ${asignables.join(', ')}.`,
      );
    }
  }

  /** Actualización del perfil propio: solo el nombre (HU-04). */
  async updatePerfil(id: string, dto: UpdatePerfilDto): Promise<Usuario> {
    const usuario = await this.findById(id);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }
    usuario.nombre = dto.nombre;
    return this.usuarioRepository.save(usuario);
  }

  /**
   * Fijar una contraseña propia limpia la marca de temporal: si no, el cliente
   * seguiría forzando el cambio en cada ingreso después de que el usuario ya la
   * cambió.
   */
  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.usuarioRepository.update(id, {
      passwordHash,
      debeCambiarPassword: false,
    });
  }

  async registrarAccesoExitoso(id: string): Promise<void> {
    await this.usuarioRepository.update(id, {
      ultimoAcceso: new Date(),
      intentosFallidos: 0,
      bloqueadoHasta: null,
    });
  }

  async registrarIntentoFallido(
    usuario: Usuario,
    maxIntentos = 5,
    bloqueoMinutos = 15,
  ): Promise<void> {
    // Si la ventana de bloqueo anterior ya venció, el contador arranca de cero.
    // Sin esto, tras el desbloqueo el primer fallo vuelve a superar el máximo y
    // re-bloquea la cuenta indefinidamente.
    const bloqueoVencido =
      usuario.bloqueadoHasta !== null && usuario.bloqueadoHasta <= new Date();
    const intentos = bloqueoVencido ? 1 : usuario.intentosFallidos + 1;

    const bloqueadoHasta =
      intentos >= maxIntentos
        ? new Date(Date.now() + bloqueoMinutos * 60_000)
        : null;

    await this.usuarioRepository.update(usuario.id, {
      intentosFallidos: intentos,
      bloqueadoHasta,
    });
  }

  async findByRolesInEmpresa(
    empresaId: string,
    roles: RolNombre[],
  ): Promise<Usuario[]> {
    return this.usuarioRepository.find({
      where: { empresaId, activo: true, rol: { nombreRol: In(roles) } },
      relations: { rol: true },
    });
  }

  /**
   * Destinatarios de un aviso originado en una finca (HU-22).
   *
   * Devuelve los usuarios activos de la empresa con alguno de esos roles que
   * **estén asignados a la finca o no tengan ninguna asignación**. La segunda
   * mitad es deliberada: mientras nadie configure asignaciones, el aviso sigue
   * llegando a todos, en vez de dejar de llegar en silencio.
   */
  async findDestinatariosDeFinca(
    empresaId: string,
    fincaId: string,
    roles: RolNombre[],
  ): Promise<Usuario[]> {
    const candidatos = await this.findByRolesInEmpresa(empresaId, roles);
    if (candidatos.length === 0) return [];

    const asignaciones = await this.usuarioFincaRepository.find({
      where: { usuarioId: In(candidatos.map((u) => u.id)) },
      select: { usuarioId: true, fincaId: true },
    });

    const conAsignacion = new Set(asignaciones.map((a) => a.usuarioId));
    const asignadosAEstaFinca = new Set(
      asignaciones.filter((a) => a.fincaId === fincaId).map((a) => a.usuarioId),
    );

    return candidatos.filter(
      (u) => !conAsignacion.has(u.id) || asignadosAEstaFinca.has(u.id),
    );
  }

  /** Fincas asignadas a un usuario; vacío significa "todas las de su empresa". */
  async getFincasAsignadas(
    usuarioId: string,
    empresaId: string,
  ): Promise<string[]> {
    await this.findById(usuarioId, empresaId);
    const asignaciones = await this.usuarioFincaRepository.find({
      where: { usuarioId },
      select: { fincaId: true },
    });
    return asignaciones.map((a) => a.fincaId);
  }

  /**
   * Reemplaza el conjunto de fincas asignadas a un usuario (HU-22).
   *
   * Es un reemplazo y no un alta incremental porque la pantalla que lo consume
   * edita la lista completa: con un alta por finca, quitar una asignación
   * exigiría un endpoint más y dejaría estados intermedios inconsistentes.
   */
  async asignarFincas(
    usuarioId: string,
    fincaIds: string[],
    empresaId: string,
  ): Promise<string[]> {
    await this.findById(usuarioId, empresaId);

    const unicas = [...new Set(fincaIds)];
    if (unicas.length > 0) {
      const propias = await this.fincaRepository.count({
        where: { id: In(unicas), empresaId },
      });
      if (propias !== unicas.length) {
        throw new NotFoundException(
          'Alguna de las fincas indicadas no pertenece a la empresa.',
        );
      }
    }

    await this.usuarioFincaRepository.delete({ usuarioId });
    if (unicas.length > 0) {
      await this.usuarioFincaRepository.insert(
        unicas.map((fincaId) => ({ usuarioId, fincaId })),
      );
    }
    return unicas;
  }

  async deactivate(id: string, empresaId: string): Promise<void> {
    const usuario = await this.findById(id, empresaId);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // `nombreRol` es varchar en la BD, no un enum de Postgres, así que la
    // comparación se hace contra el string del enum.
    if (usuario.rol?.nombreRol === String(RolNombre.PROPIETARIO)) {
      const propietariosActivos = await this.findByRolesInEmpresa(empresaId, [
        RolNombre.PROPIETARIO,
      ]);
      if (propietariosActivos.length <= 1) {
        throw new ForbiddenException(
          'No es posible dar de baja al único Propietario del sistema.',
        );
      }
    }

    await this.usuarioRepository.update(id, { activo: false });
  }
}
