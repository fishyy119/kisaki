import { defineConfig } from 'eslint/config'
import { baseConfig, noCjkLiteralRestrictions } from '../../eslint.config'
import prettier from 'eslint-config-prettier'

/**
 * ESLint configuration for the pHash match extension.
 * Host-only project: no webview UI, no i18n catalogs, all runtime copy is
 * log-facing English.
 */
export default defineConfig([
  {
    extends: [baseConfig]
  },
  {
    files: ['src/**/*.ts', 'tools/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...noCjkLiteralRestrictions]
    }
  },
  prettier
])
