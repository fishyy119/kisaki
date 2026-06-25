import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'
import {
  copyTemplateLayer,
  createExtensionTemplateLayers,
  createRepositoryTemplateLayers,
  createTemplateContext,
  finalizeExtensionTemplate,
  type TemplateLayer
} from './layers'
import type {
  ExtensionScaffoldConfig,
  ScaffoldRepositoryOptions,
  ScaffoldWorkspaceExtensionOptions
} from './model'
import { readExtensionWorkspace, updateWorkspaceExtensionList } from './workspace'

/**
 * Creates a repository through a sibling staging directory and publishes it
 * with one final rename, so template failures never leave a partial target.
 */
export function scaffoldRepository(options: ScaffoldRepositoryOptions): void {
  assertTemplateAndTarget(options.templateDir, options.targetDir)
  const stagingDir = createStagingPath(options.targetDir)

  try {
    materializeLayers(
      createRepositoryTemplateLayers(options.templateDir, stagingDir, options.config),
      options.config
    )
    finalizeGeneratedExtension(stagingDir, options.config)
    publishStagingDirectory(stagingDir, options.targetDir)
  } catch (error) {
    rmSync(stagingDir, { recursive: true, force: true })
    throw error
  }
}

/** Adds one extension atomically to an existing extension monorepository. */
export function scaffoldWorkspaceExtension(options: ScaffoldWorkspaceExtensionOptions): string {
  readExtensionWorkspace(options.workspaceDir)
  if (!existsSync(options.templateDir)) {
    throw new Error(`Template directory not found: ${options.templateDir}`)
  }

  const extensionsDir = path.join(options.workspaceDir, 'extensions')
  const targetDir = path.join(extensionsDir, options.config.extensionId)
  if (existsSync(targetDir)) {
    throw new Error(`Extension directory already exists: ${targetDir}`)
  }

  mkdirSync(extensionsDir, { recursive: true })
  const stagingDir = createStagingPath(targetDir)

  try {
    materializeLayers(
      createExtensionTemplateLayers(options.templateDir, stagingDir, options.config),
      options.config
    )
    finalizeExtensionTemplate(stagingDir, options.config)
    publishStagingDirectory(stagingDir, targetDir)
    updateWorkspaceExtensionList(options.workspaceDir)
    return targetDir
  } catch (error) {
    rmSync(stagingDir, { recursive: true, force: true })
    rmSync(targetDir, { recursive: true, force: true })
    throw error
  }
}

function materializeLayers(
  layers: readonly TemplateLayer[],
  config: ExtensionScaffoldConfig
): void {
  const context = createTemplateContext(config)
  for (const layer of layers) {
    copyTemplateLayer(layer, context)
  }
}

function finalizeGeneratedExtension(repositoryDir: string, config: ExtensionScaffoldConfig): void {
  const extensionDir =
    config.repositoryLayout === 'monorepo'
      ? path.join(repositoryDir, 'extensions', config.extensionId)
      : repositoryDir
  finalizeExtensionTemplate(extensionDir, config)
}

function assertTemplateAndTarget(templateDir: string, targetDir: string): void {
  if (!existsSync(templateDir)) {
    throw new Error(`Template directory not found: ${templateDir}`)
  }

  if (existsSync(targetDir)) {
    throw new Error(`Directory already exists: ${targetDir}`)
  }
}

function createStagingPath(targetDir: string): string {
  const parentDir = path.dirname(targetDir)
  const name = path.basename(targetDir)
  return path.join(parentDir, `.${name}.scaffold-${randomUUID()}`)
}

function publishStagingDirectory(stagingDir: string, targetDir: string): void {
  const retrySignal = new Int32Array(new SharedArrayBuffer(4))
  for (let attempt = 0; ; attempt += 1) {
    try {
      renameSync(stagingDir, targetDir)
      return
    } catch (error) {
      if (!matchesTransientWindowsRenameError(error) || attempt >= 4) {
        throw error
      }
      Atomics.wait(retrySignal, 0, 0, 100 * 2 ** attempt)
    }
  }
}

function matchesTransientWindowsRenameError(error: unknown): error is NodeJS.ErrnoException {
  return (
    process.platform === 'win32' &&
    error instanceof Error &&
    'code' in error &&
    (error.code === 'EPERM' || error.code === 'EACCES')
  )
}
