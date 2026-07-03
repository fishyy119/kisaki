import type { ExtensionCategory } from '@kisaki3/extension-api'
import type {
  ExtensionPublishProvider,
  ExtensionStarter,
  ExtensionWebviewAddon,
  ExtensionWebviewFramework
} from '../extension-options'

/** Complete, validated values for the generated registry workspace. */
export interface RepositoryScaffoldConfig {
  registryId: string
  registryName: string
  registryDescription: string
  workspacePackageName: string
  workspacePackageDescription: string
  toolingVersion: string
  nodeEngineRange: string
  packageManager: string
  publishProvider: ExtensionPublishProvider
}

/** Complete, validated values for one generated extension project. */
export interface ExtensionScaffoldConfig {
  extensionPackageName: string
  extensionId: string
  extensionName: string
  extensionDescription: string
  author?: string
  categories: readonly ExtensionCategory[]
  starter: ExtensionStarter
  webviewFramework: ExtensionWebviewFramework
  webviewAddons: readonly ExtensionWebviewAddon[]
  toolingVersion: string
  extensionApiRange: string
  nodeEngineRange: string
  packageManager: string
  publishProvider: ExtensionPublishProvider
}

/** Inputs for creating a new extension repository. */
export interface ScaffoldRepositoryOptions {
  repository: RepositoryScaffoldConfig
  templateDir: string
  targetDir: string
}

/** Inputs for adding one extension to an existing generated workspace. */
export interface ScaffoldWorkspaceExtensionOptions {
  extension: ExtensionScaffoldConfig
  templateDir: string
  workspaceDir: string
}
