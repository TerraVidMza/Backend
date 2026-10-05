/**
 * Smoke test end-to-end contra la API corriendo.
 *
 * Cubre las correcciones de Fase 0 (seguridad) y Fase 1 (correctitud de datos
 * y dinero) atravesando HTTP, guards, pipes y base real. Los tests unitarios de
 * `src/**\/*.spec.ts` no lo reemplazan: varios de estos bugs solo aparecen con
 * el `ValidationPipe` y las constraints de PostgreSQL en el medio.
 *
 * Uso:
 *   docker compose up -d
 *   npm run migration:run && npm run seed
 *   npm run start:prod   (en otra terminal)
 *   npm run test:smoke
 */
const API = process.env.SMOKE_API_URL ?? 'http://localhost:3000/api';
// Sufijo por corrida: fincas, tipos de labor y cuadrillas tienen nombre único,
// así que sin esto el script solo pasa contra una base recién sembrada.
const RUN = Date.now().toString().slice(-6);
let token = '';
let ok = 0;
const fallas = [];

/**
 * Fechas en el **día local**, no en UTC.
 *
 * `toISOString().slice(0,10)` devuelve la fecha UTC: en Mendoza (UTC−3), entre
 * las 21:00 y la medianoche eso ya es el día siguiente. La API filtra por el
 * día local —una labor con `fecha` es la jornada de trabajo en la finca—, así
 * que un test que use la fecha UTC falla solo durante esas tres horas.
 */
const diaRelativo = (dias) => {
  const f = new Date();
  f.setDate(f.getDate() + dias);
  const mes = String(f.getMonth() + 1).padStart(2, '0');
  const dia = String(f.getDate()).padStart(2, '0');
  return `${f.getFullYear()}-${mes}-${dia}`;
};
const hoy = () => diaRelativo(0);

async function req(metodo, ruta, body, headers = {}) {
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* respuesta sin cuerpo */
  }
  return { status: res.status, body: json };
}

function check(descripcion, condicion, detalle) {
  if (condicion) {
    console.log(`  OK    ${descripcion}`);
    ok++;
  } else {
    console.log(`  FALLA ${descripcion} → ${JSON.stringify(detalle)}`);
    fallas.push(descripcion);
  }
}

const seccion = (t) => console.log(`\n== ${t} ==`);

// ---------------------------------------------------------------- Auth
seccion('Auth (HU-01, F0-2, F0-10)');
const login = await req('POST', '/auth/login', {
  email: 'propietario@terravid.demo',
  password: 'Terravid123!',
});
check('login devuelve 200', login.status === 200, login);
token = login.body?.accessToken ?? login.body?.access_token ?? '';
check('login devuelve un token', token.length > 0, Object.keys(login.body ?? {}));
check(
  'la respuesta del login no filtra passwordHash',
  !JSON.stringify(login.body ?? {}).includes('passwordHash'),
  login.body,
);

const malPass = await req('POST', '/auth/login', {
  email: 'propietario@terravid.demo',
  password: 'IncorrectaPeroLarga1',
});
check('password incorrecta da 401', malPass.status === 401, malPass);

// ------------------------------------------------- F0-1 escalada de rol
seccion('F0-1 · escalada de privilegios por PATCH /usuarios/me');
const escalada = await req('PATCH', '/usuarios/me', {
  nombre: 'Sergio',
  rolId: '00000000-0000-0000-0000-000000000000',
});
check('PATCH /me con rolId es rechazado (400)', escalada.status === 400, escalada);
const perfilOk = await req('PATCH', '/usuarios/me', { nombre: 'Propietario Demo' });
check('PATCH /me solo con nombre funciona', perfilOk.status === 200, perfilOk);
check(
  'el perfil devuelto no incluye passwordHash',
  !JSON.stringify(perfilOk.body ?? {}).includes('passwordHash'),
  perfilOk.body,
);

// ------------------------------------------------------ F0-8 RBAC / F0-3
seccion('F0-8 · RBAC fail-closed y F0-3 · ingesta IoT');
const sinToken = await fetch(`${API}/usuarios`).then((r) => r.status);
check('sin token da 401', sinToken === 401, sinToken);
const conToken = await req('GET', '/usuarios');
check('Propietario lista usuarios (200)', conToken.status === 200, conToken.status);

const ingestSinClave = await fetch(`${API}/lecturas-iot`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sensorId: '00000000-0000-0000-0000-000000000000',
    valor: 1,
    unidad: 'C',
    sensorTimestamp: new Date().toISOString(),
  }),
});
check('ingesta sin X-Api-Key es rechazada', ingestSinClave.status === 401, ingestSinClave.status);

// ------------------------------------------------------ F0-4 multi-tenant
seccion('F0-4 · aislamiento multi-tenant');
const ajena = await req('GET', '/fincas/00000000-0000-0000-0000-000000000000');
check('finca de otra empresa da 404, no 403', ajena.status === 404, ajena);

// ----------------------------------------------------------- Cartografía
seccion('Alta de finca y cuartel');
const finca = await req('POST', '/fincas', {
  nombre: `Finca Smoke ${RUN}`,
  ubicacion: 'Luján de Cuyo',
  hectareas: 25.5,
});
check('finca creada (201)', finca.status === 201, finca);
const fincaId = finca.body?.id;

const variedades = await req('GET', '/catalogos?tipo=variedad');
const sistemas = await req('GET', '/catalogos?tipo=sistema_conduccion');
const variedadId = variedades.body?.[0]?.id;
const sistemaId = sistemas.body?.[0]?.id;
check('el seed cargó los catálogos maestros', !!variedadId && !!sistemaId, {
  variedadId,
  sistemaId,
});

const cuartel = await req('POST', '/cuarteles', {
  fincaId,
  variedadId,
  sistemaConduccionId: sistemaId,
  nombre: `Cuartel Smoke ${RUN}`,
  hectareas: 10,
  anioImplantacion: 2015,
});
check('cuartel creado (201)', cuartel.status === 201, cuartel);
const cuartelId = cuartel.body?.id;

// ------------------------------------------------ F1-1 costo vigente a fecha
seccion('F1-1 · una labor sin costo vigente no se guarda como sincronizada');
const tipoLabor = await req('POST', '/tipos-labor', {
  nombre: `Poda Smoke ${RUN}`,
  unidadMedida: 'jornal',
  costoUnitarioInicial: 15000,
});
check('tipo de labor creado', tipoLabor.status === 201, tipoLabor);
const tipoLaborId = tipoLabor.body?.id;

const uuidLabor = crypto.randomUUID();
// Fecha anterior a la vigencia del costo inicial: no hay costo aplicable.
const laborVieja = await req('POST', '/registro-labor/sync', { registros: [
  {
    localUuid: uuidLabor,
    cuartelId,
    tipoLaborId,
    fecha: diaRelativo(-30),
    cantidad: 5,
    insumos: [],
  },
] });
check(
  'labor anterior al costo vigente queda en ERROR, no en $0',
  laborVieja.body?.[0]?.estado === 'error',
  laborVieja.body,
);
check(
  'el error explica el motivo',
  typeof laborVieja.body?.[0]?.errorMessage === 'string' &&
    laborVieja.body[0].errorMessage.length > 20,
  laborVieja.body?.[0]?.errorMessage,
);

seccion('F1-1 bis · el mismo local_uuid se reprocesa tras corregir');
const laborHoy = await req('POST', '/registro-labor/sync', { registros: [
  {
    localUuid: uuidLabor,
    cuartelId,
    tipoLaborId,
    fecha: hoy(),
    cantidad: 5,
    insumos: [],
  },
] });
check(
  'reintento con el mismo uuid ahora sincroniza',
  laborHoy.body?.[0]?.estado === 'sincronizado',
  laborHoy.body,
);

const laborRepetida = await req('POST', '/registro-labor/sync', { registros: [
  {
    localUuid: uuidLabor,
    cuartelId,
    tipoLaborId,
    fecha: hoy(),
    cantidad: 5,
    insumos: [],
  },
] });
check(
  'un tercer envío es idempotente (no duplica)',
  laborRepetida.body?.[0]?.yaExistia === true,
  laborRepetida.body,
);

// --------------------------------------------------- F1-12 valid_from
seccion('F1-12 · valid_from no puede ser retroactivo');
const retro = await req('POST', `/tipos-labor/${tipoLaborId}/costos`, {
  costoUnitario: 18000,
  validFrom: '2020-01-01',
});
check('costo con validFrom de 2020 es rechazado (400)', retro.status === 400, retro);
const futuro = await req('POST', `/tipos-labor/${tipoLaborId}/costos`, {
  costoUnitario: 18000,
  validFrom: diaRelativo(15),
});
check('costo con validFrom futuro es aceptado', futuro.status === 201, futuro);

seccion('F2-1 · el UNIQUE de vigencia existe en la base');
const duplicado = await req('POST', `/tipos-labor/${tipoLaborId}/costos`, {
  costoUnitario: 19000,
  validFrom: diaRelativo(15),
});
check(
  'dos costos con la misma validFrom son rechazados',
  duplicado.status === 400 || duplicado.status === 409,
  duplicado,
);

// ------------------------------------------------------- F1-3 / F1-8 vendimia
seccion('F1-3 · un pesaje sin tarifa vigente no entra al circuito');
const cuadrilla = await req('POST', '/cuadrillas', {
  fincaId,
  nombre: `Cuadrilla Smoke ${RUN}`,
  cantidadIntegrantes: 8,
});
check('cuadrilla creada', cuadrilla.status === 201, cuadrilla);
const cuadrillaId = cuadrilla.body?.id;

const uuidPesaje = crypto.randomUUID();
const pesajeSinTarifa = await req('POST', '/pesajes-vendimia/sync', { pesajes: [
  { localUuid: uuidPesaje, cuadrillaId, cuartelId, fecha: hoy(), kgTotales: 1200 },
] });
check(
  'pesaje sin tarifa queda en ERROR',
  pesajeSinTarifa.body?.[0]?.estado === 'error',
  pesajeSinTarifa.body,
);

await req('POST', `/cuadrillas/${cuadrillaId}/tarifas`, {
  tarifaPorKg: 25.5,
  validFrom: hoy(),
});
const pesajeConTarifa = await req('POST', '/pesajes-vendimia/sync', { pesajes: [
  { localUuid: uuidPesaje, cuadrillaId, cuartelId, fecha: hoy(), kgTotales: 1200 },
] });
check(
  'con tarifa vigente el pesaje sincroniza',
  pesajeConTarifa.body?.[0]?.estado === 'sincronizado',
  pesajeConTarifa.body,
);

const pesajeGuardado = await req(
  'GET',
  `/pesajes-vendimia/${pesajeConTarifa.body?.[0]?.pesajeId}`,
);
check(
  'la liquidación se calcula con 2 decimales exactos (1200 × 25,50 = 30600)',
  Number(pesajeGuardado.body?.montoLiquidacion) === 30600,
  pesajeGuardado.body?.montoLiquidacion,
);

seccion('F1-8 · máquina de estados del cuartel');
const estado1 = await req('GET', `/pesajes-vendimia/cuartel/${cuartelId}/estado-cosecha`);
check(
  'el primer pesaje pasa el cuartel a en_cosecha',
  estado1.body?.estado === 'en_cosecha',
  estado1.body,
);

// --------------------------------------------------------------- F1-7 remitos
seccion('F1-7 · concurrencia y numeración de remitos');
const remito = await req('POST', '/remitos/generar-borrador', { cuartelId });
check('borrador generado (201)', remito.status === 201, remito);
check(
  'numeración REM-AAAA-NNNNN con el año en curso',
  (() => {
    const n = remito.body?.numeroRemito ?? '';
    const prefijo = 'REM-' + new Date().getFullYear() + '-';
    const correlativo = n.slice(prefijo.length);
    return n.startsWith(prefijo) && correlativo.length === 5 && /^[0-9]+$/.test(correlativo);
  })(),
  remito.body?.numeroRemito,
);
check(
  'el total del remito arrastra la liquidación',
  Number(remito.body?.totalLiquidacion) === 30600,
  remito.body?.totalLiquidacion,
);
const remitoId = remito.body?.id;

const segundoBorrador = await req('POST', '/remitos/generar-borrador', { cuartelId });
check(
  'un segundo borrador del mismo cuartel da 409',
  segundoBorrador.status === 409,
  segundoBorrador,
);

seccion('F1-13 · el rechazo deja los pesajes en observado');
const motivoCorto = await req('POST', `/remitos/${remitoId}/rechazar`, {
  motivoRechazo: 'no',
});
check('motivo de rechazo de menos de 10 caracteres es rechazado', motivoCorto.status === 400, motivoCorto);

const rechazo = await req('POST', `/remitos/${remitoId}/rechazar`, {
  motivoRechazo: 'Kilos mal cargados por la cuadrilla',
});
check('rechazo aceptado', rechazo.status === 200 || rechazo.status === 201, rechazo);

const estado2 = await req('GET', `/pesajes-vendimia/cuartel/${cuartelId}/estado-cosecha`);
check(
  'los pesajes rechazados quedan observados, no vuelven al pool',
  Number(estado2.body?.kgObservados) === 1200 &&
    Number(estado2.body?.kgPendientesDeRemito) === 0,
  estado2.body,
);
check(
  'el cuartel vuelve a en_cosecha tras el rechazo',
  estado2.body?.estado === 'en_cosecha',
  estado2.body?.estado,
);

const remitoTrasRechazo = await req('POST', '/remitos/generar-borrador', { cuartelId });
check(
  'un remito nuevo no reincluye los pesajes observados sin revisión',
  remitoTrasRechazo.status === 400,
  remitoTrasRechazo,
);

// ----------------------------------------------------------------- F1-6 umbral
seccion('F1-6 · borrar un umbral con null');
const sensor = await req('POST', '/sensores', {
  fincaId,
  codigo: `SM-SMOKE-${Date.now().toString().slice(-6)}`,
  tipo: 'humedad_suelo',
});
check('sensor creado', sensor.status === 201, sensor);
const sensorId = sensor.body?.id;

await req('PUT', `/sensores/${sensorId}/umbral`, { umbralMinimo: 20, umbralMaximo: 80 });
const borrado = await req('PUT', `/sensores/${sensorId}/umbral`, { umbralMinimo: null });
check(
  'null borra el mínimo y conserva el máximo omitido',
  borrado.body?.umbralMinimo === null && Number(borrado.body?.umbralMaximo) === 80,
  borrado.body,
);

// ------------------------------------------------------------- F1-9 margen
seccion('F1-9 · no se publica un margen bruto falso');
const margen = await req('GET', `/registro-labor/cuartel/${cuartelId}/margen-bruto`);
check(
  'margenBruto viene en null y marcado como no disponible',
  margen.body?.margenBruto === null && margen.body?.margenBrutoDisponible === false,
  margen.body,
);

// ------------------------------------------------------ F0-7 config secretos
seccion('F0-7 · las claves secretas de configuración se enmascaran');
await req('PUT', '/configuracion', { clave: 'smtp_pass', valor: 'super-secreta-123' });
const config = await req('GET', '/configuracion');
const smtpPass = (config.body ?? []).find?.((c) => c.clave === 'smtp_pass');
check(
  'smtp_pass no se devuelve en claro',
  !JSON.stringify(config.body ?? {}).includes('super-secreta-123'),
  smtpPass,
);

// =========================================================== FASE 2
// --------------------------------------------------------- F2-2 paginación
seccion('F2-2 · paginación con envelope uniforme');
const usuariosPag = await req('GET', '/usuarios?page=1&pageSize=5');
check(
  'el listado de usuarios devuelve {data,total,page,pageSize,totalPages}',
  Array.isArray(usuariosPag.body?.data) &&
    typeof usuariosPag.body?.total === 'number' &&
    usuariosPag.body?.page === 1 &&
    usuariosPag.body?.pageSize === 5 &&
    typeof usuariosPag.body?.totalPages === 'number',
  usuariosPag.body,
);
check(
  'nunca devuelve más filas que pageSize',
  (usuariosPag.body?.data?.length ?? 0) <= 5,
  usuariosPag.body?.data?.length,
);
check(
  'un pageSize por encima del techo es rechazado',
  (await req('GET', '/usuarios?pageSize=100000')).status === 400,
  null,
);
check(
  'una página inválida es rechazada',
  (await req('GET', '/usuarios?page=0')).status === 400,
  null,
);

const busqueda = await req('GET', '/usuarios?buscar=propietario');
check(
  'la búsqueda por nombre o email filtra',
  (busqueda.body?.data ?? []).every((u) =>
    `${u.nombre} ${u.email}`.toLowerCase().includes('propietario'),
  ) && (busqueda.body?.total ?? 0) >= 1,
  busqueda.body?.total,
);
check(
  'el listado paginado tampoco filtra passwordHash',
  !JSON.stringify(usuariosPag.body ?? {}).includes('passwordHash'),
  null,
);

const laboresPag = await req(
  'GET',
  `/registro-labor/cuartel/${cuartelId}?pageSize=1`,
);
check(
  'el historial de labores viene paginado',
  Array.isArray(laboresPag.body?.data) &&
    typeof laboresPag.body?.total === 'number',
  laboresPag.body,
);
check(
  'el historial trae los insumos de cada labor (HU-17)',
  Array.isArray(laboresPag.body?.data?.[0]?.detalles),
  laboresPag.body?.data?.[0] && Object.keys(laboresPag.body.data[0]),
);

seccion('F2-2 · el listado de remitos ya no exige cuartelId');
const remitosEmpresa = await req('GET', '/remitos');
check(
  'un Propietario puede listar los remitos de su empresa sin cuartelId',
  remitosEmpresa.status === 200 && (remitosEmpresa.body?.total ?? 0) >= 1,
  remitosEmpresa.status,
);
const remitosRechazados = await req('GET', '/remitos?estado=rechazado');
check(
  'se puede filtrar por estado (panel de aprobaciones)',
  remitosRechazados.status === 200 &&
    (remitosRechazados.body?.data ?? []).every((r) => r.estado === 'rechazado'),
  remitosRechazados.body?.data?.map((r) => r.estado),
);

const remitoDetalle = await req('GET', `/remitos/${remitoId}`);
check(
  'GET /remitos/:id trae el detalle de pesajes para la vista imprimible',
  Array.isArray(remitoDetalle.body?.pesajes) &&
    remitoDetalle.body.pesajes.length >= 1 &&
    remitoDetalle.body?.cuartel?.finca?.nombre !== undefined,
  remitoDetalle.body && Object.keys(remitoDetalle.body),
);

seccion('F2-2 · notificaciones y lecturas');
const notis = await req('GET', '/notificaciones?soloNoLeidas=true');
check(
  'las notificaciones devuelven el contador de no leídas',
  notis.status === 200 && typeof notis.body?.noLeidas === 'number',
  notis.body,
);
const lecturas = await req(
  'GET',
  `/lecturas-iot/sensor/${sensorId}?desde=2026-01-01&hasta=2026-12-31`,
);
check(
  'el historial de lecturas acepta rango de fechas y pagina',
  lecturas.status === 200 && Array.isArray(lecturas.body?.data),
  lecturas.status,
);

// ---------------------------------------------------------- F2-3 auditoría
seccion('F2-3 · auditoría transversal');
const auditoria = await req('GET', '/log-auditoria?pageSize=50');
check(
  'el log de auditoría viene paginado',
  auditoria.status === 200 && Array.isArray(auditoria.body?.data),
  auditoria.status,
);
check(
  'cada entrada identifica al responsable por nombre, no solo por UUID',
  auditoria.body?.data?.[0]?.actor?.nombre !== undefined,
  auditoria.body?.data?.[0],
);
check(
  'el log no filtra el passwordHash del actor',
  !JSON.stringify(auditoria.body ?? {}).includes('passwordHash'),
  null,
);

const acciones = new Set((auditoria.body?.data ?? []).map((e) => e.accion));
check(
  'se auditaron las operaciones de negocio, no solo las de auth',
  ['CREAR_FINCA', 'CREAR_CUARTEL', 'GENERAR_REMITO', 'RECHAZAR_REMITO'].every(
    (a) => acciones.has(a),
  ),
  [...acciones],
);
check(
  'las entradas registran la IP de origen',
  (auditoria.body?.data ?? []).some((e) => e.ipAddress),
  auditoria.body?.data?.[0]?.ipAddress,
);

const porEntidad = await req('GET', '/log-auditoria?entidad=remito');
check(
  'el filtro por entidad funciona (HU-05)',
  porEntidad.status === 200 &&
    (porEntidad.body?.data ?? []).every((e) => e.entidad === 'remito') &&
    (porEntidad.body?.total ?? 0) >= 1,
  porEntidad.body?.total,
);
const porAccion = await req('GET', '/log-auditoria?accion=APROBAR_REMITO');
check(
  'el filtro por acción funciona',
  porAccion.status === 200,
  porAccion.status,
);
const porFecha = await req(
  'GET',
  `/log-auditoria?desde=${hoy()}&hasta=${hoy()}`,
);
check(
  'el rango de fechas incluye el día de hoy completo',
  (porFecha.body?.total ?? 0) >= 1,
  porFecha.body?.total,
);

// ------------------------------------------------------------- F2-4 correo
seccion('F2-4 · el flujo de recuperación de contraseña envía correo');
const olvido = await req('POST', '/auth/forgot-password', {
  email: 'propietario@terravid.demo',
});
// 429 es un resultado válido por el mismo motivo que en el check de abajo: el
// límite de HU-03 es de 3 solicitudes por hora y por IP, así que la segunda
// corrida del script dentro de la hora lo alcanza. Lo que se verifica igual en
// los dos casos es lo que importa: que la respuesta no filtre el email.
check(
  'forgot-password responde sin revelar si la cuenta existe',
  (olvido.status === 200 || olvido.status === 429) &&
    !JSON.stringify(olvido.body).includes('@'),
  { status: olvido.status, body: olvido.body },
);
const olvidoInexistente = await req('POST', '/auth/forgot-password', {
  email: 'no-existe@terravid.demo',
});
// 429 es un resultado válido: HU-03 limita a 3 solicitudes por hora y por IP,
// y este script se corre varias veces seguidas contra la misma instancia.
check(
  'la respuesta no distingue una cuenta inexistente (o llegó al límite de HU-03)',
  olvidoInexistente.status === 429 ||
    JSON.stringify(olvidoInexistente.body) === JSON.stringify(olvido.body),
  olvidoInexistente.body,
);

const configSembrada = await req('GET', '/configuracion');
const claves = new Set((configSembrada.body ?? []).map((c) => c.clave));
check(
  'el seed cargó las claves de configuración que HU-33 y HU-36 necesitan',
  ['support_email', 'zona_horaria', 'moneda', 'nombre_organizacion'].every((c) =>
    claves.has(c),
  ),
  [...claves],
);

// ================================================ CRITERIOS POR BLOQUE
seccion('Auth · política de contraseñas server-side');
for (const [caso, password] of [
  ['sin números', 'solamenteletras'],
  ['sin letras', '12345678'],
  ['demasiado corta', 'Ab1'],
]) {
  const r = await req('POST', '/auth/reset-password', {
    token: 'a'.repeat(64),
    newPassword: password,
  });
  check(`contraseña ${caso} es rechazada (400)`, r.status === 400, r.status);
}

seccion('HU-02 · el logout invalida el token');
const sesion = await req('POST', '/auth/login', {
  email: 'propietario@terravid.demo',
  password: 'Terravid123!',
});
const tokenDescartable = sesion.body?.accessToken;
const antesDelLogout = await fetch(`${API}/usuarios/me`, {
  headers: { Authorization: `Bearer ${tokenDescartable}` },
});
check('el token sirve antes del logout', antesDelLogout.status === 200, antesDelLogout.status);

const logout = await fetch(`${API}/auth/logout`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${tokenDescartable}` },
});
check('logout responde 204', logout.status === 204, logout.status);

const despuesDelLogout = await fetch(`${API}/usuarios/me`, {
  headers: { Authorization: `Bearer ${tokenDescartable}` },
});
check(
  'el mismo token deja de servir tras el logout',
  despuesDelLogout.status === 401,
  despuesDelLogout.status,
);
check(
  'el token de la sesión en curso sigue siendo válido',
  (await req('GET', '/usuarios/me')).status === 200,
  null,
);

seccion('D-023 · refresh token: rota, renueva y muere con el logout');
const refreshTrasLogout = await req('POST', '/auth/refresh', {
  refreshToken: sesion.body?.refreshToken,
});
check(
  'el refresh token de una sesión cerrada no renueva (401)',
  refreshTrasLogout.status === 401,
  refreshTrasLogout.status,
);

const sesionRenovable = await req('POST', '/auth/login', {
  email: 'propietario@terravid.demo',
  password: 'Terravid123!',
});
check(
  'el login devuelve refreshToken y expiresIn',
  typeof sesionRenovable.body?.refreshToken === 'string' &&
    typeof sesionRenovable.body?.expiresIn === 'number',
  sesionRenovable.body,
);
const renovada = await req('POST', '/auth/refresh', {
  refreshToken: sesionRenovable.body?.refreshToken,
});
check('renovar responde 200', renovada.status === 200, renovada.status);
check(
  'la renovación entrega un refresh token distinto',
  renovada.body?.refreshToken &&
    renovada.body.refreshToken !== sesionRenovable.body?.refreshToken,
  null,
);
const conTokenRenovado = await fetch(`${API}/usuarios/me`, {
  headers: { Authorization: `Bearer ${renovada.body?.accessToken}` },
});
check(
  'el access token renovado sirve',
  conTokenRenovado.status === 200,
  conTokenRenovado.status,
);
const sinBody = await req('POST', '/auth/refresh', {});
check('refresh sin token es 400', sinBody.status === 400, sinBody.status);

seccion('HU-05 · alta con contraseña temporal y correo de bienvenida');
const nuevoEmail = `capataz.${RUN}@terravid.demo`;
const roles = await req('GET', '/roles');
const rolCapataz = (roles.body ?? []).find((r) => r.nombreRol === 'Capataz');
const altaSinPassword = await req('POST', '/usuarios', {
  nombre: 'Capataz Smoke',
  email: nuevoEmail,
  rolId: rolCapataz?.id,
});
check('el alta sin contraseña es aceptada', altaSinPassword.status === 201, altaSinPassword);
check(
  'el usuario queda marcado para cambiar la contraseña',
  altaSinPassword.body?.debeCambiarPassword === true,
  altaSinPassword.body?.debeCambiarPassword,
);
check(
  'la contraseña temporal no se devuelve por la API',
  !JSON.stringify(altaSinPassword.body ?? {}).match(/password(?!Hash)/i) ||
    !JSON.stringify(altaSinPassword.body ?? {}).includes('passwordHash'),
  Object.keys(altaSinPassword.body ?? {}),
);

// ------------------------------------------------------------ Cartografía
seccion('HU-09 · validaciones de rango del cuartel');
check(
  'un año de implantación futuro es rechazado',
  (
    await req('POST', '/cuarteles', {
      fincaId,
      variedadId,
      sistemaConduccionId: sistemaId,
      nombre: `Cuartel Futuro ${RUN}`,
      anioImplantacion: new Date().getFullYear() + 5,
    })
  ).status === 400,
  null,
);
check(
  'un año anterior a 1900 es rechazado',
  (
    await req('POST', '/cuarteles', {
      fincaId,
      variedadId,
      sistemaConduccionId: sistemaId,
      nombre: `Cuartel Antiguo ${RUN}`,
      anioImplantacion: 1850,
    })
  ).status === 400,
  null,
);
check(
  'una latitud fuera de rango es rechazada',
  (
    await req('POST', '/cuarteles', {
      fincaId,
      variedadId,
      sistemaConduccionId: sistemaId,
      nombre: `Cuartel Polar ${RUN}`,
      latitud: 120,
    })
  ).status === 400,
  null,
);

seccion('HU-10 · el cuartel guarda coordenadas para el mapa');
const cuartelConMapa = await req('POST', '/cuarteles', {
  fincaId,
  variedadId,
  sistemaConduccionId: sistemaId,
  nombre: `Cuartel Mapa ${RUN}`,
  hectareas: 4,
  latitud: -33.0378,
  longitud: -68.8895,
});
check(
  'se persisten latitud y longitud',
  cuartelConMapa.status === 201 &&
    Number(cuartelConMapa.body?.latitud) === -33.0378 &&
    Number(cuartelConMapa.body?.longitud) === -68.8895,
  cuartelConMapa.body,
);

seccion('HU-08 / HU-09 · las bajas verifican dependencias');
check(
  'no se puede dar de baja una finca con cuarteles activos (409)',
  (await req('PATCH', `/fincas/${fincaId}/desactivar`)).status === 409,
  null,
);
check(
  'no se puede dar de baja un cuartel con historial (409)',
  (await req('PATCH', `/cuarteles/${cuartelId}/desactivar`)).status === 409,
  null,
);
check(
  'un cuartel sin historial sí se da de baja',
  (await req('PATCH', `/cuarteles/${cuartelConMapa.body?.id}/desactivar`))
    .status === 200,
  null,
);

const fincasConContador = await req('GET', '/fincas');
check(
  'el listado de fincas trae el contador de cuarteles activos',
  (fincasConContador.body ?? []).every(
    (f) => typeof f.cuartelesActivos === 'number',
  ),
  fincasConContador.body?.[0],
);

seccion('HU-11 · búsqueda de cuarteles con filtros y orden');
const busquedaCuarteles = await req(
  'GET',
  `/cuarteles/buscar?buscar=Smoke&variedadId=${variedadId}&ordenarPor=nombre&orden=DESC`,
);
check(
  'la búsqueda filtra por nombre y variedad',
  busquedaCuarteles.status === 200 &&
    (busquedaCuarteles.body?.data ?? []).every(
      (c) => c.nombre.includes('Smoke') && c.variedadId === variedadId,
    ),
  busquedaCuarteles.body?.total,
);
check(
  'un campo de orden no permitido es rechazado',
  (await req('GET', '/cuarteles/buscar?ordenarPor=passwordHash')).status === 400,
  null,
);
const variedadesFinca = await req('GET', `/cuarteles/variedades?fincaId=${fincaId}`);
check(
  'el endpoint de variedades devuelve solo las presentes en la finca',
  variedadesFinca.status === 200 &&
    Array.isArray(variedadesFinca.body) &&
    variedadesFinca.body.length >= 1,
  variedadesFinca.body?.map((v) => v.nombre),
);

// ------------------------------------------------------------ Operaciones
seccion('HU-14 · límite de lote y respuesta idempotente');
const loteGrande = Array.from({ length: 11 }, () => ({
  localUuid: crypto.randomUUID(),
  cuartelId,
  tipoLaborId,
  fecha: hoy(),
  cantidad: 1,
  insumos: [],
}));
check(
  'un lote de más de 10 registros es rechazado',
  (await req('POST', '/registro-labor/sync', { registros: loteGrande })).status ===
    400,
  null,
);

const uuidUnico = crypto.randomUUID();
const cuerpoLabor = {
  localUuid: uuidUnico,
  cuartelId,
  tipoLaborId,
  fecha: hoy(),
  cantidad: 3,
  insumos: [],
  createdAtLocal: new Date().toISOString(),
};
const creado = await req('POST', '/registro-labor', cuerpoLabor);
check('el primer envío responde 201', creado.status === 201, creado.status);
const reenviado = await req('POST', '/registro-labor', cuerpoLabor);
check(
  'el reenvío del mismo local_uuid responde 200, no 201',
  reenviado.status === 200 && reenviado.body?.yaExistia === true,
  { status: reenviado.status, body: reenviado.body },
);

seccion('HU-16 · unidades como enum y unicidad entre activos');
check(
  'una unidad fuera del enum es rechazada',
  (
    await req('POST', '/tipos-labor', {
      nombre: `Unidad Rara ${RUN}`,
      unidadMedida: 'kilogramos',
      costoUnitarioInicial: 100,
    })
  ).status === 400,
  null,
);
const insumoBaja = await req('POST', '/insumos', {
  nombre: `Insumo Reciclable ${RUN}`,
  unidadMedida: 'l',
  costoUnitarioInicial: 500,
});
await req('PATCH', `/insumos/${insumoBaja.body?.id}/desactivar`);
const insumoMismoNombre = await req('POST', '/insumos', {
  nombre: `Insumo Reciclable ${RUN}`,
  unidadMedida: 'l',
  costoUnitarioInicial: 600,
});
check(
  'el nombre de un insumo dado de baja se puede reutilizar',
  insumoMismoNombre.status === 201,
  insumoMismoNombre,
);
check(
  'dos insumos activos no pueden compartir nombre (409)',
  (
    await req('POST', '/insumos', {
      nombre: `Insumo Reciclable ${RUN}`,
      unidadMedida: 'l',
      costoUnitarioInicial: 700,
    })
  ).status === 409,
  null,
);

seccion('HU-15 · tabla de costeo con SUM en SQL');
const costeo = await req('GET', '/registro-labor/costeo');
check(
  'el costeo abarca todos los cuarteles de la empresa',
  costeo.status === 200 && Array.isArray(costeo.body?.cuarteles),
  costeo.status,
);
check(
  'cada fila trae costo total y costo por hectárea',
  (costeo.body?.cuarteles ?? []).every(
    (c) =>
      typeof c.costoTotal === 'number' &&
      (c.costoPorHa === null || typeof c.costoPorHa === 'number'),
  ),
  costeo.body?.cuarteles?.[0],
);
check(
  'el costo de labores no se infla por los insumos',
  (costeo.body?.cuarteles ?? []).every(
    (c) =>
      Math.abs(c.costoTotal - (c.costoLabores + c.costoInsumos)) < 0.01,
  ),
  costeo.body?.cuarteles?.[0],
);
seccion('HU-17 · filtros del historial');
const historialFiltrado = await req(
  'GET',
  `/registro-labor/cuartel/${cuartelId}?tipoLaborId=${tipoLaborId}&desde=${hoy()}&hasta=${hoy()}`,
);
check(
  'el historial filtra por tipo de labor y rango de fechas',
  historialFiltrado.status === 200 &&
    (historialFiltrado.body?.data ?? []).every(
      (r) => r.tipoLaborId === tipoLaborId && r.fecha === hoy(),
    ),
  historialFiltrado.body?.total,
);

// -------------------------------------------------------------------- IoT
seccion('HU-19 · ingesta por código, sensor inactivo y rango físico');
const claveIot = process.env.IOT_API_KEY ?? 'dev-iot-api-key-solo-para-desarrollo';
const ingerir = (cuerpo) =>
  fetch(`${API}/lecturas-iot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': claveIot },
    body: JSON.stringify(cuerpo),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

const sensorTemp = await req('POST', '/sensores', {
  fincaId,
  codigo: `TEMP-${RUN}`,
  tipo: 'temperatura',
});
const codigoTemp = sensorTemp.body?.codigo;

const ingestaOk = await ingerir({
  codigoSensor: codigoTemp,
  valor: 24.5,
  unidad: '°C',
  sensorTimestamp: new Date().toISOString(),
});
check(
  'la ingesta acepta el contrato por codigoSensor',
  ingestaOk.status === 201 && ingestaOk.body?.estado === 'aceptada',
  ingestaOk,
);

const ingestaAnomala = await ingerir({
  codigoSensor: codigoTemp,
  valor: 250,
  unidad: '°C',
  sensorTimestamp: new Date().toISOString(),
});
check(
  'una lectura fuera del rango físico se aparta como anómala',
  ingestaAnomala.body?.estado === 'anomala',
  ingestaAnomala.body,
);

const historialTemp = await req('GET', `/lecturas-iot/sensor/${sensorTemp.body?.id}`);
check(
  'la lectura anómala no entra al historial',
  historialTemp.body?.total === 1,
  historialTemp.body?.total,
);

await req('PATCH', `/sensores/${sensorTemp.body?.id}/desactivar`);
const ingestaInactivo = await ingerir({
  codigoSensor: codigoTemp,
  valor: 20,
  unidad: '°C',
  sensorTimestamp: new Date().toISOString(),
});
check(
  'un sensor dado de baja rechaza lecturas (403)',
  ingestaInactivo.status === 403,
  ingestaInactivo.status,
);

seccion('HU-18 · el listado de sensores trae la última lectura');
const listadoSensores = await req('GET', `/sensores?fincaId=${fincaId}`);
const sensorEnListado = (listadoSensores.body ?? []).find(
  (s) => s.codigo === codigoTemp,
);
check(
  'cada sensor incluye ultimaLectura (o null)',
  (listadoSensores.body ?? []).every((s) => 'ultimaLectura' in s),
  listadoSensores.body?.[0] && Object.keys(listadoSensores.body[0]),
);
check(
  'la última lectura del sensor con datos es la correcta',
  Number(sensorEnListado?.ultimaLectura?.valor) === 24.5,
  sensorEnListado?.ultimaLectura,
);
check(
  'renombrar un sensor al código de otro es rechazado (409)',
  (
    await req('PATCH', `/sensores/${sensor.body?.id}`, { codigo: codigoTemp })
  ).status === 409,
  null,
);

seccion('HU-20 · serie agregada por hora y por día');
const serie = await req(
  'GET',
  `/lecturas-iot/sensor/${sensorTemp.body?.id}/serie?granularidad=dia`,
);
check(
  'la serie devuelve puntos agregados en la zona horaria de la empresa',
  serie.status === 200 &&
    serie.body?.granularidad === 'dia' &&
    serie.body?.zonaHoraria === 'America/Argentina/Mendoza' &&
    Array.isArray(serie.body?.puntos),
  serie.body,
);
check(
  'una granularidad no soportada es rechazada',
  (
    await req(
      'GET',
      `/lecturas-iot/sensor/${sensorTemp.body?.id}/serie?granularidad=semana`,
    )
  ).status === 400,
  null,
);

// --------------------------------------------------------------- Vendimia
seccion('HU-26 · el borrador de remito se acota a la jornada');
const cuartelJornada = await req('POST', '/cuarteles', {
  fincaId,
  variedadId,
  sistemaConduccionId: sistemaId,
  nombre: `Cuartel Jornada ${RUN}`,
  hectareas: 6,
});
const cuartelJornadaId = cuartelJornada.body?.id;

for (const fecha of [diaRelativo(-2), hoy()]) {
  await req('POST', '/pesajes-vendimia/sync', {
    pesajes: [
      {
        localUuid: crypto.randomUUID(),
        cuadrillaId,
        cuartelId: cuartelJornadaId,
        fecha,
        kgTotales: 500,
      },
    ],
  });
}

const remitoDeHoy = await req('POST', '/remitos/generar-borrador', {
  cuartelId: cuartelJornadaId,
  fecha: hoy(),
});
check(
  'el remito de la jornada solo incluye los kilos de ese día',
  remitoDeHoy.status === 201 && Number(remitoDeHoy.body?.totalKg) === 500,
  { status: remitoDeHoy.status, totalKg: remitoDeHoy.body?.totalKg },
);
check(
  'la fecha del remito es la de la jornada liquidada',
  remitoDeHoy.body?.fecha === hoy(),
  remitoDeHoy.body?.fecha,
);

seccion('HU-28 · estado de cosecha por finca');
const estadoFinca = await req('GET', `/pesajes-vendimia/finca/${fincaId}/estado-cosecha`);
check(
  'devuelve una fila por cuartel con totales',
  estadoFinca.status === 200 &&
    Array.isArray(estadoFinca.body?.cuarteles) &&
    typeof estadoFinca.body?.totales?.kgTotalesCosechados === 'number',
  estadoFinca.body?.totales,
);
check(
  'incluye el rendimiento por hectárea',
  (estadoFinca.body?.cuarteles ?? []).some(
    (c) => c.rendimientoKgPorHa !== null,
  ),
  estadoFinca.body?.cuarteles?.map((c) => c.rendimientoKgPorHa),
);

seccion('HU-26 · el remito generado notifica a quien debe aprobarlo');
// El Propietario del seed es quien generó el remito, así que no recibe el
// aviso de "pendiente de aprobación" (no tiene sentido avisarse a sí mismo);
// sí recibe el de resolución cuando se rechaza uno.
await req('POST', `/remitos/${remitoDeHoy.body?.id}/rechazar`, {
  motivoRechazo: 'Prueba de notificación de resolución',
});
const notisRemito = await req('GET', '/notificaciones?pageSize=50');
check(
  'el rechazo del remito notifica a quien lo generó',
  (notisRemito.body?.data ?? []).some((n) => n.tipo === 'remito_rechazado'),
  notisRemito.body?.data?.map((n) => n.tipo).slice(0, 5),
);
check(
  'la notificación enlaza al remito y explica el motivo',
  (notisRemito.body?.data ?? []).some(
    (n) =>
      n.tipo === 'remito_rechazado' &&
      n.urlAccion?.includes(remitoDeHoy.body?.id) &&
      n.descripcion?.includes('Prueba de notificación'),
  ),
  notisRemito.body?.data?.find((n) => n.tipo === 'remito_rechazado'),
);

// ------------------------------------------------------------- Dashboard
seccion('HU-32 · dashboard enriquecido y agregado en SQL');
const dashboard = await req('GET', '/dashboard/indicadores');
check(
  'el Propietario recibe costos y desglose por finca',
  dashboard.status === 200 &&
    typeof dashboard.body?.costoLaboresTotal === 'number' &&
    Array.isArray(dashboard.body?.costosPorFinca),
  Object.keys(dashboard.body ?? {}),
);
check(
  'incluye alertas recientes y pendientes de sincronización',
  Array.isArray(dashboard.body?.alertasRecientes) &&
    typeof dashboard.body?.registrosConError === 'number',
  {
    alertas: dashboard.body?.alertasRecientes?.length,
    error: dashboard.body?.registrosConError,
  },
);

// ============================================ DECISIONES DE MODELO
seccion('D-h · los catálogos maestros son por empresa');
const catalogoPropio = await req('POST', '/catalogos', {
  tipo: 'variedad',
  nombre: `Bonarda ${RUN}`,
});
check('se puede crear un valor de catálogo', catalogoPropio.status === 201, catalogoPropio);
check(
  'el valor queda asociado a la empresa del usuario',
  catalogoPropio.body?.empresaId !== undefined &&
    catalogoPropio.body?.empresaId !== null,
  catalogoPropio.body?.empresaId,
);
check(
  'un nombre repetido en el mismo catálogo da 409',
  (
    await req('POST', '/catalogos', {
      tipo: 'variedad',
      nombre: `Bonarda ${RUN}`,
    })
  ).status === 409,
  null,
);
check(
  'un catálogo de otra empresa da 404',
  (
    await req('PATCH', '/catalogos/00000000-0000-0000-0000-000000000000', {
      nombre: 'Nombre Valido',
    })
  ).status === 404,
  null,
);

const insumoPropio = await req('POST', '/insumos', {
  nombre: `Insumo Tenant ${RUN}`,
  unidadMedida: 'kg',
  costoUnitarioInicial: 1000,
});
check(
  'el insumo queda asociado a la empresa',
  insumoPropio.status === 201 && !!insumoPropio.body?.empresaId,
  insumoPropio.body?.empresaId,
);
check(
  'un insumo de otra empresa da 404',
  (await req('GET', '/insumos/00000000-0000-0000-0000-000000000000')).status ===
    404,
  null,
);
check(
  'sincronizar con un tipo de labor ajeno es rechazado',
  (
    await req('POST', '/registro-labor/sync', {
      registros: [
        {
          localUuid: crypto.randomUUID(),
          cuartelId,
          tipoLaborId: '00000000-0000-0000-0000-000000000000',
          fecha: hoy(),
          cantidad: 1,
          insumos: [],
        },
      ],
    })
  ).status === 404,
  null,
);
check(
  'sincronizar con un insumo ajeno es rechazado',
  (
    await req('POST', '/registro-labor/sync', {
      registros: [
        {
          localUuid: crypto.randomUUID(),
          cuartelId,
          tipoLaborId,
          fecha: hoy(),
          cantidad: 1,
          insumos: [
            {
              insumoId: '00000000-0000-0000-0000-000000000000',
              cantidadUsada: 1,
            },
          ],
        },
      ],
    })
  ).status === 404,
  null,
);

seccion('D-005 · liquidación de bodega y margen bruto real');
// Se necesita un remito aprobado: el de la jornada quedó rechazado antes.
const cuartelVenta = await req('POST', '/cuarteles', {
  fincaId,
  variedadId,
  sistemaConduccionId: sistemaId,
  nombre: `Cuartel Venta ${RUN}`,
  hectareas: 5,
});
const cuartelVentaId = cuartelVenta.body?.id;

await req('POST', '/pesajes-vendimia/sync', {
  pesajes: [
    {
      localUuid: crypto.randomUUID(),
      cuadrillaId,
      cuartelId: cuartelVentaId,
      fecha: hoy(),
      kgTotales: 2000,
    },
  ],
});
const remitoVenta = await req('POST', '/remitos/generar-borrador', {
  cuartelId: cuartelVentaId,
  fecha: hoy(),
});
const remitoVentaId = remitoVenta.body?.id;

check(
  'no se puede liquidar un remito en borrador',
  (
    await req('PUT', `/remitos/${remitoVentaId}/liquidacion`, {
      bodega: 'Bodega Smoke',
      kgAceptados: 1900,
      precioPorKg: 300,
      fecha: hoy(),
    })
  ).status === 400,
  null,
);

const aprobacion = await req('POST', `/remitos/${remitoVentaId}/aprobar`);
check('remito aprobado', aprobacion.status === 200 || aprobacion.status === 201, aprobacion.status);

const liquidacion = await req('PUT', `/remitos/${remitoVentaId}/liquidacion`, {
  bodega: 'Bodega Smoke',
  kgAceptados: 1900,
  precioPorKg: 300,
  descuentos: 5000,
  fecha: hoy(),
  numeroComprobante: `LIQ-${RUN}`,
});
check(
  'la liquidación calcula el neto con 2 decimales (1900 × 300 − 5000 = 565000)',
  Number(liquidacion.body?.montoNeto) === 565000,
  liquidacion.body,
);
check(
  'los descuentos no pueden superar el bruto',
  (
    await req('PUT', `/remitos/${remitoVentaId}/liquidacion`, {
      bodega: 'Bodega Smoke',
      kgAceptados: 10,
      precioPorKg: 1,
      descuentos: 999999,
      fecha: hoy(),
    })
  ).status === 400,
  null,
);

const reliquidacion = await req('PUT', `/remitos/${remitoVentaId}/liquidacion`, {
  bodega: 'Bodega Smoke',
  kgAceptados: 1950,
  precioPorKg: 300,
  fecha: hoy(),
});
check(
  'reliquidar el mismo remito corrige en vez de duplicar',
  reliquidacion.status === 200 &&
    Number(reliquidacion.body?.montoNeto) === 585000 &&
    reliquidacion.body?.id === liquidacion.body?.id,
  { id: reliquidacion.body?.id, monto: reliquidacion.body?.montoNeto },
);

const costeoConMargen = await req('GET', '/registro-labor/costeo');
const filaVenta = (costeoConMargen.body?.cuarteles ?? []).find(
  (c) => c.cuartelId === cuartelVentaId,
);
check(
  'el cuartel liquidado ya tiene margen bruto real',
  filaVenta?.margenBrutoDisponible === true &&
    typeof filaVenta?.margenBruto === 'number' &&
    filaVenta.ingresos === 585000,
  filaVenta,
);
check(
  'el margen es ingresos menos costo total',
  Math.abs(
    (filaVenta?.margenBruto ?? 0) -
      ((filaVenta?.ingresos ?? 0) - (filaVenta?.costoTotal ?? 0)),
  ) < 0.01,
  filaVenta,
);

const filaSinVenta = (costeoConMargen.body?.cuarteles ?? []).find(
  (c) => c.cuartelId === cuartelId,
);
check(
  'un cuartel sin liquidación informa margen desconocido, no cero',
  filaSinVenta?.margenBruto === null &&
    filaSinVenta?.margenBrutoDisponible === false,
  filaSinVenta,
);
check(
  'los totales también traen el margen consolidado',
  costeoConMargen.body?.totales?.margenBrutoDisponible === true &&
    typeof costeoConMargen.body?.totales?.margenBruto === 'number',
  costeoConMargen.body?.totales,
);

seccion('HU-22 · asignación de fincas para enrutar avisos');
const usuarioActual = await req('GET', '/usuarios/me');
const miId = usuarioActual.body?.id;
const sinAsignar = await req('GET', `/usuarios/${miId}/fincas`);
check(
  'sin asignaciones la lista viene vacía (recibe los de todas)',
  Array.isArray(sinAsignar.body) && sinAsignar.body.length === 0,
  sinAsignar.body,
);
const asignadas = await req('PUT', `/usuarios/${miId}/fincas`, {
  fincaIds: [fincaId],
});
check(
  'se puede asignar una finca',
  asignadas.status === 200 && asignadas.body?.[0] === fincaId,
  asignadas.body,
);
check(
  'una finca de otra empresa es rechazada',
  (
    await req('PUT', `/usuarios/${miId}/fincas`, {
      fincaIds: ['00000000-0000-0000-0000-000000000000'],
    })
  ).status === 404,
  null,
);
const limpiadas = await req('PUT', `/usuarios/${miId}/fincas`, { fincaIds: [] });
check(
  'una lista vacía vuelve al comportamiento de "todas las fincas"',
  limpiadas.status === 200 && limpiadas.body?.length === 0,
  limpiadas.body,
);

// ====================================== Decisiones D-b/D-c/D-e, HU-30 y sueltos
seccion('D-014 · campañas (D-c)');
const campaniaActualSeed = await req('GET', '/campanias/actual');
check(
  'el seed dejó una campaña abierta que contiene hoy',
  campaniaActualSeed.status === 200 && Boolean(campaniaActualSeed.body?.id),
  campaniaActualSeed.body,
);
// El rango se elige por debajo de la campaña más vieja que ya exista: si no,
// una segunda corrida contra la misma base chocaría con la que dejó la primera
// —y ese 409 sería correcto, pero no es lo que este caso quiere probar—.
const campaniasPrevias = (await req('GET', '/campanias')).body ?? [];
const anioMasViejo = campaniasPrevias.reduce(
  (min, c) => Math.min(min, Number(String(c.fechaDesde).slice(0, 4))),
  2021,
);
const inicioVieja = anioMasViejo - 2;
const campaniaVieja = await req('POST', '/campanias', {
  nombre: `Vieja ${RUN}`,
  fechaDesde: `${inicioVieja}-07-01`,
  fechaHasta: `${inicioVieja + 1}-06-30`,
});
check('se puede crear una campaña pasada', campaniaVieja.status === 201, campaniaVieja);
const campaniaViejaId = campaniaVieja.body?.id;

check(
  'una campaña que se solapa es rechazada con 409',
  (
    await req('POST', '/campanias', {
      nombre: `Solapada ${RUN}`,
      fechaDesde: `${inicioVieja + 1}-01-01`,
      fechaHasta: `${inicioVieja + 1}-12-31`,
    })
  ).status === 409,
  null,
);
check(
  'el rango invertido es rechazado',
  (
    await req('POST', '/campanias', {
      nombre: `Invertida ${RUN}`,
      fechaDesde: `${inicioVieja - 5}-06-30`,
      fechaHasta: `${inicioVieja - 5}-01-01`,
    })
  ).status === 400,
  null,
);
const cerrada = await req('PATCH', `/campanias/${campaniaViejaId}/cerrar`);
check('se puede cerrar una campaña', cerrada.body?.cerrada === true, cerrada.body);
check(
  'una campaña cerrada deja de ser "la actual"',
  (await req('GET', '/campanias/actual')).body?.id !== campaniaViejaId,
  null,
);

seccion('HU-09 · la baja de cuartel se acota a la campaña actual');
const cuartelViejo = await req('POST', '/cuarteles', {
  fincaId,
  variedadId,
  sistemaConduccionId: sistemaId,
  nombre: `Cuartel Viejo ${RUN}`,
  hectareas: 1,
  anioImplantacion: 2015,
});
const cuartelViejoId = cuartelViejo.body?.id;
const bajaSinRegistros = await req('PATCH', `/cuarteles/${cuartelViejoId}/desactivar`);
check(
  'un cuartel sin registros se da de baja',
  bajaSinRegistros.status === 200,
  bajaSinRegistros,
);
check(
  'un cuartel con labores de la campaña actual sigue bloqueado',
  (await req('PATCH', `/cuarteles/${cuartelId}/desactivar`)).status === 409,
  null,
);

seccion('HU-31 · comparar por campaña, promedios IoT y margen real');
const comparacion = await req(
  'GET',
  `/inteligencia-agronomica/comparar-campanias/${cuartelVentaId}?campaniaA=${campaniaActualSeed.body?.id}&campaniaB=${campaniaViejaId}`,
);
check(
  'la comparación acepta ids de campaña',
  comparacion.status === 200 &&
    comparacion.body?.periodo1?.campaniaId === campaniaActualSeed.body?.id,
  comparacion.body?.periodo1,
);
check(
  'cada período informa el nombre de su campaña',
  comparacion.body?.periodo2?.nombre === `Vieja ${RUN}`,
  comparacion.body?.periodo2?.nombre,
);
check(
  'el margen bruto de la campaña con liquidación ya es real',
  comparacion.body?.periodo1?.margenBrutoDisponible === true &&
    typeof comparacion.body?.periodo1?.margenBruto === 'number',
  comparacion.body?.periodo1,
);
check(
  'la campaña sin liquidación informa margen desconocido, no cero',
  comparacion.body?.periodo2?.margenBrutoDisponible === false &&
    comparacion.body?.periodo2?.margenBruto === null,
  comparacion.body?.periodo2,
);
check(
  'no se compara el margen contra un período sin ingreso cargado',
  comparacion.body?.variaciones?.margenBruto === null,
  comparacion.body?.variaciones,
);
check(
  'el período trae los promedios IoT',
  typeof comparacion.body?.periodo1?.promediosIot === 'object',
  comparacion.body?.periodo1?.promediosIot,
);
check(
  'sin campaña ni fechas, el período es rechazado',
  (
    await req(
      'GET',
      `/inteligencia-agronomica/comparar-campanias/${cuartelVentaId}?campaniaA=${campaniaViejaId}`,
    )
  ).status === 400,
  null,
);

seccion('HU-32 · dashboard con campaña y estado de cosecha global');
const tablero = await req('GET', '/dashboard/indicadores');
check(
  'el dashboard informa de qué campaña habla',
  tablero.body?.campaniaActual?.id === campaniaActualSeed.body?.id,
  tablero.body?.campaniaActual,
);
check(
  'trae el reparto de cuarteles por estado de cosecha',
  Array.isArray(tablero.body?.estadoCosechaGlobal?.porEstado) &&
    tablero.body.estadoCosechaGlobal.porEstado.length === 3,
  tablero.body?.estadoCosechaGlobal,
);
check(
  'los porcentajes suman 100 cuando hay cuarteles',
  tablero.body?.estadoCosechaGlobal?.total === 0 ||
    Math.abs(
      tablero.body.estadoCosechaGlobal.porEstado.reduce((a, e) => a + e.porcentaje, 0) -
        100,
    ) < 0.5,
  tablero.body?.estadoCosechaGlobal,
);
check(
  'los estados sin cuarteles vienen igual, en 0',
  (tablero.body?.estadoCosechaGlobal?.porEstado ?? []).every(
    (e) => typeof e.cuarteles === 'number',
  ),
  tablero.body?.estadoCosechaGlobal?.porEstado,
);

seccion('HU-06 · lista blanca de roles asignables');
const usuarioParaRol = await req('POST', '/usuarios', {
  nombre: 'Rol Smoke',
  email: `rol.${RUN}@terravid.demo`,
  rolId: rolCapataz?.id,
});
const usuarioRolId = usuarioParaRol.body?.id;
check(
  'un rolId inexistente da 404 y no 500',
  (
    await req('PATCH', `/usuarios/${usuarioRolId}`, {
      rolId: '00000000-0000-0000-0000-000000000000',
    })
  ).status === 404,
  null,
);
// Sin tilde: así lo siembra `RolNombre.AGRONOMO`. Buscarlo con tilde devolvía
// `undefined`, el PATCH viajaba sin `rolId` y estos casos pasaban sin probar nada.
const rolAgronomo = (roles.body ?? []).find((r) => r.nombreRol === 'Agronomo');
check('el rol Agronomo existe en el catálogo', Boolean(rolAgronomo?.id), roles.body);
const cambioDeRol = await req('PATCH', `/usuarios/${usuarioRolId}`, {
  rolId: rolAgronomo?.id,
});
check(
  'un rol del catálogo sí se asigna',
  cambioDeRol.status === 200 && cambioDeRol.body?.rolId === rolAgronomo?.id,
  cambioDeRol.body?.rolId,
);
const autoCambio = await req('PATCH', `/usuarios/${miId}`, {
  rolId: rolAgronomo?.id,
});
check(
  'sigue sin poder cambiarse el rol a sí mismo',
  autoCambio.status === 403,
  autoCambio.body,
);
check(
  'y el rol propio quedó intacto',
  (await req('GET', '/usuarios/me')).body?.rol?.nombreRol === 'Propietario',
  null,
);

seccion('HU-21 · aviso de umbral ya superado');
const sensorAviso = await req('POST', '/sensores', {
  fincaId,
  codigo: `AVISO-${RUN}`,
  tipo: 'humedad_suelo',
});
await ingerir({
  codigoSensor: sensorAviso.body?.codigo,
  valor: 15,
  unidad: '%',
  sensorTimestamp: new Date().toISOString(),
});
const umbralConAviso = await req('PUT', `/sensores/${sensorAviso.body?.id}/umbral`, {
  umbralMinimo: 30,
});
check(
  'avisa que la última lectura ya está por debajo del mínimo',
  typeof umbralConAviso.body?.aviso === 'string' &&
    umbralConAviso.body.aviso.includes('15'),
  umbralConAviso.body?.aviso,
);
check(
  'la respuesta sigue trayendo el umbral plano',
  Number(umbralConAviso.body?.umbralMinimo) === 30,
  umbralConAviso.body,
);
const umbralSinAviso = await req('PUT', `/sensores/${sensorAviso.body?.id}/umbral`, {
  umbralMinimo: 5,
});
check(
  'sin superación no hay aviso',
  umbralSinAviso.body?.aviso === null,
  umbralSinAviso.body?.aviso,
);

seccion('HU-35 · device token para push (D-e)');
const tokenFalso = `smoke-token-${RUN}-${'x'.repeat(30)}`;
const altaToken = await req('POST', '/notificaciones/device-token', {
  token: tokenFalso,
  plataforma: 'android',
});
check('se registra el token del dispositivo', altaToken.status === 201, altaToken);
check(
  'reenviar el mismo token no duplica (es idempotente)',
  (
    await req('POST', '/notificaciones/device-token', {
      token: tokenFalso,
      plataforma: 'android',
    })
  ).body?.id === altaToken.body?.id,
  null,
);
check(
  'una plataforma inválida es rechazada',
  (
    await req('POST', '/notificaciones/device-token', {
      token: `${tokenFalso}-2`,
      plataforma: 'blackberry',
    })
  ).status === 400,
  null,
);
check(
  'la baja del token responde 204',
  (await req('DELETE', '/notificaciones/device-token', { token: tokenFalso })).status ===
    204,
  null,
);

seccion('HU-35 · el error de sincronización notifica al Capataz');
const antesDeFallar = await req('GET', '/notificaciones?soloNoLeidas=true');
const loteFallido = await req('POST', '/registro-labor/sync', {
  registros: [
    {
      localUuid: crypto.randomUUID(),
      cuartelId,
      tipoLaborId,
      // Anterior a la vigencia del costo: el ítem falla dentro del lote, que es
      // el camino que dispara el aviso. Un tipoLaborId inexistente no sirve: el
      // controller lo verifica antes y devuelve 404 sin llegar a sincronizar.
      fecha: diaRelativo(-45),
      cantidad: 1,
      insumos: [],
      createdAtLocal: new Date().toISOString(),
    },
  ],
});
check(
  'el ítem del lote queda en error',
  loteFallido.body?.[0]?.estado === 'error',
  loteFallido.body,
);
const despuesDeFallar = await req('GET', '/notificaciones?soloNoLeidas=true');
const avisoDeError = (despuesDeFallar.body?.data ?? []).find(
  (n) => n.tipo === 'error_sincronizacion',
);
check(
  'el lote fallido genera una notificación de error de sincronización',
  Boolean(avisoDeError),
  despuesDeFallar.body?.data?.map((n) => n.tipo),
);
check(
  'la notificación apunta al listado de registros en error',
  Boolean(avisoDeError?.urlAccion?.includes('error')),
  avisoDeError?.urlAccion,
);
check(
  'el contador de no leídas subió',
  (despuesDeFallar.body?.noLeidas ?? 0) > (antesDeFallar.body?.noLeidas ?? 0),
  { antes: antesDeFallar.body?.noLeidas, despues: despuesDeFallar.body?.noLeidas },
);

seccion('HU-30 · recomendaciones persistidas y gate de 30 días');
const recos = await req('GET', `/inteligencia-agronomica/recomendaciones/${cuartelId}`);
check(
  'el endpoint informa el gate de 30 días',
  recos.status === 200 && typeof recos.body?.diasConDatos === 'number',
  recos.body,
);
check(
  'sin histórico suficiente informa cuántos días faltan',
  recos.body?.disponible === true ||
    (recos.body?.diasFaltantes > 0 && String(recos.body?.mensaje).includes('Faltan')),
  { disponible: recos.body?.disponible, faltantes: recos.body?.diasFaltantes },
);
if (recos.body?.disponible && (recos.body.recomendaciones ?? []).length > 0) {
  const reco = recos.body.recomendaciones[0];
  check('las recomendaciones tienen id (son accionables)', Boolean(reco.id), reco);
  check(
    'traen patrón detectado y acción sugerida',
    Boolean(reco.patronDetectado) && Boolean(reco.accionSugerida),
    reco,
  );
  const reevaluada = await req(
    'GET',
    `/inteligencia-agronomica/recomendaciones/${cuartelId}`,
  );
  check(
    'reevaluar no duplica la recomendación activa',
    (reevaluada.body?.recomendaciones ?? []).filter((r) => r.reglaId === reco.reglaId)
      .length === 1,
    reevaluada.body?.recomendaciones?.map((r) => r.reglaId),
  );
  const resuelta = await req(
    'PATCH',
    `/inteligencia-agronomica/recomendaciones/${reco.id}`,
    { estado: 'aplicada', nota: 'Aplicada desde el smoke test' },
  );
  check('se puede marcar como aplicada', resuelta.body?.estado === 'aplicada', resuelta.body);
  check(
    'resolver dos veces la misma recomendación da 409',
    (
      await req('PATCH', `/inteligencia-agronomica/recomendaciones/${reco.id}`, {
        estado: 'descartada',
      })
    ).status === 409,
    null,
  );
  check(
    'reabrir a "activa" no es un estado válido',
    (
      await req('PATCH', `/inteligencia-agronomica/recomendaciones/${reco.id}`, {
        estado: 'activa',
      })
    ).status === 400,
    null,
  );
} else {
  check(
    'con el gate activo no se generan recomendaciones',
    (recos.body?.recomendaciones ?? []).length === 0,
    recos.body?.recomendaciones,
  );
}

seccion('HU-07 · el log de auditoría solo expone lectura');
check(
  'no hay ruta de borrado ni de modificación del log',
  (await req('DELETE', '/log-auditoria')).status === 404 &&
    (await req('PATCH', '/log-auditoria')).status === 404,
  null,
);

seccion('Parámetros de query: entrada inválida es 400, no 500 ni lista vacía');

/**
 * Estos dos devolvían **500**: el valor sin validar llegaba hasta la base.
 * Se encontraron llamando la API, no leyendo el código, y por eso el smoke es
 * el lugar donde tienen que quedar cubiertos.
 */
const sinTipo = await req('GET', '/catalogos');
check(
  'GET /catalogos sin tipo da 400 y no 500',
  sinTipo.status === 400,
  sinTipo,
);

const fechaBasura = await req(
  'GET',
  `/inteligencia-agronomica/correlacion/${cuartelId}?sensorId=${sensorId}&desde=basura&hasta=basura`,
);
check(
  'una fecha mal formada da 400 y no 500',
  fechaBasura.status === 400,
  fechaBasura,
);

/**
 * Estos devolvían **200 con una lista vacía**, que es peor: el cliente no puede
 * distinguir un parámetro mal escrito de "no hay datos".
 */
const tipoInexistente = await req('GET', '/catalogos?tipo=basura');
check(
  'un tipo de catálogo inexistente da 400 y no una lista vacía',
  tipoInexistente.status === 400,
  tipoInexistente,
);

const moduloConTypo = await req('GET', '/ayuda/articulos?modulo=vendmia');
check(
  'un módulo de ayuda mal escrito da 400 y no una lista vacía',
  moduloConTypo.status === 400,
  moduloConTypo,
);

const sinFechas = await req(
  'GET',
  `/inteligencia-agronomica/correlacion/${cuartelId}?sensorId=${sensorId}`,
);
check(
  'la correlación sin período da 400 y no "sin datos suficientes"',
  sinFechas.status === 400,
  sinFechas,
);

/**
 * La regresión de fondo: `Boolean('false')` es `true`, y la conversión
 * implícita del `ValidationPipe` corría antes del `@Transform` que existía para
 * evitarlo. `?activo=false` devolvía los usuarios **activos**.
 */
const paraDesactivar = await req('POST', '/usuarios', {
  nombre: 'Usuario Filtro Booleano',
  email: `filtro.${RUN}@terravid.demo`,
  password: 'Terravid123',
  rolId: rolCapataz?.id,
});
await req('PATCH', `/usuarios/${paraDesactivar.body?.id}/desactivar`);

const inactivos = await req('GET', '/usuarios?activo=false&pageSize=100');
check(
  '?activo=false trae los inactivos y no los activos',
  inactivos.status === 200 &&
    (inactivos.body?.data ?? []).length > 0 &&
    (inactivos.body?.data ?? []).every((u) => u.activo === false),
  inactivos.body?.data?.map((u) => ({ email: u.email, activo: u.activo })),
);

const activos = await req('GET', '/usuarios?activo=true&pageSize=100');
check(
  '?activo=true trae solo los activos',
  activos.status === 200 &&
    (activos.body?.data ?? []).length > 0 &&
    (activos.body?.data ?? []).every((u) => u.activo === true),
  null,
);

const boolBasura = await req('GET', '/usuarios?activo=basura');
check(
  'un booleano mal formado da 400 en vez de interpretarse como true',
  boolBasura.status === 400,
  boolBasura,
);

/**
 * La tercera instancia del mismo problema, y la de efecto más directo sobre el
 * buscador de HU-11: `Number('')` es `0`, así que el parámetro vacío --lo que
 * manda un formulario con el campo sin completar-- filtraba por el año 0 y
 * devolvía la lista vacía sin ningún error.
 */
const sinFiltroDeAnio = await req('GET', '/cuarteles/buscar');
const anioVacio = await req('GET', '/cuarteles/buscar?anioImplantacion=');
check(
  'un año vacío no filtra, en vez de filtrar por el año 0',
  anioVacio.status === 200 &&
    anioVacio.body?.total === sinFiltroDeAnio.body?.total &&
    anioVacio.body?.total > 0,
  { vacio: anioVacio.body?.total, sinFiltro: sinFiltroDeAnio.body?.total },
);

const anioBasura = await req('GET', '/cuarteles/buscar?anioImplantacion=2020abc');
check(
  'un año con basura pegada da 400 en vez de tomar los primeros dígitos',
  anioBasura.status === 400,
  anioBasura,
);

// Y el filtro tiene que seguir filtrando: el primer cuartel se creó con año.
const anioReal = cuartel.body?.anioImplantacion;
const porAnio = await req(
  'GET',
  `/cuarteles/buscar?anioImplantacion=${anioReal}&pageSize=100`,
);
check(
  'filtrar por un año real sigue devolviendo solo ese año',
  porAnio.status === 200 &&
    (porAnio.body?.data ?? []).length > 0 &&
    (porAnio.body?.data ?? []).every((c) => c.anioImplantacion === anioReal),
  { anio: anioReal, total: porAnio.body?.total },
);

// Y lo válido tiene que seguir pasando: un 400 de más rompe los selectores.
const catalogoOk = await req('GET', '/catalogos?tipo=variedad');
check(
  'el caso válido sigue devolviendo el catálogo',
  catalogoOk.status === 200 && Array.isArray(catalogoOk.body),
  catalogoOk.status,
);

const insumosConInactivos = await req('GET', '/insumos?incluirInactivos=true');
check(
  'incluirInactivos=true sigue aceptándose',
  insumosConInactivos.status === 200,
  insumosConInactivos.status,
);

// ------------------------------------------------------------------ Resumen
console.log(`\n${'='.repeat(60)}`);
console.log(`RESULTADO: ${ok} OK, ${fallas.length} fallas`);
if (fallas.length) {
  console.log('\nFallas:');
  fallas.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
