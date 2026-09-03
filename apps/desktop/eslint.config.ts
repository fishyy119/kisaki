import { defineConfig } from 'eslint/config'
import type { Rule, Scope } from 'eslint'
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

const rendererImportBoundaryPatterns = [
  {
    group: ['@renderer/components/ui/*/*'],
    message: 'Import UI modules only from first-level boundary: @renderer/components/ui/<module>.'
  },
  {
    group: ['@renderer/components/shared/*/*'],
    message:
      'Import shared modules only from first-level boundary: @renderer/components/shared/<domain>.'
  },
  {
    group: ['@renderer/features/*/*'],
    message: 'Import features only from first-level boundary: @renderer/features/<feature>.'
  }
]

// The extension host is a separate utility-process program that is bundled on
// its own. Electron and main-process modules must never reach its bundle, and
// the main process may only speak to it through its wire protocol boundary.
const extensionHostBoundaryPatterns = [
  {
    group: ['@main', '@main/*', '@renderer', '@renderer/*', 'electron', 'electron/*'],
    message:
      'The extension host runs in its own utility process. Import only @shared, @kisaki3/extension-api, and host-local modules.'
  }
]

const mainToExtensionHostBoundaryPatterns = [
  {
    group: ['@extension-host/*', '!@extension-host/protocol'],
    message:
      'The main process may only import the extension host wire protocol: @extension-host/protocol.'
  }
]

// Tools are plain Node programs outside every app bundle. They may consume the
// pure contract layer (src/shared) but never process-owned modules.
const toolsBoundaryPatterns = [
  {
    group: [
      '**/src/main/**',
      '**/src/preload/**',
      '**/src/renderer/**',
      '**/src/extension-host/**',
      '@main/*',
      '@renderer/*',
      '@extension-host/*'
    ],
    message:
      'Tools run under plain Node and may import only src/shared contracts, not process-owned modules.'
  }
]

const exportAllRestriction = {
  selector: 'ExportAllDeclaration',
  message: 'Use explicit named exports instead of export *.'
}

// Tables the renderer may write directly: user-curation state the UI edits in
// place. Everything else — scraped ingest graphs, holdings sync-owned file
// rows, activity marks, extension state — must go through the owning
// main-process workflow. Entries are the `@shared/db` export names of the
// tables. See .agents/skills/kisaki data-layer reference.
const rendererDirectWriteTables = new Set([
  // Entity core rows and organizer rows (user field edits)
  'games',
  'animes',
  'comics',
  'novels',
  'characters',
  'persons',
  'companies',
  'tags',
  'collections',
  'showcaseSections',
  'scanners',
  'scraperProfiles',
  'settings',
  // Consumption units and their user-managed files
  'animeEpisodes',
  'animeExtras',
  'comicChapters',
  'novelVolumes',
  'comicChapterFiles',
  'novelVolumeFiles',
  // Notes and sessions
  'gameNotes',
  'animeNotes',
  'comicNotes',
  'novelNotes',
  'gameSessions',
  'animeSessions',
  'comicSessions',
  'novelSessions',
  // Relation and link rows (user curation)
  'mediaRelations',
  'companyRelations',
  'characterPersonLinks',
  'gameCharacterLinks',
  'gamePersonLinks',
  'gameCompanyLinks',
  'gameCastLinks',
  'animeCharacterLinks',
  'animePersonLinks',
  'animeCompanyLinks',
  'animeCastLinks',
  'comicCharacterLinks',
  'comicPersonLinks',
  'comicCompanyLinks',
  'novelCharacterLinks',
  'novelPersonLinks',
  'novelCompanyLinks',
  'collectionGameLinks',
  'collectionAnimeLinks',
  'collectionComicLinks',
  'collectionNovelLinks',
  'collectionCharacterLinks',
  'collectionPersonLinks',
  'collectionCompanyLinks',
  // External identity rows (user curation)
  'gameExternalIds',
  'animeExternalIds',
  'comicExternalIds',
  'novelExternalIds',
  'characterExternalIds',
  'personExternalIds',
  'companyExternalIds'
])

/**
 * Renderer direct-write guard resolved by import origin: the first argument of
 * `db.insert/update/delete` must be a table binding imported from `@shared/db`
 * whose exported name is on the allowlist, either as a named import (local
 * aliases stay allowed and cannot smuggle a table past the list) or as a
 * member of a `@shared/db` namespace import. Anything the rule cannot resolve
 * statically is rejected, so unlisted shapes fail closed.
 */
const rendererDirectWriteRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      notAllowlisted:
        'This table is not on the renderer direct-write allowlist. Route the write through the owning main-process workflow, or extend the allowlist with review (see the kisaki data-layer reference).'
    }
  },
  create(context) {
    function findVariable(scope: Scope.Scope | null, name: string): Scope.Variable | null {
      for (let current = scope; current; current = current.upper) {
        const variable = current.set.get(name)
        if (variable) return variable
      }
      return null
    }

    function resolveImport(
      identifier: Rule.Node & { type: 'Identifier' }
    ): { source: string; importedName: string | null } | null {
      const scope = context.sourceCode.getScope(identifier)
      const definition = findVariable(scope, identifier.name)?.defs[0]
      if (!definition || definition.type !== 'ImportBinding') return null

      const source = definition.parent.source.value
      if (typeof source !== 'string') return null

      if (definition.node.type === 'ImportSpecifier') {
        const imported = definition.node.imported
        return {
          source,
          importedName: imported.type === 'Identifier' ? imported.name : String(imported.value)
        }
      }
      if (definition.node.type === 'ImportNamespaceSpecifier') {
        return { source, importedName: null }
      }
      return null
    }

    function isSharedDbSource(source: string): boolean {
      return source === '@shared/db' || source.startsWith('@shared/db/')
    }

    function isAllowlistedTableArg(arg: Rule.Node): boolean {
      if (arg.type === 'Identifier') {
        const imported = resolveImport(arg as Rule.Node & { type: 'Identifier' })
        return (
          imported !== null &&
          imported.importedName !== null &&
          isSharedDbSource(imported.source) &&
          rendererDirectWriteTables.has(imported.importedName)
        )
      }

      if (
        arg.type === 'MemberExpression' &&
        !arg.computed &&
        arg.object.type === 'Identifier' &&
        arg.property.type === 'Identifier'
      ) {
        const imported = resolveImport(arg.object as Rule.Node & { type: 'Identifier' })
        return (
          imported !== null &&
          imported.importedName === null &&
          isSharedDbSource(imported.source) &&
          rendererDirectWriteTables.has(arg.property.name)
        )
      }

      return false
    }

    return {
      "CallExpression[callee.type='MemberExpression'][callee.object.name='db'][callee.property.name=/^(insert|update|delete)$/]"(
        node: Rule.Node & { type: 'CallExpression' }
      ) {
        const [tableArg] = node.arguments
        if (
          !tableArg ||
          tableArg.type === 'SpreadElement' ||
          !isAllowlistedTableArg(tableArg as Rule.Node)
        ) {
          context.report({ node, messageId: 'notAllowlisted' })
        }
      }
    }
  }
}

/**
 * Layout discipline for renderer surfaces (see the kisaki ui-system reference,
 * "Units" and "Responsive"): surfaces lay out against the container they are
 * in, on the rem scale. Each forbidden class family names its replacement.
 */
const layoutClassRestrictions: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /^(max-)?(sm|md|lg|xl|2xl):/,
    message:
      'Viewport breakpoints do not describe a desktop surface. Query the nearest container with @<step>: / @max-<step>:; a component that reflows declares its own @container root.'
  },
  {
    pattern: /^@(max-)?[0-9a-z]+\/[\w-]+:/,
    message:
      'Named container queries skip the nearest container and couple the component to a distant root. Query the nearest container (@<step>:); give a reflowing component its own @container root instead.'
  },
  {
    pattern: /^@container\/[\w-]+$/,
    message:
      'Containers are not named: a component queries the nearest one. Use a plain @container root.'
  },
  {
    pattern:
      /^(min-|max-)?(w|h|size|basis|inset|top|right|bottom|left|gap|p[xytrbl]?|m[xytrbl]?)-\[[^\]]*\d(px|vh|vw|vmin|vmax)/,
    message:
      'Pixel and viewport lengths bypass the rem scale. Use a spacing step (or a rem length); dialogs are bounded by the modal region, not the viewport.'
  },
  {
    pattern: /^text-\[/,
    message:
      'Arbitrary type sizes land between the compressed rem steps. Use a type role: text-xs, text-sm, text-base, or the display sizes text-lg / text-2xl.'
  },
  {
    pattern: /^text-(xl|3xl)$/,
    message:
      'text-xl and text-3xl are outside the type roles. Hero titles are text-lg; the report hero figure is text-2xl.'
  }
]

function findLayoutViolation(className: string): string | null {
  for (const { pattern, message } of layoutClassRestrictions) {
    if (pattern.test(className)) return message
  }
  return null
}

type EsTreeNode = Rule.Node & { type: string }

/** Every string literal and template chunk reachable inside a class expression, cn() or cva() call. */
function* collectClassStrings(
  node: unknown,
  seen = new Set<unknown>()
): Generator<{ text: string; node: EsTreeNode }> {
  if (!node || typeof node !== 'object' || seen.has(node)) return
  seen.add(node)
  if (Array.isArray(node)) {
    for (const item of node) yield* collectClassStrings(item, seen)
    return
  }
  const candidate = node as EsTreeNode & Record<string, unknown>
  if (typeof candidate.type !== 'string') return

  if (candidate.type === 'Literal' && typeof candidate.value === 'string') {
    yield { text: candidate.value, node: candidate }
    return
  }
  if (candidate.type === 'TemplateLiteral') {
    for (const quasi of candidate.quasis as Array<
      EsTreeNode & { value: { cooked: string | null } }
    >) {
      if (quasi.value.cooked) yield { text: quasi.value.cooked, node: quasi }
    }
    for (const expression of candidate.expressions as unknown[]) {
      yield* collectClassStrings(expression, seen)
    }
    return
  }

  for (const [key, value] of Object.entries(candidate)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue
    if (Array.isArray(value)) {
      for (const item of value) yield* collectClassStrings(item, seen)
    } else if (value && typeof value === 'object') {
      yield* collectClassStrings(value, seen)
    }
  }
}

const layoutDisciplineRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      forbiddenClass: "'{{className}}': {{message}}"
    }
  },
  create(context) {
    function reportStrings(strings: Iterable<{ text: string; node: EsTreeNode }>): void {
      for (const { text, node } of strings) {
        for (const className of text.split(/\s+/)) {
          const message = findLayoutViolation(className)
          if (message)
            context.report({ node, messageId: 'forbiddenClass', data: { className, message } })
        }
      }
    }

    const scriptVisitor: Rule.RuleListener = {
      "CallExpression[callee.type='Identifier'][callee.name=/^(cn|cva)$/]"(node) {
        reportStrings(collectClassStrings((node as Rule.Node & { arguments: unknown[] }).arguments))
      }
    }

    const templateVisitor = {
      'VAttribute[directive=false][key.name="class"][value!=null]'(node: {
        value: { value: string }
      }) {
        reportStrings([{ text: node.value.value, node: node as unknown as EsTreeNode }])
      },
      "VAttribute[directive=true][key.name.name='bind'][key.argument.name='class'] > VExpressionContainer.value"(node: {
        expression: unknown
      }) {
        reportStrings(collectClassStrings(node.expression))
      }
    }

    const defineTemplateBodyVisitor = (
      context.sourceCode.parserServices as {
        defineTemplateBodyVisitor?: (
          templateVisitor: Record<string, unknown>,
          scriptVisitor?: Rule.RuleListener
        ) => Rule.RuleListener
      }
    ).defineTemplateBodyVisitor

    return defineTemplateBodyVisitor
      ? defineTemplateBodyVisitor(templateVisitor, scriptVisitor)
      : scriptVisitor
  }
}

const kisakiPlugin = {
  rules: {
    'renderer-direct-write': rendererDirectWriteRule,
    'layout-discipline': layoutDisciplineRule
  }
}

/**
 * ESLint configuration for the desktop Electron app.
 * Extends base config with Vue-specific settings for this app.
 */
export default defineConfig([
  {
    extends: [baseConfig]
  },
  // Vue 3 recommended rules (flat config)
  pluginVue.configs['flat/recommended'],
  // Vue SFC with TypeScript parsing and browser globals
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaFeatures: {
          jsx: true
        },
        extraFileExtensions: ['.vue']
      }
    },
    rules: {
      // Vue specific rules (code quality only, not formatting)
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      'vue/no-v-html': 'off',
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/no-setup-props-reactivity-loss': 'error',
      'vue/define-props-declaration': ['error', 'type-based'],
      'vue/define-emits-declaration': ['error', 'type-based'],
      'vue/no-unused-refs': 'error',
      'vue/no-useless-v-bind': 'error',
      'vue/prefer-true-attribute-shorthand': 'error',
      'vue/prefer-separate-static-class': 'error',
      // Keep user-facing copy in the i18n message catalogs.
      'vue/no-restricted-syntax': ['error', ...noCjkTemplateRestrictions],
      'vue/no-bare-strings-in-template': ['error', noBareStringsOptions]
    }
  },
  // CJK copy must live in the shared i18n message catalogs.
  {
    files: ['src/**/*.{ts,vue}'],
    ignores: [
      'src/shared/i18n/messages/**',
      // Parses CJK source data from the YMGal API; not UI copy.
      'src/main/services/scraper/handlers/game/providers/ymgal/format.ts',
      // Matches CJK tokens in release file names; not UI copy.
      'src/main/services/holdings/anime/recognition.ts'
    ],
    rules: {
      'no-restricted-syntax': ['error', ...noCjkLiteralRestrictions]
    }
  },
  // Process boundary: the host bundle must stay free of Electron and main.
  {
    files: ['src/extension-host/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: extensionHostBoundaryPatterns
        }
      ]
    }
  },
  // Process boundary: main reaches the host only through its protocol entry.
  {
    files: ['src/main/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: mainToExtensionHostBoundaryPatterns
        }
      ]
    }
  },
  // Tooling boundary: repo automation consumes only the shared contract layer.
  {
    files: ['tools/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: toolsBoundaryPatterns
        }
      ]
    }
  },
  {
    files: ['src/renderer/src/**/*.{ts,vue}'],
    ignores: [
      'src/renderer/src/composables/index.ts',
      'src/renderer/src/stores/index.ts',
      'src/renderer/src/types/index.ts'
    ],
    plugins: {
      kisaki: kisakiPlugin
    },
    rules: {
      'kisaki/renderer-direct-write': 'error',
      'kisaki/layout-discipline': 'error',
      'no-restricted-syntax': ['error', exportAllRestriction, ...noCjkLiteralRestrictions],
      'no-restricted-imports': [
        'error',
        {
          patterns: rendererImportBoundaryPatterns
        }
      ]
    }
  },
  // Sanctioned dynamic write machinery: these modules write through
  // spec-typed table parameters, so the import-origin allowlist cannot see the
  // concrete table. Their table sets are bound in their own typed specs.
  {
    files: [
      'src/renderer/src/core/db/**/*.ts',
      'src/renderer/src/composables/use-anime-file-records.ts'
    ],
    rules: {
      'kisaki/renderer-direct-write': 'off'
    }
  },
  // Prevent shared/ui components from being route-aware (routing belongs to pages/features)
  {
    files: [
      'src/renderer/src/components/shared/**/*.{ts,vue}',
      'src/renderer/src/components/ui/**/*.{ts,vue}'
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'vue-router',
              importNames: [
                '*',
                'useRouter',
                'useRoute',
                'useLink',
                'onBeforeRouteLeave',
                'onBeforeRouteUpdate'
              ],
              message:
                'Do not use vue-router composables in components/shared or components/ui. Emit events and handle routing in pages/features.'
            }
          ],
          patterns: rendererImportBoundaryPatterns
        }
      ]
    }
  },
  // Prettier - disables all formatting rules (MUST be last)
  prettier
])
