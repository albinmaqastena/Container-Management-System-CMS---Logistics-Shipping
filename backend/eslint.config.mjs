// eslint.config.mjs

// @ts-check

import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'uploads/**',
      'eslint.config.mjs',
    ],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,

  // ============================================================
  // APPLICATION CODE
  // ============================================================
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],

    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',

      'prettier/prettier': 'error',
    },
  },

  // ============================================================
  // UNIT AND E2E TESTS
  // Jest mocks commonly use partial objects and mocked methods.
  // ============================================================
  {
    files: [
      'src/**/*.spec.ts',
      'test/**/*.ts',
      'test/**/*.e2e-spec.ts',
    ],

    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },

    rules: {
      '@typescript-eslint/unbound-method': 'off',

      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',

      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },

  // ============================================================
  // TYPEORM MIGRATIONS
  // queryRunner.query() is typed as any by TypeORM.
  // ============================================================
  {
    files: ['src/migrations/**/*.ts'],

    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
);