export const EVENTO_LECTURA_INGERIDA = 'lectura.ingerida';

/**
 * Se emite cuando una lectura de sensor quedó persistida.
 *
 * Lleva el valor y el timestamp además del id para que quien la consuma no
 * tenga que releer la fila que se acaba de escribir.
 */
export class LecturaIngeridaEvent {
  constructor(
    public readonly sensorId: string,
    public readonly valor: number,
    public readonly sensorTimestamp: Date,
  ) {}
}
