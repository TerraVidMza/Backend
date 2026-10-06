/**
 * Cobertura combinada de unit + e2e (D-028).
 *
 * El objetivo de la entrega es 70 % de líneas sumando los dos tipos de prueba:
 * los unitarios cubren reglas y casos borde con dependencias simuladas; los
 * e2e, el camino real contra PostgreSQL. Medirlos por separado subestima lo
 * que de verdad se ejecuta.
 *
 *     docker compose up -d db && npm run migration:run && npm run seed
 *     npm run test:cov:total
 */
// `[\\/]` porque en Windows las rutas usan barra invertida.
const ignorar = [
  /[\\/]node_modules[\\/]/,
  /\.module\.ts$/,
  // Migraciones, seeds y scripts operativos: se ejercitan al levantar la base
  // de pruebas, no desde los tests.
  /[\\/]database[\\/]/,
  /[\\/]dto[\\/]/,
  /\.entity\.ts$/,
  /main\.ts$/,
  // Configuración declarativa de Swagger: texto, no lógica.
  /openapi\.ts$/,
].map((r) => r.source);

// Con `projects`, la exclusión de cobertura es una opción de cada proyecto.
const comun = {
  coveragePathIgnorePatterns: ignorar,
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
};

module.exports = {
  rootDir: '.',
  coverageDirectory: 'coverage-total',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts'],
  coverageReporters: ['text-summary', 'json-summary', 'lcov'],
  coverageThreshold: {
    global: { lines: 70, statements: 70 },
  },
  projects: [
    {
      ...comun,
      displayName: 'unit',
      rootDir: '.',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      setupFiles: ['reflect-metadata'],
    },
    {
      ...comun,
      displayName: 'e2e',
      rootDir: '.',
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
    },
  ],
};
