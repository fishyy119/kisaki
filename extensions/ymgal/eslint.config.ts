import { defineConfig } from 'eslint/config'
import {
  baseConfig,
  noBareStringsOptions,
  noCjkLiteralRestrictions,
  noCjkTemplateRestrictions
} from '../../eslint.config'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

/**
 * ESLint configuration for the YMGal extension.
 * Extends the base config with Vue SFC parsing for the webview UI.
 */
export default defineConfig([
  {
    extends: [baseConfig]
  },
  pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue']
      }
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      // Keep user-facing copy in the extension i18n message catalogs.
      'vue/no-restricted-syntax': ['error', ...noCjkTemplateRestrictions],
      'vue/no-bare-strings-in-template': ['error', noBareStringsOptions]
    }
  },
  // CJK copy must live in the extension i18n message catalogs. YMGal's role
  // mapping matches Chinese job titles from the source, so it is exempt.
  {
    files: ['src/**/*.{ts,vue}'],
    ignores: ['src/shared/i18n/messages/**', 'src/host/media/format/roles.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...noCjkLiteralRestrictions]
    }
  },
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
