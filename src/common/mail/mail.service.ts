import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfiguracionService } from '../../modules/configuracion/configuracion.service';

export interface MensajeCorreo {
  para: string | string[];
  asunto: string;
  texto: string;
  html?: string;
}

interface ConfiguracionSmtp {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

/**
 * Envío de correo (HU-03, HU-04, HU-22, HU-36).
 *
 * Resuelve el SMTP por empresa desde `configuracion` (HU-33) y cae a las
 * variables de entorno cuando la empresa no lo tiene configurado. Antes cada
 * módulo que necesitaba mandar un mail armaba su propio `createTransport`, y de
 * hecho solo lo tenía tickets: el reset de contraseña de HU-03 nunca mandó nada.
 *
 * `MAIL_TRANSPORT=log` escribe el mensaje en consola en vez de enviarlo. Es el
 * modo de desarrollo: sin él, probar el flujo de recuperación exige un SMTP real.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configuracionService: ConfiguracionService) {}

  /**
   * Nunca lanza: un fallo de correo no puede tumbar la operación que lo
   * disparó (crear un usuario, generar un token de recuperación). Devuelve si
   * se envió para que el llamador pueda registrarlo.
   */
  async enviar(mensaje: MensajeCorreo, empresaId?: string): Promise<boolean> {
    try {
      if (this.modoLog()) {
        this.logger.log(
          `[MAIL:log] para=${String(mensaje.para)} asunto="${mensaje.asunto}"\n${mensaje.texto}`,
        );
        return true;
      }

      const smtp = await this.resolverSmtp(empresaId);
      if (!smtp) {
        this.logger.warn(
          `SMTP no configurado: no se envió "${mensaje.asunto}" a ${String(mensaje.para)}.`,
        );
        return false;
      }

      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth:
          smtp.user && smtp.pass
            ? { user: smtp.user, pass: smtp.pass }
            : undefined,
      });

      await transporter.sendMail({
        from: smtp.from,
        to: mensaje.para,
        subject: mensaje.asunto,
        text: mensaje.texto,
        html: mensaje.html,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Error enviando "${mensaje.asunto}": ${(error as Error).message}`,
      );
      return false;
    }
  }

  private modoLog(): boolean {
    return (process.env.MAIL_TRANSPORT ?? 'log') === 'log';
  }

  /**
   * La configuración de la empresa gana sobre la del entorno. Se usa
   * `getValorInterno` y no `findByClave` porque esta última enmascara los
   * secretos, y autenticar contra el SMTP con "********" falla siempre.
   */
  private async resolverSmtp(
    empresaId?: string,
  ): Promise<ConfiguracionSmtp | null> {
    let host = process.env.SMTP_HOST || null;
    let port = process.env.SMTP_PORT || null;
    let user = process.env.SMTP_USER || null;
    let pass = process.env.SMTP_PASS || null;
    let from = process.env.MAIL_FROM || null;
    let secure = process.env.SMTP_SECURE === 'true';

    if (empresaId) {
      const [h, p, u, pw, f] = await Promise.all([
        this.configuracionService.getValorInterno('smtp_host', empresaId),
        this.configuracionService.getValorInterno('smtp_port', empresaId),
        this.configuracionService.getValorInterno('smtp_user', empresaId),
        this.configuracionService.getValorInterno('smtp_pass', empresaId),
        this.configuracionService.getValorInterno('smtp_from', empresaId),
      ]);
      // `||` y no `??`: la clave existe en la tabla pero vacía cuando la
      // empresa todavía no configuró su SMTP, y una cadena vacía no debe pisar
      // el valor del entorno.
      host = h || host;
      port = p || port;
      user = u || user;
      pass = pw || pass;
      from = f || from;
      // 465 es el único puerto SMTP que arranca con TLS implícito.
      secure = port === '465' ? true : secure;
    }

    if (!host) {
      return null;
    }

    return {
      host,
      port: port ? parseInt(port, 10) : 587,
      secure,
      user: user ?? undefined,
      pass: pass ?? undefined,
      from: from ?? 'TerraVid <no-reply@terravid.local>',
    };
  }
}
