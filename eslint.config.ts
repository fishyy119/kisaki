import { builtinModules } from 'node:module'
import { defineConfig, globalIgnores } from 'eslint/config'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

/**
 * Base ESLint configuration for the monorepo.
 * Package-specific configs should import and extend this,
 * and add eslint-config-prettier at the end to disable formatting rules.
 */
export const baseConfig = defineConfig([
  globalIgnores(['**/node_modules', '**/dist', '**/out', '**/dev', '**/templates/**']),

  // JavaScript recommended rules
  js.configs.recommended,

  // TypeScript recommended rules
  tseslint.configs.recommended,

  // TypeScript rules
  {
    files: ['**/*.{ts,tsx,mts,vue}'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname
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
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // Dedicated rule id so package-level no-restricted-imports overrides
      // (import boundaries) never clobber the node: protocol enforcement.
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: builtinModules.map((name) => ({
            name,
            message: 'Import Node.js builtins with the node: protocol.'
          }))
        }
      ]
    }
  },
  // Prettier - disables all formatting rules (MUST be last)
  prettier
])

export default baseConfig
