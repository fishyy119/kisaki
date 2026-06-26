import path from 'node:path'
import { isExtensionIdentifier } from '@kisaki3/extension-api'
import { ScaffoldCliError } from '../../errors'
import { DEFAULT_PROJECT_NAME } from '../../extension-options'
import type { ExtensionInputOptions } from '../../extension-input'
import {
  commitGitPaths,
  installDependencies,
  matchesGitRepository,
  readExtensionWorkspace,
  scaffoldWorkspaceExtension
} from '../../scaffold'
import type { ScaffoldCliContext } from '../context'
import { cliOutput, printCreated } from '../tui/output'
import { collectExtensionConfig } from '../wizard'

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
  cliOutput.heading('kisaki-extension add', 'Adding an extension to an existing monorepository.')
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

  const projectName = extensionId ?? options.extensionId ?? DEFAULT_PROJECT_NAME
  const config = await collectExtensionConfig({
    projectName,
    workspacePackageName: workspace.packageName,
    repositoryLayout: 'monorepo',
    publishProvider: workspace.publishProvider,
    registryId: workspace.registryId,
    registryName: workspace.registryName,
    toolingVersion: context.toolingVersion,
    packageManager: workspace.packageManager,
    input: { ...options, ...(extensionId ? { extensionId } : {}) },
    prompts: context.prompts
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
