import path from 'node:path'
import { isExtensionIdentifier } from '@kisaki3/extension-api'
import { ScaffoldCliError } from '../../errors'
import {
  DEFAULT_PROJECT_NAME,
  DEFAULT_PUBLISH_PROVIDER,
  DEFAULT_REPOSITORY_LAYOUT,
  PUBLISH_PROVIDER_OPTIONS,
  REPOSITORY_LAYOUT_OPTIONS,
  type OptionChoiceMetadata
} from '../../extension-options'
import type { ExtensionInputOptions } from '../../extension-input'
import type { ScaffoldPromptUi } from '../tui/prompts'
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
import { cliOutput, printCreated } from '../tui/output'
import { collectExtensionConfig } from '../wizard'

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
  cliOutput.heading('kisaki-extension init', 'Creating a new Kisaki extension repository.')
  if (options.commit && !options.git) {
    throw new ScaffoldCliError('--commit requires Git initialization.')
  }
  if (options.commit && !options.install) {
    throw new ScaffoldCliError('--commit requires dependency installation.')
  }

  const target = await resolveTarget(directory, options.yes === true, context)
  const projectName = target.projectName
  if (!matchesProjectNameFormat(projectName)) {
    throw new ScaffoldCliError('Project directory name is invalid.')
  }
  const repositoryLayout = await resolveEnumChoice({
    value: options.layout,
    yes: options.yes === true,
    options: REPOSITORY_LAYOUT_OPTIONS,
    fallback: DEFAULT_REPOSITORY_LAYOUT,
    prompts: context.prompts,
    message: 'Repository layout',
    errorMessage: 'Unknown repository layout'
  })
  const publishProvider = await resolveEnumChoice({
    value: options.provider,
    yes: options.yes === true,
    options: PUBLISH_PROVIDER_OPTIONS,
    fallback: DEFAULT_PUBLISH_PROVIDER,
    prompts: context.prompts,
    message: 'Release provider',
    errorMessage: 'Unknown release provider'
  })
  const targetDir = target.targetDir
  const registryId = options.registryId ?? toExtensionId(`${projectName}.registry`)
  if (!isExtensionIdentifier(registryId)) {
    throw new ScaffoldCliError('Registry ID must use lowercase dot-separated segments.')
  }
  const registryName = options.registryName ?? `${toDisplayName(projectName)} Extensions`

  const config = await collectExtensionConfig({
    projectName,
    workspacePackageName: toPackageName(projectName),
    repositoryLayout,
    publishProvider,
    registryId,
    registryName,
    toolingVersion: context.toolingVersion,
    input: options,
    prompts: context.prompts
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
  yes: boolean,
  context: ScaffoldCliContext
): Promise<{ projectName: string; targetDir: string }> {
  if (directory) {
    const targetDir = path.resolve(directory)
    return { projectName: path.basename(targetDir), targetDir }
  }
  if (yes) {
    return {
      projectName: DEFAULT_PROJECT_NAME,
      targetDir: path.resolve(DEFAULT_PROJECT_NAME)
    }
  }

  const projectName = await context.prompts.text({
    message: 'Project directory',
    initial: DEFAULT_PROJECT_NAME,
    validate: (value) =>
      matchesProjectNameFormat(value) ? true : 'Use a filesystem-safe directory name.'
  })
  return {
    projectName,
    targetDir: path.resolve(projectName)
  }
}

interface ResolveEnumChoiceOptions<T extends string> {
  value: string | undefined
  yes: boolean
  options: readonly OptionChoiceMetadata<T>[]
  fallback: T
  prompts: ScaffoldPromptUi
  message: string
  errorMessage: string
}

/**
 * Resolves one enumerated choice from an explicit flag, a default, or an
 * interactive prompt. Validates any explicit or prompted answer against the
 * accepted option values before returning it.
 */
async function resolveEnumChoice<T extends string>(
  options: ResolveEnumChoiceOptions<T>
): Promise<T> {
  if (options.value !== undefined) {
    return requireEnumChoice(options.value, options.options, options.errorMessage)
  }
  if (options.yes) {
    return options.fallback
  }

  const answer = await options.prompts.select({
    message: options.message,
    initial: options.fallback,
    choices: options.options.map((option) => ({
      value: option.value,
      label: option.label
    }))
  })
  return requireEnumChoice(answer, options.options, options.errorMessage)
}

function requireEnumChoice<T extends string>(
  value: string,
  options: readonly OptionChoiceMetadata<T>[],
  errorMessage: string
): T {
  const match = options.find((option) => option.value === value)
  if (!match) {
    throw new ScaffoldCliError(`${errorMessage}: ${value}`)
  }
  return match.value
}
