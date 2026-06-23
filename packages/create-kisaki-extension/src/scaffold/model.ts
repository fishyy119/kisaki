import type { ExtensionCategory } from '@kisaki3/extension-api'
import type {
  ExtensionPublishWorkflow,
  ExtensionStarter,
  ExtensionWebview
} from '../extension-options'

/** Complete, validated inputs for one generated extension project. */
export interface ExtensionScaffoldConfig {
  projectName: string
  workspacePackageName: string
  packageName: string
  extensionId: string
  extensionName: string
  description: string
  author?: string
  categories: readonly ExtensionCategory[]
  starter: ExtensionStarter
  webview: ExtensionWebview
  toolingVersion: string
  extensionApiRange: string
  nodeVersion: string
  packageManager: string
  publishWorkflow: ExtensionPublishWorkflow
  registryId: string
  registryName: string
}

/** Inputs for creating a new extension repository. */
export interface ScaffoldRepositoryOptions {
  config: ExtensionScaffoldConfig
  templateDir: string
  targetDir: string
}

/** Inputs for adding one extension to an existing generated monorepository. */
export interface ScaffoldWorkspaceExtensionOptions {
  config: ExtensionScaffoldConfig
  templateDir: string
  workspaceDir: string
}
