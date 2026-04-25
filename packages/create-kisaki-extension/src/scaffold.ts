import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export interface ExtensionScaffoldConfig {
  projectName: string
  packageName: string
  extensionId: string
  extensionName: string
  description: string
  author: string
  category: string
}

export interface ScaffoldExtensionOptions {
  config: ExtensionScaffoldConfig
  templateDir: string
  targetDir: string
  git: boolean
}

export interface ScaffoldExtensionResult {
  gitInitialized: boolean
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

  return {
    gitInitialized: options.git ? initGit(options.targetDir, options.config.extensionName) : false,
    gitRequested: options.git
  }
}

export function isProjectName(value: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(value.trim())
}

export function toPackageName(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/^[._]+/, '')
    .toLowerCase()
}

export function toExtensionId(value: string): string {
  return toPackageName(value).replace(/_/g, '-')
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

    const content = applyTemplate(readFileSync(sourcePath, 'utf-8'), config)
    writeFileSync(targetPath, content)
  }
}

function applyTemplate(content: string, config: ExtensionScaffoldConfig): string {
  return content
    .replaceAll('__PROJECT_NAME__', config.projectName)
    .replaceAll('__PACKAGE_NAME__', config.packageName)
    .replaceAll('__EXTENSION_ID__', config.extensionId)
    .replaceAll('__EXTENSION_NAME__', config.extensionName)
    .replaceAll('{{EXTENSION_NAME}}', config.extensionName)
    .replaceAll('__DESCRIPTION__', config.description)
    .replaceAll('{{DESCRIPTION}}', config.description)
    .replaceAll('__AUTHOR__', config.author)
    .replaceAll('__CATEGORY__', config.category)
}

function initGit(targetDir: string, extensionName: string): boolean {
  try {
    execFileSync('git', ['init'], { cwd: targetDir, stdio: 'ignore' })
    execFileSync('git', ['add', '-A'], { cwd: targetDir, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', `Initial commit: ${extensionName}`], {
      cwd: targetDir,
      stdio: 'ignore'
    })
    return true
  } catch {
    return false
  }
}
