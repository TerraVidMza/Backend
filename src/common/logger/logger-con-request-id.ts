import { ConsoleLogger } from '@nestjs/common';
import { requestIdActual } from '../audit/request-context';

/**
 * El logger de Nest, con el id de la request estampado en cada línea.
 *
 * El problema que resuelve aparece recién en producción: en la VM conviven las
 * líneas de todos los requests en curso, intercaladas, y un error dice qué pasó
 * pero no qué lo precedió. Con el id se filtra la operación entera —`journalctl
 * -u terravid | grep <id>`— y se reconstruye la secuencia completa.
 *
 * Se resuelve extendiendo `ConsoleLogger` y no cambiando de librería a
 * propósito: el formato, los colores y el comportamiento de los niveles siguen
 * siendo los de Nest, y no se suma una dependencia por un prefijo. Migrar a
 * logs estructurados en JSON es otra conversación, y recién vale la pena cuando
 * haya un agregador que los consuma.
 *
 * El id sale del `AsyncLocalStorage` que ya existía para la IP de auditoría
 * ([D-008](../../../docs/DECISIONS.md)), así que no hay que pasarlo por ninguna
 * firma. Fuera de una request —arranque, cron, tests— no hay contexto y la
 * línea sale igual que antes.
 */
export class LoggerConRequestId extends ConsoleLogger {
  protected override formatContext(context: string): string {
    const requestId = requestIdActual();
    if (!requestId) {
      return super.formatContext(context);
    }

    // Los primeros ocho caracteres alcanzan para correlacionar dentro de una
    // ventana de log y no empujan el mensaje fuera de la pantalla. El valor
    // completo viaja en la cabecera `X-Request-Id` de la respuesta.
    return super.formatContext(`${context} ${requestId.slice(0, 8)}`);
  }
}
