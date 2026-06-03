import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { isExtensionIdentifier, type ExtensionCategory } from '@kisaki3/extension-api'
import spawn from 'cross-spawn'

export const EXTENSION_PUBLISH_WORKFLOWS = ['manual', 'github-single', 'github-monorepo'] as const

export type ExtensionPublishWorkflow = (typeof EXTENSION_PUBLISH_WORKFLOWS)[number]

export interface ExtensionScaffoldConfig {
  projectName: string
  packageName: string
  extensionId: string
  extensionName: string
  description: string
  author: string
  category: ExtensionCategory
  toolingVersion: string
  extensionApiRange: string
  publishWorkflow: ExtensionPublishWorkflow
  registryId: string
  registryName: string
}

export interface ScaffoldExtensionOptions {
  config: ExtensionScaffoldConfig
  templateDir: string
  targetDir: string
  git: boolean
}

export interface ScaffoldExtensionResult {
  gitInitialized: boolean
  initialCommitCreated: boolean
  gitRequested: boolean
}

interface TemplateLayer {
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

const TEMPLATE_TOKEN_PATTERN = createTemplateTokenPattern()

type TemplateRenderMode = 'raw' | 'jsonStringContent' | 'templateStringContent'

export function scaffoldExtension(options: ScaffoldExtensionOptions): ScaffoldExtensionResult {
  if (!existsSync(options.templateDir)) {
    throw new Error(`Template directory not found: ${options.templateDir}`)
  }

  if (existsSync(options.targetDir)) {
    throw new Error(`Directory already exists: ${options.config.projectName}`)
  }

  const templateContext = createTemplateContext(options.templateDir, options.config)
  mkdirSync(options.targetDir, { recursive: true })

  for (const layer of createTemplateLayers(
    options.templateDir,
    options.targetDir,
    options.config
  )) {
    copyTemplateLayer(layer, templateContext)
  }

  const gitResult = options.git
    ? initGit(options.targetDir, options.config.extensionName)
    : { gitInitialized: false, initialCommitCreated: false }

  return { ...gitResult, gitRequested: options.git }
}

export function isProjectName(value: string): boolean {
  return /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/.test(value.trim())
}

export function toPackageName(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/^[._]+/, '')
    .toLowerCase()
}

export function toExtensionId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/[^a-z0-9.-]+/g, '-')
    .split('.')
    .map((segment) => segment.replace(/-+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .join('.')

  if (isExtensionIdentifier(normalized)) {
    return normalized
  }

  return 'my-kisaki-extension'
}

export function toDisplayName(value: string): string {
  return value.replace(/[._-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function createTemplateLayers(
  templateDir: string,
  targetDir: string,
  config: ExtensionScaffoldConfig
): TemplateLayer[] {
  const extensionTargetDir =
    config.publishWorkflow === 'github-monorepo'
      ? path.join(targetDir, 'extensions', config.extensionId)
      : targetDir

  return [
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
  ].filter((layer) => {
    if (existsSync(layer.sourceDir)) {
      return true
    }

    if (layer.optional) {
      return false
    }

    throw new Error(`Template layer not found: ${layer.sourceDir}`)
  })
}

function copyTemplateLayer(layer: TemplateLayer, context: Map<string, string>): void {
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
  const targetEntryPath = path.join(
    path.dirname(targetPath),
    path.basename(targetPath) === '_gitignore' ? '.gitignore' : path.basename(targetPath)
  )

  if (entryStats.isDirectory()) {
    mkdirSync(targetEntryPath, { recursive: true })
    for (const entry of readdirSync(sourcePath)) {
      copyTemplateEntry(path.join(sourcePath, entry), path.join(targetEntryPath, entry), context)
    }
    return
  }

  mkdirSync(path.dirname(targetEntryPath), { recursive: true })
  const content = applyTemplate(readFileSync(sourcePath, 'utf-8'), context, targetEntryPath)
  writeFileSync(targetEntryPath, content)
}

function createTemplateContext(
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

  if (['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx'].includes(extension)) {
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

function initGit(
  targetDir: string,
  extensionName: string
): Pick<ScaffoldExtensionResult, 'gitInitialized' | 'initialCommitCreated'> {
  try {
    initGitMainBranch(targetDir)
  } catch {
    return { gitInitialized: false, initialCommitCreated: false }
  }

  try {
    runGit(targetDir, ['add', '-A'])
    runGit(targetDir, ['commit', '-m', `Initial commit: ${extensionName}`])
    return { gitInitialized: true, initialCommitCreated: true }
  } catch {
    return { gitInitialized: true, initialCommitCreated: false }
  }
}

function initGitMainBranch(targetDir: string): void {
  try {
    runGit(targetDir, ['init', '-b', 'main'])
    return
  } catch {
    runGit(targetDir, ['init'])
  }

  runGit(targetDir, ['branch', '-M', 'main'])
}

function runGit(cwd: string, args: readonly string[]): void {
  const result = spawn.sync('git', args, { cwd, stdio: 'ignore' })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed with exit code ${String(result.status)}.`)
  }
}
