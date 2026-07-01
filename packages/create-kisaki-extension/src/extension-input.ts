import {
  EXTENSION_API_VERSION,
  EXTENSION_CATEGORIES,
  getRecommendedExtensionApiRange,
  type ExtensionCategory
} from '@kisaki3/extension-api'
import { ScaffoldCliError } from './errors'
import {
  EXTENSION_STARTERS,
  EXTENSION_WEBVIEW_ADDONS,
  EXTENSION_WEBVIEW_FRAMEWORKS,
  type ExtensionPublishProvider,
  type ExtensionStarter,
  type ExtensionWebviewAddon,
  type ExtensionWebviewFramework
} from './extension-options'
import {
  DEFAULT_NODE_ENGINE_RANGE,
  DEFAULT_PACKAGE_MANAGER,
  matchesExtensionIdFormat,
  matchesPackageNameFormat,
  matchesRegistryIdFormat,
  readGitUserName,
  toExtensionId,
  toPackageName,
  toReadableName,
  toRegistryId,
  type ExtensionScaffoldConfig,
  type RepositoryScaffoldConfig
} from './scaffold'

/** Optional author intent supplied before interactive defaults are resolved. */
export interface ExtensionInputOptions {
  extensionId?: string
  extensionName?: string
  categories?: readonly string[]
  starter?: string
  webview?: string
  webviewAddons?: readonly string[]
  description?: string
  author?: string
  yes?: boolean
}

/** Optional registry intent collected only by repository initialization. */
export interface RegistryInputOptions {
  registryId?: string
  registryName?: string
  registryDescription?: string
}

/** Resolved registry identity before generated package metadata is derived. */
export interface ResolvedRegistryInput {
  registryId: string
  registryName: string
  registryDescription: string
}

/** Fully resolved author choices for one generated extension. */
export interface ResolvedExtensionInput {
  extensionId: string
  extensionName: string
  categories: readonly string[]
  starter: string
  webviewFramework: string
  webviewAddons: readonly string[]
  extensionDescription: string
  author?: string
}

/** Defaults derived from a validated extension identifier. */
export interface ExtensionInputDefaults {
  extensionName: string
  categories: readonly ExtensionCategory[]
  starter: ExtensionStarter
  webviewFramework: ExtensionWebviewFramework
  webviewAddons: readonly ExtensionWebviewAddon[]
  extensionDescription: string
  author?: string
}

/** Context needed to turn resolved registry input into scaffold configuration. */
export interface CreateRepositoryConfigOptions {
  publishProvider: ExtensionPublishProvider
  toolingVersion: string
  packageManager?: string
  input: ResolvedRegistryInput
}

/** Context needed to turn resolved extension input into scaffold configuration. */
export interface CreateExtensionConfigOptions {
  publishProvider: ExtensionPublishProvider
  toolingVersion: string
  packageManager?: string
  input: ResolvedExtensionInput
}

/** Creates the default registry identifier for a repository directory name. */
export function createDefaultRegistryId(repositoryName: string): string {
  return toRegistryId(repositoryName)
}

/** Creates the default registry name for a repository directory name. */
export function createDefaultRegistryName(repositoryName: string): string {
  return toReadableName(repositoryName)
}

/** Creates the default registry description from the resolved registry name. */
export function createDefaultRegistryDescription(registryName: string): string {
  return `Kisaki extension registry for ${registryName}.`
}

/** Creates the default extension identifier for a repository or extension name. */
export function createDefaultExtensionId(value: string): string {
  return toExtensionId(value)
}

/** Creates author-facing defaults after the extension id has been chosen. */
export function createExtensionDefaults(extensionId: string): ExtensionInputDefaults {
  const gitUserName = readGitUserName()
  return {
    extensionName: toReadableName(extensionId),
    categories: ['tool'],
    starter: 'tool',
    webviewFramework: 'none',
    webviewAddons: [],
    extensionDescription: 'A Kisaki extension.',
    ...(gitUserName ? { author: gitUserName } : {})
  }
}

/** Validates registry input and derives generated workspace metadata. */
export function createRepositoryScaffoldConfig(
  options: CreateRepositoryConfigOptions
): RepositoryScaffoldConfig {
  const registryId = requireRegistryId(
    options.input.registryId,
    'Registry ID is required.',
    'Registry ID must use lowercase dot-separated segments.'
  )
  const registryName = readString(options.input.registryName, 'Registry name is required.')
  const registryDescription = readString(
    options.input.registryDescription,
    'Registry description is required.'
  )
  const workspacePackageName = toPackageName(registryId)
  const workspacePackageDescription = registryDescription

  if (!matchesPackageNameFormat(workspacePackageName)) {
    throw new ScaffoldCliError(
      'Derived workspace package name is not a valid lowercase npm package name.'
    )
  }

  return {
    registryId,
    registryName,
    registryDescription,
    workspacePackageName,
    workspacePackageDescription,
    toolingVersion: options.toolingVersion,
    nodeEngineRange: DEFAULT_NODE_ENGINE_RANGE,
    packageManager: options.packageManager ?? DEFAULT_PACKAGE_MANAGER,
    publishProvider: options.publishProvider
  }
}

/** Validates resolved input and creates the complete extension scaffold config. */
export function createExtensionScaffoldConfig(
  options: CreateExtensionConfigOptions
): ExtensionScaffoldConfig {
  const extensionId = requireExtensionId(
    options.input.extensionId,
    'Extension ID is required.',
    'Extension ID must use lowercase dot-separated segments.'
  )
  const extensionPackageName = toPackageName(extensionId)
  const extensionName = readString(options.input.extensionName, 'Extension name is required.')
  const categories = requireCategories(options.input.categories)
  const starter = requireStarter(options.input.starter)
  const webviewFramework = requireWebviewFramework(options.input.webviewFramework)
  const webviewAddons = requireWebviewAddons(options.input.webviewAddons, webviewFramework)
  const extensionDescription = readString(
    options.input.extensionDescription,
    'Extension description is required.'
  )
  const author = readOptionalString(options.input.author)

  if (!matchesPackageNameFormat(extensionPackageName)) {
    throw new ScaffoldCliError(
      'Derived extension package name is not a valid lowercase npm package name.'
    )
  }

  return {
    extensionPackageName,
    extensionId,
    extensionName,
    extensionDescription,
    ...(author ? { author } : {}),
    categories,
    starter,
    webviewFramework,
    webviewAddons,
    toolingVersion: options.toolingVersion,
    extensionApiRange: getRecommendedExtensionApiRange(EXTENSION_API_VERSION),
    nodeEngineRange: DEFAULT_NODE_ENGINE_RANGE,
    packageManager: options.packageManager ?? DEFAULT_PACKAGE_MANAGER,
    publishProvider: options.publishProvider
  }
}

function requireRegistryId(value: string, missingMessage: string, invalidMessage: string): string {
  return requireIdFormat(value, matchesRegistryIdFormat, missingMessage, invalidMessage)
}

function requireExtensionId(value: string, missingMessage: string, invalidMessage: string): string {
  return requireIdFormat(value, matchesExtensionIdFormat, missingMessage, invalidMessage)
}

function requireIdFormat(
  value: string,
  matchesFormat: (value: string) => boolean,
  missingMessage: string,
  invalidMessage: string
): string {
  const identifier = readString(value, missingMessage)
  if (!matchesFormat(identifier)) {
    throw new ScaffoldCliError(invalidMessage)
  }
  return identifier
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

function requireWebviewFramework(value: string): ExtensionWebviewFramework {
  if (!(EXTENSION_WEBVIEW_FRAMEWORKS as readonly string[]).includes(value)) {
    throw new ScaffoldCliError(`Unknown webview framework: ${value}`)
  }
  return value as ExtensionWebviewFramework
}

function requireWebviewAddons(
  values: readonly string[],
  webviewFramework: ExtensionWebviewFramework
): readonly ExtensionWebviewAddon[] {
  const requested = new Set(values.map((value) => value.trim()).filter(Boolean))
  for (const addon of requested) {
    if (!(EXTENSION_WEBVIEW_ADDONS as readonly string[]).includes(addon)) {
      throw new ScaffoldCliError(`Unknown webview addon: ${addon}`)
    }
  }
  const addons = EXTENSION_WEBVIEW_ADDONS.filter((addon) => requested.has(addon))
  if (addons.length > 0 && webviewFramework === 'none') {
    throw new ScaffoldCliError('--webview-addon requires a webview framework.')
  }
  if (addons.includes('kisaki-ui-vue') && webviewFramework !== 'vue') {
    throw new ScaffoldCliError('--webview-addon kisaki-ui-vue requires --webview vue.')
  }
  return addons
}

function readString(value: string, errorMessage: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new ScaffoldCliError(errorMessage)
  }
  return trimmed
}

function readOptionalString(value: string | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
