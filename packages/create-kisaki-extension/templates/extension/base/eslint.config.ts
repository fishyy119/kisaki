import { defineConfig } from 'eslint/config'
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default defineConfig([
  { ignores: ['dist/', 'artifacts/', '.kisaki/'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/host/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/ui', '**/ui/**'],
              message: 'Host code must not import webview UI modules.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/host', '**/host/**'],
              message: 'Webview UI code must not import host modules.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/shared/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/host', '**/host/**', '**/ui', '**/ui/**'],
              message: 'Shared contracts must not import host or UI modules.'
            }
          ]
        }
      ]
    }
  },
  prettier
])
