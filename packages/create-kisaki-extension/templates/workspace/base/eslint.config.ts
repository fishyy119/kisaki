import { defineConfig, globalIgnores } from 'eslint/config'
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default defineConfig([
  globalIgnores([
    '**/node_modules',
    '**/dist',
    '**/artifacts',
    '**/.tmp',
    '**/tmp',
    '**/.kisaki',
    'extensions/**'
  ]),
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts,js,mjs}'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ]
    }
  },
  prettier
])
