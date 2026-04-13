import { createConfig } from '@lapidist/eslint-config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export default [
  ...createConfig({
    tsconfigRootDir: dirname(fileURLToPath(import.meta.url)),
    ignores: ['tests/fixtures/**']
  }),
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
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
            },
            {
              group: ['**/resolver/internal/**'],
              message: 'Import resolver internals through parser/src/resolver/index.ts.'
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
      'parser/src/session/internal/**/*.ts',
      'parser/src/resolver/**/*.ts'
    ],
    rules: {
      'no-restricted-imports': 'off'
    }
  }
];
