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
  /**
   * Qué claves salieron de la tabla `configuracion` en vez del entorno. Va al
   * log del envío: la precedencia empresa-sobre-entorno es invisible desde
   * afuera, y un `smtp_from` guardado en la tabla pisa a `MAIL_FROM` sin dejar
   * rastro en ninguna parte.
   */
  desdeConfiguracion: string[];
}

/**
 * Nodemailer devuelve los destinatarios como cadena o como `{name, address}`
 * según cómo se los pasó. Interpolar el objeto directo imprime
 * `[object Object]`, que es peor que no registrar nada.
 */
function direccion(destinatario: string | { address: string }): string {
  return typeof destinatario === 'string' ? destinatario : destinatario.address;
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
 *
 * **Cuidado con esa precedencia.** Un `smtp_from` guardado en `configuracion`
 * pisa a `MAIL_FROM` en producción, y si apunta a un dominio no verificado el
 * relay acepta el mensaje en el protocolo SMTP y lo descarta después: el envío
 * devuelve `true`, no llega nada, y no hay error en ninguna parte. Por eso el
 * camino exitoso también se registra —con el remitente y con el origen de cada
 * valor—: el log de la aplicación es lo único que puede delatarlo antes de ir a
 * mirar el panel del proveedor.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configuracionService: ConfiguracionService) {}

  /**
   * Nunca lanza: un fallo de correo no puede tumbar la operación que lo
   * disparó (crear un usuario, generar un token de recuperación). Devuelve si
   * se envió para que el llamador pueda registrarlo.
   *
   * Registra también los envíos exitosos, con el remitente y de dónde salió la
   * configuración. Antes el camino feliz era silencioso, y eso escondió el
   * problema descripto arriba durante todo un despliegue.
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

      const info = await transporter.sendMail({
        from: smtp.from,
        to: mensaje.para,
        subject: mensaje.asunto,
        text: mensaje.texto,
        html: mensaje.html,
      });

      // El remitente y el origen de la configuración son el punto del log: un
      // `smtp_from` con un dominio inexistente hace que el relay acepte el
      // mensaje en el protocolo y lo descarte después. Sin esta línea el envío
      // se ve exitoso y no hay nada que revisar.
      const origen = smtp.desdeConfiguracion.length
        ? ` [de configuración: ${smtp.desdeConfiguracion.join(', ')}]`
        : ' [del entorno]';
      this.logger.log(
        `Enviado "${mensaje.asunto}" a ${String(mensaje.para)} ` +
          `desde ${smtp.from} vía ${smtp.host}:${smtp.port}${origen} — ` +
          `id=${info.messageId} respuesta="${info.response}"`,
      );

      // `sendMail` resuelve bien mientras al menos un destinatario sea
      // aceptado, así que un rechazo parcial pasaría inadvertido.
      if (info.rejected.length > 0) {
        this.logger.warn(
          `El servidor rechazó ${info.rejected.length} destinatario(s) de ` +
            `"${mensaje.asunto}": ${info.rejected.map(direccion).join(', ')}`,
        );
      }

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
    const desdeConfiguracion: string[] = [];

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
      //
      // De paso queda anotado qué pisó qué, para el log del envío.
      const preferirConfiguracion = (
        clave: string,
        deConfiguracion: string | null,
        deEntorno: string | null,
      ): string | null => {
        if (!deConfiguracion) return deEntorno;
        desdeConfiguracion.push(clave);
        return deConfiguracion;
      };

      host = preferirConfiguracion('smtp_host', h, host);
      port = preferirConfiguracion('smtp_port', p, port);
      user = preferirConfiguracion('smtp_user', u, user);
      pass = preferirConfiguracion('smtp_pass', pw, pass);
      from = preferirConfiguracion('smtp_from', f, from);
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
      desdeConfiguracion,
    };
  }
}
