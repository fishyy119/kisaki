import type { Rule } from 'eslint'
import { defineConfig } from 'eslint/config'
import { baseConfig } from '../../eslint.config'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

/**
 * Layout discipline for kit surfaces (see the kisaki ui-system reference,
 * "Units" and "Responsive"): surfaces lay out against the container they are
 * in, on the rem scale. Each forbidden class family names its replacement.
 *
 * The kit's own copy of the rule the app renderer runs: the two evolve
 * independently and neither imports from the other, so this list may diverge
 * from the app's as the kit's needs do.
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
    'layout-discipline': layoutDisciplineRule
  }
}

/**
 * ESLint configuration for the extension webview UI kit.
 * Extends the base config with Vue SFC parsing and the design-system layout
 * discipline the app renderer enforces on the same recipes.
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
    files: ['src/**/*.{ts,vue}'],
    plugins: {
      kisaki: kisakiPlugin
    },
    rules: {
      'kisaki/layout-discipline': 'error'
    }
  },
  prettier
])
