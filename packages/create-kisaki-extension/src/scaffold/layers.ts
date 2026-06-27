import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  WEBVIEW_ADDON_OPTIONS,
  WEBVIEW_FRAMEWORK_OPTIONS,
  type ExtensionWebviewAddon,
  type ExtensionWebviewFramework
} from '../extension-options'
import type { ExtensionScaffoldConfig, RepositoryScaffoldConfig } from './model'
import {
  applyTemplateMergeManifest,
  getTemplateMergeSourcePaths,
  readTemplateMergeManifest,
  TEMPLATE_MANIFEST_FILE
} from './merge'

/** One ordered template source and its materialization destination. */
export interface TemplateLayer {
  sourceDir: string
  targetDir: string
  optional?: boolean
}

const TEMPLATE_KEYS = [
  'WORKSPACE_PACKAGE_NAME',
  'WORKSPACE_PACKAGE_DESCRIPTION',
  'WORKSPACE_PACKAGE_MANAGER',
  'WORKSPACE_NODE_ENGINE_RANGE',
  'EXTENSION_PACKAGE_NAME',
  'EXTENSION_PACKAGE_DESCRIPTION',
  'EXTENSION_PACKAGE_MANAGER',
  'EXTENSION_NODE_ENGINE_RANGE',
  'EXTENSION_ID',
  'EXTENSION_NAME',
  'EXTENSION_README_TITLE',
  'EXTENSION_README_DESCRIPTION',
  'EXTENSION_MANIFEST_ID',
  'EXTENSION_MANIFEST_NAME',
  'EXTENSION_MANIFEST_DESCRIPTION',
  'EXTENSION_MANIFEST_AUTHOR',
  'EXTENSION_MANIFEST_KISAKI_ENGINE_RANGE',
  'EXTENSION_CATEGORIES_LABEL',
  'EXTENSION_STARTER',
  'EXTENSION_STARTER_MODULE',
  'EXTENSION_WEBVIEW_LABEL',
  'EXTENSION_WEBVIEW_ADDONS_LABEL',
  'KISAKI_TOOLING_VERSION',
  'WORKSPACE_PUBLISH_PROVIDER',
  'WORKSPACE_README_TITLE',
  'WORKSPACE_README_DESCRIPTION'
] as const

type TemplateKey = (typeof TEMPLATE_KEYS)[number]
type TemplateRenderMode = 'raw' | 'htmlTextContent' | 'jsonStringContent' | 'templateStringContent'

const TEMPLATE_TOKEN_PATTERN = createTemplateTokenPattern()

/** Creates all workspace and extension layers for a new repository. */
export function createRepositoryTemplateLayers(
  templateDir: string,
  targetDir: string,
  repository: RepositoryScaffoldConfig,
  extension: ExtensionScaffoldConfig
): TemplateLayer[] {
  const extensionTargetDir = path.join(targetDir, 'extensions', extension.extensionId)

  return resolveTemplateLayers([
    {
      sourceDir: path.join(templateDir, 'workspace', 'base'),
      targetDir
    },
    {
      sourceDir: path.join(templateDir, 'workspace', 'provider', repository.publishProvider),
      targetDir,
      optional: true
    },
    ...createExtensionTemplateLayers(templateDir, extensionTargetDir, extension)
  ])
}

/** Creates composable base, starter, UI, and publishing layers for one extension. */
export function createExtensionTemplateLayers(
  templateDir: string,
  targetDir: string,
  config: ExtensionScaffoldConfig
): TemplateLayer[] {
  const layers: TemplateLayer[] = [
    {
      sourceDir: path.join(templateDir, 'extension', 'base'),
      targetDir
    },
    {
      sourceDir: path.join(templateDir, 'extension', 'starters', config.starter),
      targetDir
    }
  ]

  if (config.webviewFramework !== 'none') {
    for (const webviewLayer of resolveWebviewLayers(config)) {
      layers.push({
        sourceDir: path.join(templateDir, 'extension', 'webview', webviewLayer),
        targetDir
      })
    }
  }
  layers.push({
    sourceDir: path.join(templateDir, 'extension', 'provider', config.publishProvider),
    targetDir,
    optional: true
  })

  return resolveTemplateLayers(layers)
}

/** Copies one token-rendered template layer into its target. */
export function copyTemplateLayer(layer: TemplateLayer, context: Map<string, string>): void {
  mkdirSync(layer.targetDir, { recursive: true })
  const manifest = readTemplateMergeManifest(layer.sourceDir)
  const mergeSourcePaths = getTemplateMergeSourcePaths(manifest)

  for (const entry of readdirSync(layer.sourceDir)) {
    copyTemplateEntry({
      sourcePath: path.join(layer.sourceDir, entry),
      targetPath: path.join(layer.targetDir, entry),
      relativeSourcePath: entry,
      context,
      mergeSourcePaths
    })
  }

  applyTemplateMergeManifest(manifest, {
    sourceDir: layer.sourceDir,
    targetDir: layer.targetDir,
    renderTemplate: (content, targetPath) => applyTemplate(content, context, targetPath)
  })
}

/** Creates escaped token replacements for repository and initial extension layers. */
export function createRepositoryTemplateContext(
  repository: RepositoryScaffoldConfig,
  extension: ExtensionScaffoldConfig
): Map<string, string> {
  return createTemplateContext({
    ...createExtensionTemplateValues(extension),
    WORKSPACE_PACKAGE_NAME: repository.workspacePackageName,
    WORKSPACE_PACKAGE_DESCRIPTION: repository.workspacePackageDescription,
    WORKSPACE_PACKAGE_MANAGER: repository.packageManager,
    WORKSPACE_NODE_ENGINE_RANGE: repository.nodeEngineRange,
    WORKSPACE_PUBLISH_PROVIDER: repository.publishProvider,
    WORKSPACE_README_TITLE: repository.registryName,
    WORKSPACE_README_DESCRIPTION: repository.registryDescription,
    KISAKI_TOOLING_VERSION: repository.toolingVersion
  })
}

/** Creates escaped token replacements for one extension project. */
export function createExtensionTemplateContext(
  config: ExtensionScaffoldConfig
): Map<string, string> {
  return createTemplateContext(createExtensionTemplateValues(config))
}

function createExtensionTemplateValues(
  config: ExtensionScaffoldConfig
): Partial<Record<TemplateKey, string>> {
  return {
    EXTENSION_PACKAGE_NAME: config.extensionPackageName,
    EXTENSION_PACKAGE_DESCRIPTION: config.extensionDescription,
    EXTENSION_PACKAGE_MANAGER: config.packageManager,
    EXTENSION_NODE_ENGINE_RANGE: config.nodeEngineRange,
    EXTENSION_ID: config.extensionId,
    EXTENSION_NAME: config.extensionName,
    EXTENSION_README_TITLE: config.extensionName,
    EXTENSION_README_DESCRIPTION: config.extensionDescription,
    EXTENSION_MANIFEST_ID: config.extensionId,
    EXTENSION_MANIFEST_NAME: config.extensionName,
    EXTENSION_MANIFEST_DESCRIPTION: config.extensionDescription,
    EXTENSION_MANIFEST_AUTHOR: config.author ?? '',
    EXTENSION_MANIFEST_KISAKI_ENGINE_RANGE: config.extensionApiRange,
    EXTENSION_CATEGORIES_LABEL: config.categories.join(', '),
    EXTENSION_STARTER: config.starter,
    EXTENSION_STARTER_MODULE: config.starter,
    EXTENSION_WEBVIEW_LABEL: toWebviewLabel(config.webviewFramework),
    EXTENSION_WEBVIEW_ADDONS_LABEL: toWebviewAddonsLabel(config.webviewAddons),
    KISAKI_TOOLING_VERSION: config.toolingVersion
  }
}

function createTemplateContext(values: Partial<Record<TemplateKey, string>>): Map<string, string> {
  const context = new Map<string, string>()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      context.set(`{{${key}}}`, value)
    }
  }
  return context
}

/** Removes optional empty metadata after all JSON layers have been merged. */
export function finalizeExtensionTemplate(
  extensionDir: string,
  config: ExtensionScaffoldConfig
): void {
  const manifestPath = path.join(extensionDir, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
  manifest.categories = config.categories
  if (!config.author) {
    delete manifest.author
  }
  writeFileSync(manifestPath, formatExtensionManifest(manifest, config.categories))
}

function formatExtensionManifest(
  manifest: Record<string, unknown>,
  categories: ExtensionScaffoldConfig['categories']
): string {
  const formattedCategories = `[${categories.map((category) => JSON.stringify(category)).join(', ')}]`
  const expandedCategories = JSON.stringify(categories, null, 2).replace(/\n/g, '\n  ')
  const document = JSON.stringify(manifest, null, 2).replace(
    `  "categories": ${expandedCategories}`,
    `  "categories": ${formattedCategories}`
  )
  return `${document}\n`
}

function resolveWebviewLayers(config: ExtensionScaffoldConfig): readonly string[] {
  const framework = config.webviewFramework as Exclude<ExtensionWebviewFramework, 'none'>
  return [
    'base',
    path.posix.join('frameworks', framework),
    ...config.webviewAddons.map((addon) => path.posix.join('addons', addon))
  ]
}

function toWebviewLabel(framework: ExtensionWebviewFramework): string {
  return getOptionLabel(WEBVIEW_FRAMEWORK_OPTIONS, framework)
}

function toWebviewAddonsLabel(addons: readonly ExtensionWebviewAddon[]): string {
  if (addons.length === 0) {
    return 'None'
  }
  return addons.map((addon) => getOptionLabel(WEBVIEW_ADDON_OPTIONS, addon)).join(', ')
}

function getOptionLabel<T extends string>(
  options: readonly { value: T; label: string }[],
  value: T
): string {
  return options.find((option) => option.value === value)?.label ?? value
}

function resolveTemplateLayers(layers: readonly TemplateLayer[]): TemplateLayer[] {
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

interface CopyTemplateEntryOptions {
  sourcePath: string
  targetPath: string
  relativeSourcePath: string
  context: Map<string, string>
  mergeSourcePaths: ReadonlySet<string>
}

function copyTemplateEntry(options: CopyTemplateEntryOptions): void {
  const { sourcePath, targetPath, relativeSourcePath, context, mergeSourcePaths } = options
  const entryStats = statSync(sourcePath)
  const sourceName = path.basename(targetPath)

  if (relativeSourcePath === TEMPLATE_MANIFEST_FILE || mergeSourcePaths.has(relativeSourcePath)) {
    return
  }

  if (entryStats.isDirectory()) {
    for (const entry of readdirSync(sourcePath)) {
      copyTemplateEntry({
        sourcePath: path.join(sourcePath, entry),
        targetPath: path.join(targetPath, entry),
        relativeSourcePath: path.posix.join(relativeSourcePath, entry),
        context,
        mergeSourcePaths
      })
    }
    return
  }

  const targetEntryPath = path.join(path.dirname(targetPath), resolveTargetFileName(sourceName))
  mkdirSync(path.dirname(targetEntryPath), { recursive: true })
  const content = applyTemplate(readFileSync(sourcePath, 'utf8'), context, targetEntryPath)
  writeFileSync(targetEntryPath, content)
}

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

function createTemplateTokenPattern(): RegExp {
  const keys = TEMPLATE_KEYS.join('|')
  return new RegExp(`\\{\\{(?:${keys})\\}\\}`, 'g')
}

function applyTemplate(content: string, context: Map<string, string>, targetPath: string): string {
  const renderMode = getTemplateRenderMode(targetPath)
  return content.replace(TEMPLATE_TOKEN_PATTERN, (token) => {
    const value = context.get(token) ?? token
    return formatTemplateValue(value, renderMode)
  })
}

function getTemplateRenderMode(targetPath: string): TemplateRenderMode {
  const extension = path.extname(targetPath)
  if (extension === '.json' || extension === '.yml' || extension === '.yaml') {
    return 'jsonStringContent'
  }
  if (extension === '.html') {
    return 'htmlTextContent'
  }
  if (['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx', '.vue'].includes(extension)) {
    return 'templateStringContent'
  }
  return 'raw'
}

function formatTemplateValue(value: string, mode: TemplateRenderMode): string {
  if (mode === 'htmlTextContent') {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
  if (mode === 'jsonStringContent') {
    return JSON.stringify(value).slice(1, -1)
  }
  if (mode === 'templateStringContent') {
    return JSON.stringify(value).slice(1, -1).replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
  }
  return value
}
