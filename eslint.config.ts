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
/** Matches Han ideographs, kana, and CJK punctuation/full-width forms. */
const cjkCopyPattern =
  '[\\u3000-\\u303f\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\uff00-\\uffef]'

const cjkCopyMessage =
  'Hardcoded CJK copy is not allowed. Move user-facing text into the i18n message catalogs; ' +
  'CJK-data parsing modules need an explicit lint ignore.'

/**
 * `no-restricted-syntax` entries that reject CJK string and template literals.
 * Package configs apply these to runtime code and exempt message catalogs.
 */
export const noCjkLiteralRestrictions = [
  { selector: `Literal[value=/${cjkCopyPattern}/]`, message: cjkCopyMessage },
  { selector: `TemplateElement[value.raw=/${cjkCopyPattern}/]`, message: cjkCopyMessage }
]

/** Superset of {@link noCjkLiteralRestrictions} for Vue template bodies (`vue/no-restricted-syntax`). */
export const noCjkTemplateRestrictions = [
  ...noCjkLiteralRestrictions,
  { selector: `VText[value=/${cjkCopyPattern}/]`, message: cjkCopyMessage },
  { selector: `VLiteral[value=/${cjkCopyPattern}/]`, message: cjkCopyMessage }
]

/**
 * Options for `vue/no-bare-strings-in-template`: the rule's default symbol
 * allowlist plus locale-neutral tokens rendered as-is in templates
 * (brand names, acronyms, unit symbols, keyboard keys, protocol terms).
 */
export const noBareStringsOptions = {
  allowlist: [
    'Kisaki',
    'NSFW',
    'cm',
    'v',
    'B',
    'W',
    'H',
    'ESC',
    'Enter',
    'Ctrl F',
    '\u2191',
    '\u2193',
    'Last-Modified',
    'ETag',
    '(',
    ')',
    ',',
    '.',
    '&',
    '+',
    '-',
    '=',
    '*',
    '/',
    '#',
    '%',
    '!',
    '?',
    ':',
    '[',
    ']',
    '{',
    '}',
    '<',
    '>',
    '\u00b7',
    '\u2022',
    '\u2010',
    '\u2013',
    '\u2014',
    '\u2212',
    '|',
    '@',
    '\u2192'
  ]
}

export const baseConfig = defineConfig([
  globalIgnores([
    '**/node_modules',
    '**/dist',
    '**/out',
    '**/dev',
    '**/templates/**',
    // Vendored third-party sources keep upstream style; see their READMEs.
    '**/vendor/**'
  ]),

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
          // Prefix-only builtins (e.g. node:sqlite) appear in builtinModules
          // with their node: prefix and already comply.
          paths: builtinModules
            .filter((name) => !name.startsWith('node:'))
            .map((name) => ({
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
