import path from 'node:path'
import { ScaffoldCliError } from '../../errors'
import {
  createDefaultRegistryDescription,
  createDefaultRegistryId,
  createDefaultRegistryName,
  createDefaultExtensionId,
  createRepositoryScaffoldConfig,
  type ExtensionInputOptions,
  type RegistryInputOptions,
  type ResolvedRegistryInput
} from '../../extension-input'
import {
  DEFAULT_REPOSITORY_NAME,
  DEFAULT_PUBLISH_PROVIDER,
  PUBLISH_PROVIDER_OPTIONS,
  type ExtensionPublishProvider
} from '../../extension-options'
import type { ScaffoldPromptUi } from '../tui/prompts'
import {
  commitGitChanges,
  initializeGitRepository,
  installDependencies,
  matchesRegistryIdFormat,
  matchesRepositoryNameFormat,
  scaffoldRepository
} from '../../scaffold'
import type { ScaffoldCliContext } from '../context'
import { cliOutput, printCreated } from '../tui/output'
import { collectExtensionConfig } from '../wizard'

/** Input accepted by the repository initialization action. */
export interface InitOptions extends ExtensionInputOptions, RegistryInputOptions {
  provider?: string
  git: boolean
  install: boolean
  commit?: boolean
}

/** Creates a new Kisaki extension repository. */
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
  const repositoryName = target.repositoryName
  if (!matchesRepositoryNameFormat(repositoryName)) {
    throw new ScaffoldCliError('Repository directory name is invalid.')
  }
  const publishProvider = await resolvePublishProvider({
    value: options.provider,
    yes: options.yes === true,
    prompts: context.prompts
  })
  const repository = createRepositoryScaffoldConfig({
    publishProvider,
    toolingVersion: context.toolingVersion,
    input: await collectRegistryMetadata({
      repositoryName,
      input: options,
      yes: options.yes === true,
      prompts: context.prompts
    })
  })

  const extension = await collectExtensionConfig({
    defaultExtensionId: createDefaultExtensionId(repositoryName),
    publishProvider,
    toolingVersion: context.toolingVersion,
    packageManager: repository.packageManager,
    input: options,
    prompts: context.prompts
  })

  scaffoldRepository({
    repository,
    extension,
    templateDir: context.templateDir,
    targetDir: target.targetDir
  })
  if (options.install) {
    installDependencies(target.targetDir)
  }
  if (options.git) {
    initializeGitRepository(target.targetDir)
  }
  if (options.commit) {
    commitGitChanges(target.targetDir, `Initial commit: ${repository.registryName}`)
  }

  printCreated(target.targetDir, options.install)
}

async function collectRegistryMetadata(
  options: CollectRegistryMetadataOptions
): Promise<ResolvedRegistryInput> {
  const registryId = await resolveRegistryField({
    value: options.input.registryId,
    yes: options.yes,
    fallback: createDefaultRegistryId(options.repositoryName),
    prompts: options.prompts,
    message: 'Registry ID',
    validate: (value) =>
      matchesRegistryIdFormat(value) ? true : 'Use lowercase dot-separated segments.'
  })
  const registryName = await resolveRegistryField({
    value: options.input.registryName,
    yes: options.yes,
    fallback: createDefaultRegistryName(options.repositoryName),
    prompts: options.prompts,
    message: 'Registry name',
    validate: (value) => (value.trim() ? true : 'Registry name is required.')
  })
  const registryDescription = await resolveRegistryField({
    value: options.input.registryDescription,
    yes: options.yes,
    fallback: createDefaultRegistryDescription(registryName),
    prompts: options.prompts,
    message: 'Registry description',
    validate: (value) => (value.trim() ? true : 'Registry description is required.')
  })

  return {
    registryId,
    registryName,
    registryDescription
  }
}

async function resolvePublishProvider(options: {
  value: string | undefined
  yes: boolean
  prompts: ScaffoldPromptUi
}): Promise<ExtensionPublishProvider> {
  if (options.value !== undefined) {
    return requirePublishProvider(options.value)
  }
  if (options.yes) {
    return DEFAULT_PUBLISH_PROVIDER
  }

  const answer = await options.prompts.select({
    message: 'Release provider',
    initial: DEFAULT_PUBLISH_PROVIDER,
    choices: PUBLISH_PROVIDER_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label
    }))
  })
  return requirePublishProvider(answer)
}

function requirePublishProvider(value: string): ExtensionPublishProvider {
  const match = PUBLISH_PROVIDER_OPTIONS.find((option) => option.value === value)
  if (!match) {
    throw new ScaffoldCliError(`Unknown release provider: ${value}`)
  }
  return match.value
}

async function resolveTarget(
  directory: string | undefined,
  yes: boolean,
  context: ScaffoldCliContext
): Promise<{ repositoryName: string; targetDir: string }> {
  if (directory) {
    const targetDir = path.resolve(directory)
    return { repositoryName: path.basename(targetDir), targetDir }
  }
  if (yes) {
    return {
      repositoryName: DEFAULT_REPOSITORY_NAME,
      targetDir: path.resolve(DEFAULT_REPOSITORY_NAME)
    }
  }

  const repositoryName = await context.prompts.text({
    message: 'Repository directory',
    initial: DEFAULT_REPOSITORY_NAME,
    validate: (value) =>
      matchesRepositoryNameFormat(value) ? true : 'Use a filesystem-safe directory name.'
  })
  return {
    repositoryName,
    targetDir: path.resolve(repositoryName)
  }
}

interface CollectRegistryMetadataOptions {
  repositoryName: string
  input: RegistryInputOptions
  yes: boolean
  prompts: ScaffoldPromptUi
}

interface ResolveRegistryFieldOptions {
  value: string | undefined
  yes: boolean
  fallback: string
  prompts: ScaffoldPromptUi
  message: string
  validate?: (value: string) => boolean | string
}

async function resolveRegistryField(options: ResolveRegistryFieldOptions): Promise<string> {
  if (options.value !== undefined) {
    return options.value
  }
  if (options.yes) {
    return options.fallback
  }
  return options.prompts.text({
    message: options.message,
    initial: options.fallback,
    ...(options.validate ? { validate: options.validate } : {})
  })
}
