import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { ExtensionWebview } from '../extension-options'
import type { ExtensionScaffoldConfig } from './model'
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
  'PROJECT_NAME',
  'WORKSPACE_PACKAGE_NAME',
  'PACKAGE_NAME',
  'EXTENSION_ID',
  'EXTENSION_NAME',
  'DESCRIPTION',
  'AUTHOR',
  'CATEGORIES_LABEL',
  'STARTER',
  'STARTER_MODULE',
  'WEBVIEW',
  'TOOLING_VERSION',
  'EXTENSION_API_RANGE',
  'NODE_VERSION',
  'PACKAGE_MANAGER',
  'REPOSITORY_LAYOUT',
  'PUBLISH_PROVIDER',
  'GENERATED_AT',
  'REGISTRY_ID',
  'REGISTRY_NAME'
] as const

type TemplateKey = (typeof TEMPLATE_KEYS)[number]
type TemplateRenderMode = 'raw' | 'htmlTextContent' | 'jsonStringContent' | 'templateStringContent'

const TEMPLATE_TOKEN_PATTERN = createTemplateTokenPattern()

/** Creates all workspace and extension layers for a new repository. */
export function createRepositoryTemplateLayers(
  templateDir: string,
  targetDir: string,
  config: ExtensionScaffoldConfig
): TemplateLayer[] {
  const extensionTargetDir =
    config.repositoryLayout === 'monorepo'
      ? path.join(targetDir, 'extensions', config.extensionId)
      : targetDir

  return resolveTemplateLayers([
    {
      sourceDir: path.join(templateDir, 'workspace', 'base'),
      targetDir
    },
    {
      sourceDir: path.join(templateDir, 'workspace', 'layout', config.repositoryLayout),
      targetDir
    },
    {
      sourceDir: path.join(
        templateDir,
        'workspace',
        'provider',
        config.publishProvider,
        config.repositoryLayout
      ),
      targetDir,
      optional: true
    },
    ...createExtensionTemplateLayers(templateDir, extensionTargetDir, config)
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

  if (config.webview !== 'none') {
    for (const webviewLayer of resolveWebviewLayers(config.webview)) {
      layers.push({
        sourceDir: path.join(templateDir, 'extension', 'webview', webviewLayer),
        targetDir
      })
    }
  }
  layers.push({
    sourceDir: path.join(
      templateDir,
      'extension',
      'provider',
      config.publishProvider,
      config.repositoryLayout
    ),
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

/** Creates escaped token replacements for one extension configuration. */
export function createTemplateContext(config: ExtensionScaffoldConfig): Map<string, string> {
  const values: Record<TemplateKey, string> = {
    PROJECT_NAME: config.projectName,
    WORKSPACE_PACKAGE_NAME: config.workspacePackageName,
    PACKAGE_NAME: config.packageName,
    EXTENSION_ID: config.extensionId,
    EXTENSION_NAME: config.extensionName,
    DESCRIPTION: config.description,
    AUTHOR: config.author ?? '',
    CATEGORIES_LABEL: config.categories.join(', '),
    STARTER: config.starter,
    STARTER_MODULE: config.starter,
    WEBVIEW: config.webview,
    TOOLING_VERSION: config.toolingVersion,
    EXTENSION_API_RANGE: config.extensionApiRange,
    NODE_VERSION: config.nodeVersion,
    PACKAGE_MANAGER: config.packageManager,
    REPOSITORY_LAYOUT: config.repositoryLayout,
    PUBLISH_PROVIDER: config.publishProvider,
    GENERATED_AT: new Date().toISOString(),
    REGISTRY_ID: config.registryId,
    REGISTRY_NAME: config.registryName
  }
  const context = new Map<string, string>()
  for (const [key, value] of Object.entries(values)) {
    context.set(`__${key}__`, value)
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

function resolveWebviewLayers(webview: Exclude<ExtensionWebview, 'none'>): readonly string[] {
  return webview === 'vue-kit' ? ['base', 'vue', 'vue-kit'] : ['base', webview]
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
  return new RegExp(`__(?:${keys})__`, 'g')
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
