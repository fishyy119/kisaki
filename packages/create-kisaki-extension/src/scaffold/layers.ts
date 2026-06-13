import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { ExtensionScaffoldConfig, ExtensionUiVariant } from './index'
import { applyJsonPatch, isJsonPatchFile, resolvePatchTargetFileName } from './patches'

export interface TemplateLayer {
  sourceDir: string
  targetDir: string
  optional?: boolean
}

const TEMPLATE_KEYS = [
  'PROJECT_NAME',
  'PACKAGE_NAME',
  'EXTENSION_ID',
  'EXTENSION_NAME',
  'DESCRIPTION',
  'AUTHOR',
  'CATEGORY',
  'TOOLING_VERSION',
  'EXTENSION_API_RANGE',
  'REGISTRY_ID',
  'REGISTRY_NAME',
  'PUBLISH_SECTION'
] as const

type TemplateKey = (typeof TEMPLATE_KEYS)[number]

type TemplateRenderMode = 'raw' | 'jsonStringContent' | 'templateStringContent'

const TEMPLATE_TOKEN_PATTERN = createTemplateTokenPattern()

export function resolveExtensionTargetDir(
  targetDir: string,
  config: ExtensionScaffoldConfig
): string {
  return config.publishWorkflow === 'github-monorepo'
    ? path.join(targetDir, 'extensions', config.extensionId)
    : targetDir
}

export function createTemplateLayers(
  templateDir: string,
  targetDir: string,
  config: ExtensionScaffoldConfig
): TemplateLayer[] {
  const extensionTargetDir = resolveExtensionTargetDir(targetDir, config)

  const layers: TemplateLayer[] = [
    {
      sourceDir: path.join(templateDir, 'workspace', 'base'),
      targetDir
    },
    {
      sourceDir: path.join(templateDir, 'workspace', 'publish', config.publishWorkflow),
      targetDir,
      optional: true
    },
    {
      sourceDir: path.join(templateDir, 'extension', 'base'),
      targetDir: extensionTargetDir
    },
    {
      sourceDir: path.join(templateDir, 'extension', 'categories', config.category),
      targetDir: extensionTargetDir
    }
  ]

  for (const uiLayer of resolveUiVariantLayers(config.uiVariant)) {
    layers.push({
      sourceDir: path.join(templateDir, 'extension', 'ui', uiLayer),
      targetDir: extensionTargetDir
    })
  }

  return layers.filter((layer) => {
    if (existsSync(layer.sourceDir)) {
      return true
    }

    if (layer.optional) {
      return false
    }

    throw new Error(`Template layer not found: ${layer.sourceDir}`)
  })
}

/**
 * Composite variants stack on their base template: `vue-kit` overlays the
 * UI-kit demo document and dependency onto the plain Vue layer.
 */
function resolveUiVariantLayers(variant: ExtensionUiVariant): readonly string[] {
  switch (variant) {
    case 'none':
      return []
    case 'vue-kit':
      return ['vue', 'vue-kit']
    default:
      return [variant]
  }
}

export function copyTemplateLayer(layer: TemplateLayer, context: Map<string, string>): void {
  mkdirSync(layer.targetDir, { recursive: true })

  for (const entry of readdirSync(layer.sourceDir)) {
    copyTemplateEntry(path.join(layer.sourceDir, entry), path.join(layer.targetDir, entry), context)
  }
}

function copyTemplateEntry(
  sourcePath: string,
  targetPath: string,
  context: Map<string, string>
): void {
  const entryStats = statSync(sourcePath)
  const sourceName = path.basename(targetPath)

  if (entryStats.isDirectory()) {
    mkdirSync(targetPath, { recursive: true })
    for (const entry of readdirSync(sourcePath)) {
      copyTemplateEntry(path.join(sourcePath, entry), path.join(targetPath, entry), context)
    }
    return
  }

  if (isJsonPatchFile(sourceName)) {
    const patchTargetPath = path.join(
      path.dirname(targetPath),
      resolvePatchTargetFileName(sourceName)
    )
    const renderedPatch = applyTemplate(readFileSync(sourcePath, 'utf-8'), context, patchTargetPath)
    applyJsonPatch(patchTargetPath, renderedPatch)
    return
  }

  const targetEntryPath = path.join(path.dirname(targetPath), resolveTargetFileName(sourceName))
  mkdirSync(path.dirname(targetEntryPath), { recursive: true })
  const content = applyTemplate(readFileSync(sourcePath, 'utf-8'), context, targetEntryPath)
  writeFileSync(targetEntryPath, content)
}

/**
 * Template dotfiles always ship with an underscore prefix and are renamed on
 * copy. This keeps them out of package publishing exceptions (e.g. `.gitignore`
 * is never packed and is parsed as ignore rules) and prevents
 * template data from acting as live git/editor/formatter configuration for
 * the host repository.
 */
const TEMPLATE_FILE_RENAMES: Readonly<Record<string, string>> = {
  _editorconfig: '.editorconfig',
  _gitattributes: '.gitattributes',
  _gitignore: '.gitignore',
  _prettierignore: '.prettierignore',
  '_prettierrc.yaml': '.prettierrc.yaml'
}

function resolveTargetFileName(sourceName: string): string {
  return TEMPLATE_FILE_RENAMES[sourceName] ?? sourceName
}

export function createTemplateContext(
  templateDir: string,
  config: ExtensionScaffoldConfig
): Map<string, string> {
  const values: Record<TemplateKey, string> = {
    PROJECT_NAME: config.projectName,
    PACKAGE_NAME: config.packageName,
    EXTENSION_ID: config.extensionId,
    EXTENSION_NAME: config.extensionName,
    DESCRIPTION: config.description,
    AUTHOR: config.author,
    CATEGORY: config.category,
    TOOLING_VERSION: config.toolingVersion,
    EXTENSION_API_RANGE: config.extensionApiRange,
    REGISTRY_ID: config.registryId,
    REGISTRY_NAME: config.registryName,
    PUBLISH_SECTION: ''
  }
  const context = new Map<string, string>()

  for (const [key, value] of Object.entries(values)) {
    context.set(`__${key}__`, value)
    context.set(`{{${key}}}`, value)
  }

  const publishSection = readPublishSection(templateDir, config, context)
  context.set('__PUBLISH_SECTION__', publishSection)
  context.set('{{PUBLISH_SECTION}}', publishSection)

  return context
}

function readPublishSection(
  templateDir: string,
  config: ExtensionScaffoldConfig,
  context: Map<string, string>
): string {
  const sectionPath = path.join(
    templateDir,
    'extension',
    'publish',
    config.publishWorkflow,
    'PUBLISH.md'
  )

  if (!existsSync(sectionPath)) {
    return ''
  }

  return applyTemplate(readFileSync(sectionPath, 'utf-8').trimEnd(), context, sectionPath)
}

function createTemplateTokenPattern(): RegExp {
  const keys = TEMPLATE_KEYS.join('|')
  return new RegExp(`__(?:${keys})__|\\{\\{(?:${keys})\\}\\}`, 'g')
}

function applyTemplate(content: string, context: Map<string, string>, targetPath: string): string {
  const replacements = formatTemplateReplacements(context, getTemplateRenderMode(targetPath))

  return content.replace(TEMPLATE_TOKEN_PATTERN, (token) => replacements.get(token) ?? token)
}

function formatTemplateReplacements(
  context: Map<string, string>,
  mode: TemplateRenderMode
): Map<string, string> {
  const replacements = new Map<string, string>()

  for (const [token, value] of context) {
    replacements.set(token, formatTemplateValue(value, mode))
  }

  return replacements
}

function getTemplateRenderMode(targetPath: string): TemplateRenderMode {
  const extension = path.extname(targetPath)

  if (extension === '.json' || extension === '.yml' || extension === '.yaml') {
    return 'jsonStringContent'
  }

  if (['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx', '.vue'].includes(extension)) {
    return 'templateStringContent'
  }

  return 'raw'
}

function formatTemplateValue(value: string, mode: TemplateRenderMode): string {
  if (mode === 'jsonStringContent') {
    return toJsonStringContent(value)
  }

  if (mode === 'templateStringContent') {
    return toTemplateStringContent(value)
  }

  return value
}

function toJsonStringContent(value: string): string {
  return JSON.stringify(value).slice(1, -1)
}

function toTemplateStringContent(value: string): string {
  return JSON.stringify(value).slice(1, -1).replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}
