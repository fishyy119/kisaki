import {
  EXTENSION_CATEGORIES,
  EXTENSION_API_VERSION,
  getRecommendedExtensionApiRange,
  isExtensionIdentifier,
  type ExtensionCategory
} from '@kisaki3/extension-api'
import prompts from 'prompts'
import { ScaffoldCancelledError, ScaffoldCliError } from './errors'
import {
  EXTENSION_STARTERS,
  EXTENSION_WEBVIEWS,
  type ExtensionPublishWorkflow,
  type ExtensionStarter,
  type ExtensionWebview
} from './extension-options'
import {
  DEFAULT_NODE_VERSION,
  DEFAULT_PACKAGE_MANAGER,
  matchesPackageNameFormat,
  readGitUserName,
  toDisplayName,
  toExtensionId,
  toPackageName,
  type ExtensionScaffoldConfig
} from './scaffold'

/** Optional flags supplied before interactive defaults are resolved. */
export interface ExtensionInputOptions {
  extensionId?: string
  packageName?: string
  extensionName?: string
  categories?: readonly string[]
  starter?: string
  webview?: string
  description?: string
  author?: string
  yes?: boolean
}

/** Context needed to turn command input into a complete scaffold configuration. */
export interface ResolveExtensionConfigOptions {
  projectName: string
  workspacePackageName: string
  publishWorkflow: ExtensionPublishWorkflow
  registryId: string
  registryName: string
  toolingVersion: string
  packageManager?: string
  input: ExtensionInputOptions
}

type PromptQuestion = prompts.PromptObject

/** Resolves flags and interactive answers into one validated scaffold configuration. */
export async function resolveExtensionConfig(
  options: ResolveExtensionConfigOptions
): Promise<ExtensionScaffoldConfig> {
  const defaults = createDefaults(options)
  const response = options.input.yes
    ? {}
    : await prompts(createQuestions(options.input, defaults), {
        onCancel: () => {
          throw new ScaffoldCancelledError()
        }
      })

  const extensionId = readString(options.input.extensionId ?? response.extensionId, defaults.id)
  const packageName = readString(
    options.input.packageName ?? response.packageName,
    defaults.packageName
  )
  const extensionName = readString(
    options.input.extensionName ?? response.extensionName,
    defaults.name
  )
  const categories = requireCategories(
    options.input.categories ?? response.categories ?? defaults.categories
  )
  const starter = requireStarter(options.input.starter ?? response.starter ?? defaults.starter)
  const webview = requireWebview(options.input.webview ?? response.webview ?? defaults.webview)
  const description = readString(
    options.input.description ?? response.description,
    defaults.description
  )
  const author = readOptionalString(options.input.author ?? response.author ?? defaults.author)

  if (!isExtensionIdentifier(extensionId)) {
    throw new ScaffoldCliError('Extension ID must use lowercase dot-separated segments.')
  }
  if (!matchesPackageNameFormat(packageName)) {
    throw new ScaffoldCliError('Package name is not a valid lowercase npm package name.')
  }
  if (!extensionName) {
    throw new ScaffoldCliError('Display name is required.')
  }

  return {
    projectName: options.projectName,
    workspacePackageName: options.workspacePackageName,
    packageName,
    extensionId,
    extensionName,
    description,
    ...(author ? { author } : {}),
    categories,
    starter,
    webview,
    toolingVersion: options.toolingVersion,
    extensionApiRange: getRecommendedExtensionApiRange(EXTENSION_API_VERSION),
    nodeVersion: DEFAULT_NODE_VERSION,
    packageManager: options.packageManager ?? DEFAULT_PACKAGE_MANAGER,
    publishWorkflow: options.publishWorkflow,
    registryId: options.registryId,
    registryName: options.registryName
  }
}

function createDefaults(options: ResolveExtensionConfigOptions): {
  id: string
  packageName: string
  name: string
  categories: readonly ExtensionCategory[]
  starter: ExtensionStarter
  webview: ExtensionWebview
  description: string
  author?: string
} {
  const id = toExtensionId(options.projectName)
  const gitUserName = readGitUserName()
  return {
    id,
    packageName:
      options.publishWorkflow === 'github-monorepo' ? id : toPackageName(options.projectName),
    name: toDisplayName(id),
    categories: ['tool'],
    starter: 'tool',
    webview: 'none',
    description: 'A Kisaki extension.',
    ...(gitUserName ? { author: gitUserName } : {})
  }
}

function createQuestions(
  input: ExtensionInputOptions,
  defaults: ReturnType<typeof createDefaults>
): PromptQuestion[] {
  const questions: PromptQuestion[] = []
  if (input.extensionId === undefined) {
    questions.push({
      type: 'text',
      name: 'extensionId',
      message: 'Extension ID:',
      initial: defaults.id,
      validate: (value: string) =>
        isExtensionIdentifier(value) ? true : 'Use lowercase dot-separated segments.'
    })
  }
  if (input.packageName === undefined) {
    questions.push({
      type: 'text',
      name: 'packageName',
      message: 'Package name:',
      initial: defaults.packageName,
      validate: (value: string) =>
        matchesPackageNameFormat(value) ? true : 'Use a lowercase npm package name.'
    })
  }
  if (input.extensionName === undefined) {
    questions.push({
      type: 'text',
      name: 'extensionName',
      message: 'Display name:',
      initial: defaults.name,
      validate: (value: string) => (value.trim() ? true : 'Display name is required.')
    })
  }
  if (input.categories === undefined) {
    questions.push({
      type: 'multiselect',
      name: 'categories',
      message: 'Categories:',
      min: 1,
      choices: EXTENSION_CATEGORIES.map((category) => ({
        title: category,
        value: category,
        selected: defaults.categories.includes(category)
      }))
    })
  }
  if (input.starter === undefined) {
    questions.push({
      type: 'select',
      name: 'starter',
      message: 'Starter:',
      initial: EXTENSION_STARTERS.indexOf(defaults.starter),
      choices: EXTENSION_STARTERS.map((starter) => ({ title: starter, value: starter }))
    })
  }
  if (input.webview === undefined) {
    questions.push({
      type: 'select',
      name: 'webview',
      message: 'Webview:',
      initial: 0,
      choices: [
        { title: 'None', value: 'none' },
        { title: 'Vue + Kisaki UI Kit', value: 'vue-kit' },
        { title: 'Vue', value: 'vue' },
        { title: 'Vanilla TypeScript', value: 'vanilla' }
      ]
    })
  }
  if (input.description === undefined) {
    questions.push({
      type: 'text',
      name: 'description',
      message: 'Description:',
      initial: defaults.description
    })
  }
  if (input.author === undefined) {
    questions.push({
      type: 'text',
      name: 'author',
      message: 'Author:',
      initial: defaults.author ?? ''
    })
  }
  return questions
}

function requireCategories(values: readonly string[]): readonly ExtensionCategory[] {
  const requested = new Set(values.map((value) => value.trim()).filter(Boolean))
  if (requested.size === 0) {
    throw new ScaffoldCliError('At least one extension category is required.')
  }
  for (const category of requested) {
    if (!(EXTENSION_CATEGORIES as readonly string[]).includes(category)) {
      throw new ScaffoldCliError(`Unknown extension category: ${category}`)
    }
  }
  return EXTENSION_CATEGORIES.filter((category) => requested.has(category))
}

function requireStarter(value: string): ExtensionStarter {
  if (!(EXTENSION_STARTERS as readonly string[]).includes(value)) {
    throw new ScaffoldCliError(`Unknown starter: ${value}`)
  }
  return value as ExtensionStarter
}

function requireWebview(value: string): ExtensionWebview {
  if (!(EXTENSION_WEBVIEWS as readonly string[]).includes(value)) {
    throw new ScaffoldCliError(`Unknown webview implementation: ${value}`)
  }
  return value as ExtensionWebview
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
