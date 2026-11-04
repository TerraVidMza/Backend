export enum EstadoSync {
  PENDIENTE = 'pendiente',
  SINCRONIZADO = 'sincronizado',
  ERROR = 'error',
  /**
   * Labor anulada por el Propietario o el Agrónomo (con motivo). Se modela como
   * un estado de sincronización a propósito: **todas** las consultas de costeo,
   * dashboard e inteligencia ya filtran `estado_sync = 'sincronizado'`, así que
   * una labor anulada queda fuera de todas sin tocar ninguna. Una bandera aparte
   * obligaba a recordar el filtro en cada consulta, y olvidar uno haría sumar
   * plata anulada en silencio.
   */
  ANULADO = 'anulado',
}
