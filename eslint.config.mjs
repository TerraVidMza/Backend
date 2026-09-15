// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
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
        projectService: true,
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
