import path from 'node:path'
import { isExtensionIdentifier } from '@kisaki3/extension-api'
import prompts from 'prompts'
import { ScaffoldCancelledError, ScaffoldCliError } from '../../errors'
import {
  EXTENSION_PUBLISH_PROVIDERS,
  EXTENSION_REPOSITORY_LAYOUTS,
  type ExtensionPublishProvider,
  type ExtensionRepositoryLayout
} from '../../extension-options'
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
  layout?: string
  provider?: string
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
  const repositoryLayout = await resolveRepositoryLayout(options.layout, options.yes === true)
  const publishProvider = await resolvePublishProvider(options.provider, options.yes === true)
  const targetDir = target.targetDir
  const registryId = options.registryId ?? toExtensionId(`${projectName}.registry`)
  if (!isExtensionIdentifier(registryId)) {
    throw new ScaffoldCliError('Registry ID must use lowercase dot-separated segments.')
  }
  const registryName = options.registryName ?? `${toDisplayName(projectName)} Extensions`

  const config = await resolveExtensionConfig({
    projectName,
    workspacePackageName: toPackageName(projectName),
    repositoryLayout,
    publishProvider,
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

async function resolveRepositoryLayout(
  value: string | undefined,
  yes: boolean
): Promise<ExtensionRepositoryLayout> {
  if (value !== undefined) {
    return requireRepositoryLayout(value)
  }
  if (yes) {
    return 'single'
  }

  const response = await prompts(
    {
      type: 'select',
      name: 'layout',
      message: 'Repository layout:',
      initial: 0,
      choices: [
        { title: 'Single extension', value: 'single' },
        { title: 'Extension monorepo', value: 'monorepo' }
      ]
    },
    {
      onCancel: () => {
        throw new ScaffoldCancelledError()
      }
    }
  )
  return requireRepositoryLayout(response.layout)
}

async function resolvePublishProvider(
  value: string | undefined,
  yes: boolean
): Promise<ExtensionPublishProvider> {
  if (value !== undefined) {
    return requirePublishProvider(value)
  }
  if (yes) {
    return 'github'
  }

  const response = await prompts(
    {
      type: 'select',
      name: 'provider',
      message: 'Release provider:',
      initial: 0,
      choices: [
        { title: 'GitHub Releases and registry workflow', value: 'github' },
        { title: 'Manual or custom hosting', value: 'manual' }
      ]
    },
    {
      onCancel: () => {
        throw new ScaffoldCancelledError()
      }
    }
  )
  return requirePublishProvider(response.provider)
}

function requireRepositoryLayout(value: string): ExtensionRepositoryLayout {
  if (!(EXTENSION_REPOSITORY_LAYOUTS as readonly string[]).includes(value)) {
    throw new ScaffoldCliError(`Unknown repository layout: ${value}`)
  }
  return value as ExtensionRepositoryLayout
}

function requirePublishProvider(value: string): ExtensionPublishProvider {
  if (!(EXTENSION_PUBLISH_PROVIDERS as readonly string[]).includes(value)) {
    throw new ScaffoldCliError(`Unknown release provider: ${value}`)
  }
  return value as ExtensionPublishProvider
}
