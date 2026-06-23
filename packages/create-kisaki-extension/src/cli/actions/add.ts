import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isExtensionIdentifier } from '@kisaki3/extension-api'
import { ScaffoldCliError } from '../../errors'
import { resolveExtensionConfig, type ExtensionInputOptions } from '../../extension-input'
import {
  commitGitPaths,
  installDependencies,
  matchesGitRepository,
  scaffoldWorkspaceExtension,
  validateExtensionWorkspace
} from '../../scaffold'
import type { ScaffoldCliContext } from '../context'
import { printCreated } from './output'

interface WorkspacePackageJson {
  name?: string
  packageManager?: string
}

interface RegistryManifest {
  id?: string
  name?: string
}

/** Input accepted by the action that adds a workspace extension. */
export interface AddOptions extends ExtensionInputOptions {
  workspace: string
  install: boolean
  commit?: boolean
}

/** Adds an extension to an existing generated extension monorepository. */
export async function runAdd(
  extensionId: string | undefined,
  options: AddOptions,
  context: ScaffoldCliContext
): Promise<void> {
  if (options.commit && !options.install) {
    throw new ScaffoldCliError('--commit requires dependency installation.')
  }

  const workspaceDir = path.resolve(options.workspace)
  validateExtensionWorkspace(workspaceDir)
  const packageJson = readJson<WorkspacePackageJson>(path.join(workspaceDir, 'package.json'))
  const registry = readJson<RegistryManifest>(path.join(workspaceDir, 'registry', 'manifest.json'))
  if (!packageJson.name || !packageJson.packageManager) {
    throw new ScaffoldCliError(
      'Workspace package.json must declare name and packageManager fields.'
    )
  }
  if (!registry.id || !isExtensionIdentifier(registry.id) || !registry.name?.trim()) {
    throw new ScaffoldCliError(
      'Registry manifest must declare a valid lowercase id and non-empty name.'
    )
  }

  const projectName = extensionId ?? options.extensionId ?? 'my-kisaki-extension'
  const config = await resolveExtensionConfig({
    projectName,
    workspacePackageName: packageJson.name,
    publishWorkflow: 'github-monorepo',
    registryId: registry.id,
    registryName: registry.name,
    toolingVersion: context.toolingVersion,
    packageManager: packageJson.packageManager,
    input: { ...options, ...(extensionId ? { extensionId } : {}) }
  })

  if (options.commit && !matchesGitRepository(workspaceDir)) {
    throw new ScaffoldCliError('--commit requires an existing Git repository.')
  }

  const targetDir = scaffoldWorkspaceExtension({
    config,
    templateDir: context.templateDir,
    workspaceDir
  })
  if (options.install) {
    installDependencies(workspaceDir)
  }
  if (options.commit) {
    commitGitPaths(workspaceDir, `feat(extension): add ${config.extensionId}`, [
      `extensions/${config.extensionId}`,
      'README.md',
      'pnpm-lock.yaml'
    ])
  }

  printCreated(targetDir, options.install)
}

function readJson<T>(filePath: string): T {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error'
    throw new ScaffoldCliError(`Could not read ${filePath}: ${detail}`)
  }
}
