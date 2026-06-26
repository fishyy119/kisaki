import path from 'node:path'
import { ScaffoldCliError } from '../../errors'
import { DEFAULT_EXTENSION_ID } from '../../extension-options'
import { createDefaultExtensionId, type ExtensionInputOptions } from '../../extension-input'
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

/** Adds an extension to an existing generated extension workspace. */
export async function runAdd(
  extensionId: string | undefined,
  options: AddOptions,
  context: ScaffoldCliContext
): Promise<void> {
  cliOutput.heading('kisaki-extension add', 'Adding an extension to an existing workspace.')
  if (options.commit && !options.install) {
    throw new ScaffoldCliError('--commit requires dependency installation.')
  }

  const workspaceDir = path.resolve(options.workspace)
  const workspace = readExtensionWorkspace(workspaceDir)

  const defaultExtensionId = createDefaultExtensionId(
    extensionId ?? options.extensionId ?? DEFAULT_EXTENSION_ID
  )
  const extension = await collectExtensionConfig({
    defaultExtensionId,
    publishProvider: workspace.publishProvider,
    toolingVersion: context.toolingVersion,
    packageManager: workspace.packageManager,
    input: { ...options, ...(extensionId ? { extensionId } : {}) },
    prompts: context.prompts
  })

  if (options.commit && !matchesGitRepository(workspaceDir)) {
    throw new ScaffoldCliError('--commit requires an existing Git repository.')
  }

  const targetDir = scaffoldWorkspaceExtension({
    extension,
    templateDir: context.templateDir,
    workspaceDir
  })
  if (options.install) {
    installDependencies(workspaceDir)
  }
  if (options.commit) {
    commitGitPaths(workspaceDir, `feat(extension): add ${extension.extensionId}`, [
      `extensions/${extension.extensionId}`,
      'README.md',
      'pnpm-lock.yaml'
    ])
  }

  printCreated(targetDir, options.install)
}
