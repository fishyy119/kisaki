import path from 'node:path'
import { isExtensionIdentifier } from '@kisaki3/extension-api'
import prompts from 'prompts'
import { ScaffoldCancelledError, ScaffoldCliError } from '../../errors'
import { EXTENSION_PUBLISH_WORKFLOWS, type ExtensionPublishWorkflow } from '../../extension-options'
import { resolveExtensionConfig, type ExtensionInputOptions } from '../../extension-input'
import {
  commitGitChanges,
  initializeGitRepository,
  installDependencies,
  matchesProjectNameFormat,
  scaffoldRepository,
  toDisplayName,
  toExtensionId,
  toPackageName
} from '../../scaffold'
import type { ScaffoldCliContext } from '../context'
import { printCreated } from './output'

/** Input accepted by the repository initialization action. */
export interface InitOptions extends ExtensionInputOptions {
  publish?: string
  registryId?: string
  registryName?: string
  git: boolean
  install: boolean
  commit?: boolean
}

/** Creates a new single-extension repository or extension monorepository. */
export async function runInit(
  directory: string | undefined,
  options: InitOptions,
  context: ScaffoldCliContext
): Promise<void> {
  if (options.commit && !options.git) {
    throw new ScaffoldCliError('--commit requires Git initialization.')
  }
  if (options.commit && !options.install) {
    throw new ScaffoldCliError('--commit requires dependency installation.')
  }

  const target = await resolveTarget(directory, options.yes === true)
  const projectName = target.projectName
  if (!matchesProjectNameFormat(projectName)) {
    throw new ScaffoldCliError('Project directory name is invalid.')
  }
  const publishWorkflow = await resolvePublishWorkflow(options.publish, options.yes === true)
  const targetDir = target.targetDir
  const registryId = options.registryId ?? toExtensionId(`${projectName}.registry`)
  if (!isExtensionIdentifier(registryId)) {
    throw new ScaffoldCliError('Registry ID must use lowercase dot-separated segments.')
  }
  const registryName = options.registryName ?? `${toDisplayName(projectName)} Extensions`

  const config = await resolveExtensionConfig({
    projectName,
    workspacePackageName: toPackageName(projectName),
    publishWorkflow,
    registryId,
    registryName,
    toolingVersion: context.toolingVersion,
    input: options
  })

  scaffoldRepository({ config, templateDir: context.templateDir, targetDir })
  if (options.install) {
    installDependencies(targetDir)
  }
  if (options.git) {
    initializeGitRepository(targetDir)
  }
  if (options.commit) {
    commitGitChanges(targetDir, `Initial commit: ${registryName}`)
  }

  printCreated(targetDir, options.install)
}

async function resolveTarget(
  directory: string | undefined,
  yes: boolean
): Promise<{ projectName: string; targetDir: string }> {
  if (directory) {
    const targetDir = path.resolve(directory)
    return { projectName: path.basename(targetDir), targetDir }
  }
  if (yes) {
    return {
      projectName: 'my-kisaki-extension',
      targetDir: path.resolve('my-kisaki-extension')
    }
  }

  const response = await prompts(
    {
      type: 'text',
      name: 'projectName',
      message: 'Project directory:',
      initial: 'my-kisaki-extension',
      validate: (value: string) =>
        matchesProjectNameFormat(value) ? true : 'Use a filesystem-safe directory name.'
    },
    {
      onCancel: () => {
        throw new ScaffoldCancelledError()
      }
    }
  )
  return {
    projectName: response.projectName,
    targetDir: path.resolve(response.projectName)
  }
}

async function resolvePublishWorkflow(
  value: string | undefined,
  yes: boolean
): Promise<ExtensionPublishWorkflow> {
  if (value !== undefined) {
    return requirePublishWorkflow(value)
  }
  if (yes) {
    return 'github-single'
  }

  const response = await prompts(
    {
      type: 'select',
      name: 'publish',
      message: 'Repository layout and publishing:',
      initial: 0,
      choices: [
        { title: 'GitHub single extension', value: 'github-single' },
        { title: 'GitHub extension monorepo', value: 'github-monorepo' },
        { title: 'Manual or custom hosting', value: 'manual' }
      ]
    },
    {
      onCancel: () => {
        throw new ScaffoldCancelledError()
      }
    }
  )
  return requirePublishWorkflow(response.publish)
}

function requirePublishWorkflow(value: string): ExtensionPublishWorkflow {
  if (!(EXTENSION_PUBLISH_WORKFLOWS as readonly string[]).includes(value)) {
    throw new ScaffoldCliError(`Unknown publish workflow: ${value}`)
  }
  return value as ExtensionPublishWorkflow
}
