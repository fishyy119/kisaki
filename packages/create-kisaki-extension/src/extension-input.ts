import {
  EXTENSION_API_VERSION,
  EXTENSION_CATEGORIES,
  getRecommendedExtensionApiRange,
  isExtensionIdentifier,
  type ExtensionCategory
} from '@kisaki3/extension-api'
import { ScaffoldCliError } from './errors'
import {
  EXTENSION_STARTERS,
  EXTENSION_WEBVIEW_ADDONS,
  EXTENSION_WEBVIEW_FRAMEWORKS,
  type ExtensionPublishProvider,
  type ExtensionRepositoryLayout,
  type ExtensionStarter,
  type ExtensionWebviewAddon,
  type ExtensionWebviewFramework
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

/** Optional command flags supplied before interactive defaults are resolved. */
export interface ExtensionInputOptions {
  extensionId?: string
  packageName?: string
  extensionName?: string
  categories?: readonly string[]
  starter?: string
  webview?: string
  webviewAddons?: readonly string[]
  description?: string
  author?: string
  yes?: boolean
}

/** Fully resolved author choices for one generated extension. */
export interface ResolvedExtensionInput {
  extensionId: string
  packageName: string
  extensionName: string
  categories: readonly string[]
  starter: string
  webviewFramework: string
  webviewAddons: readonly string[]
  description: string
  author?: string
}

/** Defaults derived from a validated extension identifier. */
export interface ExtensionInputDefaults {
  packageName: string
  extensionName: string
  categories: readonly ExtensionCategory[]
  starter: ExtensionStarter
  webviewFramework: ExtensionWebviewFramework
  webviewAddons: readonly ExtensionWebviewAddon[]
  description: string
  author?: string
}

/** Context needed to turn resolved author input into a scaffold configuration. */
export interface CreateExtensionConfigOptions {
  projectName: string
  workspacePackageName: string
  repositoryLayout: ExtensionRepositoryLayout
  publishProvider: ExtensionPublishProvider
  registryId: string
  registryName: string
  toolingVersion: string
  packageManager?: string
  input: ResolvedExtensionInput
}

/** Creates the default extension identifier for a project name. */
export function createDefaultExtensionId(projectName: string): string {
  return toExtensionId(projectName)
}

/** Creates author-facing defaults after the extension id has been chosen. */
export function createExtensionDefaults(extensionId: string): ExtensionInputDefaults {
  const gitUserName = readGitUserName()
  return {
    packageName: toPackageName(extensionId),
    extensionName: toDisplayName(extensionId),
    categories: ['tool'],
    starter: 'tool',
    webviewFramework: 'none',
    webviewAddons: [],
    description: 'A Kisaki extension.',
    ...(gitUserName ? { author: gitUserName } : {})
  }
}

/** Validates resolved input and creates the complete scaffold configuration. */
export function createExtensionScaffoldConfig(
  options: CreateExtensionConfigOptions
): ExtensionScaffoldConfig {
  const extensionId = requireExtensionId(options.input.extensionId)
  const packageName = readString(options.input.packageName, 'Package name is required.')
  const extensionName = readString(options.input.extensionName, 'Display name is required.')
  const categories = requireCategories(options.input.categories)
  const starter = requireStarter(options.input.starter)
  const webviewFramework = requireWebviewFramework(options.input.webviewFramework)
  const webviewAddons = requireWebviewAddons(options.input.webviewAddons, webviewFramework)
  const description = readString(options.input.description, 'Description is required.')
  const author = readOptionalString(options.input.author)

  if (!matchesPackageNameFormat(packageName)) {
    throw new ScaffoldCliError('Package name is not a valid lowercase npm package name.')
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
    webviewFramework,
    webviewAddons,
    toolingVersion: options.toolingVersion,
    extensionApiRange: getRecommendedExtensionApiRange(EXTENSION_API_VERSION),
    nodeVersion: DEFAULT_NODE_VERSION,
    packageManager: options.packageManager ?? DEFAULT_PACKAGE_MANAGER,
    repositoryLayout: options.repositoryLayout,
    publishProvider: options.publishProvider,
    registryId: options.registryId,
    registryName: options.registryName
  }
}

function requireExtensionId(value: string): string {
  const extensionId = readString(value, 'Extension ID is required.')
  if (!isExtensionIdentifier(extensionId)) {
    throw new ScaffoldCliError('Extension ID must use lowercase dot-separated segments.')
  }
  return extensionId
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
