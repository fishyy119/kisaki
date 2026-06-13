import { existsSync, mkdirSync } from 'node:fs'
import type { ExtensionCategory } from '@kisaki3/extension-api'
import { initGit } from './git'
import { copyTemplateLayer, createTemplateContext, createTemplateLayers } from './layers'

export { isProjectName, toDisplayName, toExtensionId, toPackageName } from './names'

export const EXTENSION_PUBLISH_WORKFLOWS = ['manual', 'github-single', 'github-monorepo'] as const

export type ExtensionPublishWorkflow = (typeof EXTENSION_PUBLISH_WORKFLOWS)[number]

export const EXTENSION_UI_VARIANTS = ['none', 'vanilla', 'vue', 'vue-kit'] as const

export type ExtensionUiVariant = (typeof EXTENSION_UI_VARIANTS)[number]

export interface ExtensionScaffoldConfig {
  projectName: string
  packageName: string
  extensionId: string
  extensionName: string
  description: string
  author: string
  category: ExtensionCategory
  uiVariant: ExtensionUiVariant
  toolingVersion: string
  extensionApiRange: string
  publishWorkflow: ExtensionPublishWorkflow
  registryId: string
  registryName: string
}

export interface ScaffoldExtensionOptions {
  config: ExtensionScaffoldConfig
  templateDir: string
  targetDir: string
  git: boolean
}

export interface ScaffoldExtensionResult {
  gitInitialized: boolean
  initialCommitCreated: boolean
  gitRequested: boolean
}

/**
 * Scaffolds an extension project by stacking template layers. Layers copy
 * token-rendered files; `<name>.patch.json` layer files deep-merge into the
 * `<name>.json` produced by earlier layers instead of being copied.
 */
export function scaffoldExtension(options: ScaffoldExtensionOptions): ScaffoldExtensionResult {
  if (!existsSync(options.templateDir)) {
    throw new Error(`Template directory not found: ${options.templateDir}`)
  }

  if (existsSync(options.targetDir)) {
    throw new Error(`Directory already exists: ${options.config.projectName}`)
  }

  const templateContext = createTemplateContext(options.templateDir, options.config)
  mkdirSync(options.targetDir, { recursive: true })

  for (const layer of createTemplateLayers(
    options.templateDir,
    options.targetDir,
    options.config
  )) {
    copyTemplateLayer(layer, templateContext)
  }

  const gitResult = options.git
    ? initGit(options.targetDir, options.config.extensionName)
    : { gitInitialized: false, initialCommitCreated: false }

  return { ...gitResult, gitRequested: options.git }
}
