import { defineConfig } from 'eslint/config'
import { baseConfig } from '../../eslint.config'

export default defineConfig([
  {
    extends: [baseConfig]
  },
  {
    files: ['src/cli/actions/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'commander',
              message: 'CLI actions must remain independent from Commander.'
            }
          ],
          patterns: [
            {
              group: ['../commands/**', '../../commands/**'],
              message: 'CLI actions must not depend on command declarations.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/cli/commands/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '../../errors',
                '../../extension-input',
                '../../scaffold',
                '../../scaffold/**'
              ],
              message: 'Command declarations must call CLI actions instead of domain modules.'
            }
          ]
        }
      ]
    }
  },
  {
    files: [
      'src/extension-input.ts',
      'src/extension-options.ts',
      'src/errors.ts',
      'src/scaffold/**/*.ts'
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['./cli/**', '../cli/**', '../../cli/**'],
              message: 'Domain modules must not depend on the CLI layer.'
            }
          ]
        }
      ]
    }
  }
])
