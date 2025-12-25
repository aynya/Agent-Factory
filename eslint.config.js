import tseslint from 'typescript-eslint';
import vuePlugin from 'eslint-plugin-vue';
import eslintConfigPrettier from 'eslint-config-prettier';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  // --------------------
  // Base configuration
  // --------------------
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.vscode/**',
      '**/.idea/**',
      '**/*.log',
      '**/*.tsbuildinfo',
      '**/*.d.ts',
    ],
  },
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',

      // ⭐ 关键：显式指定 tsconfigRootDir
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    },
  },

  // --------------------
  // TypeScript
  // --------------------
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  },

  // --------------------
  // Vue
  // --------------------
  ...vuePlugin.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },

  // --------------------
  // Prettier
  // --------------------
  eslintConfigPrettier,
];
