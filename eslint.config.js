import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default [
  {
    ignores: ['tests/fixtures/**']
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir
      }
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs['strict-type-checked'].rules,
      ...tsPlugin.configs['stylistic-type-checked'].rules,
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }]
    }
  },
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      '@typescript-eslint/consistent-type-assertions': 'off'
    }
  },
  {
    files: ['parser/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/session/internal/**'],
              message: 'Import session APIs through parser/src/session/options.ts or runtime.ts.'
            }
          ]
        }
      ]
    }
  },
  {
    files: [
      'parser/src/session.ts',
      'parser/src/session/options.ts',
      'parser/src/session/runtime.ts',
      'parser/src/session/internal/**/*.ts'
    ],
    rules: {
      'no-restricted-imports': 'off'
    }
  }
];
