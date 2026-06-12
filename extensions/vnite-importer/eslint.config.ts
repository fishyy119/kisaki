import { defineConfig } from 'eslint/config'
import { baseConfig } from '../../eslint.config'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

/**
 * ESLint configuration for the Vnite importer extension.
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
      'vue/require-default-prop': 'off'
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
