import { defineConfig } from 'eslint/config'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

const tsconfigRootDir = toFileDirectoryPath(import.meta.url)

/**
 * Base ESLint configuration for the monorepo.
 * Package-specific configs should import and extend this,
 * and add eslint-config-prettier at the end to disable formatting rules.
 */
export const baseConfig = defineConfig([
  {
    ignores: ['**/node_modules', '**/dist', '**/out', '**/dev', '**/templates/**']
  },

  // JavaScript recommended rules
  js.configs.recommended,

  // TypeScript recommended rules
  tseslint.configs.recommended,

  // TypeScript rules
  {
    files: ['**/*.{ts,tsx,mts,vue}'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir
      }
    },
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off'
    }
  },
  // Prettier - disables all formatting rules (MUST be last)
  prettier
])

export default baseConfig

function toFileDirectoryPath(url: string): string {
  return decodeURIComponent(url)
    .replace(/^file:\/\/\/([A-Za-z]:)/, '$1')
    .replace(/^file:\/\//, '')
    .replace(/\/[^/]*$/, '')
}
