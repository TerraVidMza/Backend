// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // La config plana de ESLint no lee .gitignore: sin estas entradas, despues
    // de un `nest build` o de `npm run test:cov` analiza el JS compilado y los
    // reportes de cobertura, y la corrida pasa de 0 a miles de errores ajenos.
    ignores: ['eslint.config.mjs', 'dist/**', 'coverage*/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        // Los .js/.mjs sueltos (configuracion de jest, smoke test) no entran en
        // tsconfig.json porque no se compilan. Sin esta lista ESLint no los
        // encuentra en el proyecto y aborta el archivo con un "Parsing error",
        // que contaba como error y ademas dejaba esos archivos sin analizar.
        projectService: {
          allowDefaultProject: ['jest.cobertura.config.js', 'test/smoke.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // Las tres estaban en 'off' o 'warn' desde el scaffold de Nest. Se suben
      // a error porque el codigo hoy no las viola: `src/` no tiene una sola
      // ocurrencia de `any` explicito. El costo de adoptarlas es cero y lo que
      // evitan es la deriva cuando entren mas manos al repositorio.
      //
      // Una promesa sin await es la que mas duele de las tres: el error se
      // pierde, la operacion parece haber salido bien y el fallo aparece
      // despues y en otro lado.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },

  {
    // JavaScript plano no tiene tipos: las reglas "unsafe-*" lo marcan todo
    // como `any`. Se analizan con las reglas comunes, sin las que usan tipos.
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },

  {
    // Los tests de integracion consultan la base con SQL crudo, y
    // `DataSource.query` declara `Promise<any>`. Se tipa con genericos donde se
    // puede; donde no, exigir la regla obligaria a castear a ciegas, que es
    // menos seguro que dejarla pasar en un archivo de test.
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'warn',
    },
  },
);
