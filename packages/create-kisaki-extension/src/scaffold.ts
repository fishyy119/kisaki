import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { isExtensionIdentifier, type ExtensionCategory } from '@kisaki3/extension-api'

export interface ExtensionScaffoldConfig {
  projectName: string
  packageName: string
  extensionId: string
  extensionName: string
  description: string
  author: string
  category: ExtensionCategory
  toolingVersion: string
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

export function scaffoldExtension(options: ScaffoldExtensionOptions): ScaffoldExtensionResult {
  if (!existsSync(options.templateDir)) {
    throw new Error(`Template directory not found: ${options.templateDir}`)
  }

  if (existsSync(options.targetDir)) {
    throw new Error(`Directory already exists: ${options.config.projectName}`)
  }

  mkdirSync(options.targetDir, { recursive: true })
  copyTemplate(options.templateDir, options.targetDir, options.config)

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

function copyTemplate(src: string, dest: string, config: ExtensionScaffoldConfig): void {
  mkdirSync(dest, { recursive: true })

  for (const entry of readdirSync(src)) {
    const sourcePath = path.join(src, entry)
    const targetPath = path.join(dest, entry)

    if (statSync(sourcePath).isDirectory()) {
      copyTemplate(sourcePath, targetPath, config)
      continue
    }

    const content = applyTemplate(readFileSync(sourcePath, 'utf-8'), config, targetPath)
    writeFileSync(targetPath, content)
  }
}

const TEMPLATE_TOKEN_PATTERN =
  /__(?:PROJECT_NAME|PACKAGE_NAME|EXTENSION_ID|EXTENSION_NAME|DESCRIPTION|AUTHOR|CATEGORY|TOOLING_VERSION)__|\{\{(?:PROJECT_NAME|PACKAGE_NAME|EXTENSION_ID|EXTENSION_NAME|DESCRIPTION|AUTHOR|CATEGORY|TOOLING_VERSION)\}\}/g

type TemplateRenderMode = 'raw' | 'jsonStringContent' | 'templateStringContent'

function applyTemplate(
  content: string,
  config: ExtensionScaffoldConfig,
  targetPath: string
): string {
  const replacements = createTemplateReplacements(config, getTemplateRenderMode(targetPath))

  return content.replace(TEMPLATE_TOKEN_PATTERN, (token) => replacements.get(token) ?? token)
}

function createTemplateReplacements(
  config: ExtensionScaffoldConfig,
  mode: TemplateRenderMode
): Map<string, string> {
  const values = {
    PROJECT_NAME: config.projectName,
    PACKAGE_NAME: config.packageName,
    EXTENSION_ID: config.extensionId,
    EXTENSION_NAME: config.extensionName,
    DESCRIPTION: config.description,
    AUTHOR: config.author,
    CATEGORY: config.category,
    TOOLING_VERSION: config.toolingVersion
  }
  const replacements = new Map<string, string>()

  for (const [key, value] of Object.entries(values)) {
    const replacement = formatTemplateValue(value, mode)
    replacements.set(`__${key}__`, replacement)
    replacements.set(`{{${key}}}`, replacement)
  }

  return replacements
}

function getTemplateRenderMode(targetPath: string): TemplateRenderMode {
  const extension = path.extname(targetPath)

  if (extension === '.json') {
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
    execFileSync('git', ['init'], { cwd: targetDir, stdio: 'ignore' })
  } catch {
    return { gitInitialized: false, initialCommitCreated: false }
  }

  try {
    execFileSync('git', ['add', '-A'], { cwd: targetDir, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', `Initial commit: ${extensionName}`], {
      cwd: targetDir,
      stdio: 'ignore'
    })
    return { gitInitialized: true, initialCommitCreated: true }
  } catch {
    return { gitInitialized: true, initialCommitCreated: false }
  }
}
