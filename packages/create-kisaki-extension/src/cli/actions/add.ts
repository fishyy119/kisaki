import path from 'node:path'
import { isExtensionIdentifier } from '@kisaki3/extension-api'
import { ScaffoldCliError } from '../../errors'
import { resolveExtensionConfig, type ExtensionInputOptions } from '../../extension-input'
import {
  commitGitPaths,
  installDependencies,
  matchesGitRepository,
  readExtensionWorkspace,
  scaffoldWorkspaceExtension
} from '../../scaffold'
import type { ScaffoldCliContext } from '../context'
import { printCreated } from './output'

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
  const workspace = readExtensionWorkspace(workspaceDir)
  if (!isExtensionIdentifier(workspace.registryId) || !workspace.registryName.trim()) {
    throw new ScaffoldCliError(
      'Registry manifest must declare a valid lowercase id and non-empty name.'
    )
  }

  const projectName = extensionId ?? options.extensionId ?? 'my-kisaki-extension'
  const config = await resolveExtensionConfig({
    projectName,
    workspacePackageName: workspace.packageName,
    repositoryLayout: 'monorepo',
    publishProvider: workspace.publishProvider,
    registryId: workspace.registryId,
    registryName: workspace.registryName,
    toolingVersion: context.toolingVersion,
    packageManager: workspace.packageManager,
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
