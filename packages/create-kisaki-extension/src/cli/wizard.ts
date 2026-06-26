import {
  EXTENSION_CATEGORIES,
  isExtensionIdentifier,
  type ExtensionCategory
} from '@kisaki3/extension-api'
import {
  createDefaultExtensionId,
  createExtensionDefaults,
  createExtensionScaffoldConfig,
  type ExtensionInputOptions
} from '../extension-input'
import {
  STARTER_OPTIONS,
  WEBVIEW_ADDON_OPTIONS,
  WEBVIEW_FRAMEWORK_OPTIONS,
  type ExtensionPublishProvider,
  type ExtensionRepositoryLayout
} from '../extension-options'
import { matchesPackageNameFormat, type ExtensionScaffoldConfig } from '../scaffold'
import type { PromptChoice, ScaffoldPromptUi } from './tui/prompts'

interface CollectExtensionConfigOptions {
  projectName: string
  workspacePackageName: string
  repositoryLayout: ExtensionRepositoryLayout
  publishProvider: ExtensionPublishProvider
  registryId: string
  registryName: string
  toolingVersion: string
  packageManager?: string
  input: ExtensionInputOptions
  prompts: ScaffoldPromptUi
}

/** Collects missing extension fields and returns a validated scaffold config. */
export async function collectExtensionConfig(
  options: CollectExtensionConfigOptions
): Promise<ExtensionScaffoldConfig> {
  const yes = options.input.yes === true
  const extensionId = await resolveExtensionId(options, yes)
  const defaults = createExtensionDefaults(extensionId)
  const packageName = await resolveText({
    value: options.input.packageName,
    yes,
    fallback: defaults.packageName,
    prompt: () =>
      options.prompts.text({
        message: 'Package name',
        initial: defaults.packageName,
        validate: (value) =>
          matchesPackageNameFormat(value) ? true : 'Use a lowercase npm package name.'
      })
  })
  const extensionName = await resolveText({
    value: options.input.extensionName,
    yes,
    fallback: defaults.extensionName,
    prompt: () =>
      options.prompts.text({
        message: 'Display name',
        initial: defaults.extensionName,
        validate: (value) => (value.trim() ? true : 'Display name is required.')
      })
  })
  const categories = await resolveCategories(options, yes, defaults.categories)
  const starter = await resolveText({
    value: options.input.starter,
    yes,
    fallback: defaults.starter,
    prompt: () =>
      options.prompts.select({
        message: 'Starter',
        initial: defaults.starter,
        choices: toPromptChoices(STARTER_OPTIONS)
      })
  })
  const webviewFramework = await resolveText({
    value: options.input.webview,
    yes,
    fallback: defaults.webviewFramework,
    prompt: () =>
      options.prompts.select({
        message: 'Webview',
        initial: defaults.webviewFramework,
        choices: toPromptChoices(WEBVIEW_FRAMEWORK_OPTIONS)
      })
  })
  const webviewAddons = await resolveWebviewAddons(options, webviewFramework, yes)
  const description = await resolveText({
    value: options.input.description,
    yes,
    fallback: defaults.description,
    prompt: () =>
      options.prompts.text({
        message: 'Description',
        initial: defaults.description
      })
  })
  const author = await resolveOptionalText({
    value: options.input.author,
    yes,
    fallback: defaults.author,
    prompt: () =>
      options.prompts.text({
        message: 'Author',
        initial: defaults.author ?? ''
      })
  })

  const configOptions = {
    projectName: options.projectName,
    workspacePackageName: options.workspacePackageName,
    repositoryLayout: options.repositoryLayout,
    publishProvider: options.publishProvider,
    registryId: options.registryId,
    registryName: options.registryName,
    toolingVersion: options.toolingVersion,
    input: {
      extensionId,
      packageName,
      extensionName,
      categories,
      starter,
      webviewFramework,
      webviewAddons,
      description,
      ...(author ? { author } : {})
    }
  }
  return createExtensionScaffoldConfig(
    options.packageManager
      ? { ...configOptions, packageManager: options.packageManager }
      : configOptions
  )
}

async function resolveExtensionId(
  options: CollectExtensionConfigOptions,
  yes: boolean
): Promise<string> {
  const fallback = createDefaultExtensionId(options.projectName)
  return resolveText({
    value: options.input.extensionId,
    yes,
    fallback,
    prompt: () =>
      options.prompts.text({
        message: 'Extension ID',
        initial: fallback,
        validate: (answer) =>
          isExtensionIdentifier(answer) ? true : 'Use lowercase dot-separated segments.'
      })
  })
}

async function resolveCategories(
  options: CollectExtensionConfigOptions,
  yes: boolean,
  fallback: readonly ExtensionCategory[]
): Promise<readonly string[]> {
  if (options.input.categories !== undefined) {
    return options.input.categories
  }
  if (yes) {
    return fallback
  }
  return options.prompts.multiSelect({
    message: 'Categories',
    choices: EXTENSION_CATEGORIES.map((category) => ({
      value: category,
      label: category,
      selected: fallback.includes(category)
    }))
  })
}

async function resolveWebviewAddons(
  options: CollectExtensionConfigOptions,
  webview: string,
  yes: boolean
): Promise<readonly string[]> {
  if (options.input.webviewAddons !== undefined) {
    return options.input.webviewAddons
  }
  if (webview !== 'vue' || yes) {
    return []
  }
  return options.prompts.multiSelect({
    message: 'Webview addons',
    choices: toPromptChoices(WEBVIEW_ADDON_OPTIONS).map((choice) => ({
      ...choice,
      selected: choice.value === 'kisaki-ui-vue'
    }))
  })
}

interface ResolveTextOptions {
  value: string | undefined
  yes: boolean
  fallback: string
  prompt: () => Promise<string>
}

async function resolveText(options: ResolveTextOptions): Promise<string> {
  if (options.value !== undefined) {
    return options.value
  }
  if (options.yes) {
    return options.fallback
  }
  return options.prompt()
}

interface ResolveOptionalTextOptions {
  value: string | undefined
  yes: boolean
  fallback: string | undefined
  prompt: () => Promise<string>
}

async function resolveOptionalText(
  options: ResolveOptionalTextOptions
): Promise<string | undefined> {
  if (options.value !== undefined) {
    return options.value
  }
  if (options.yes) {
    return options.fallback
  }
  return options.prompt()
}

function toPromptChoices<T extends string>(
  options: readonly { value: T; label: string }[]
): readonly PromptChoice<T>[] {
  return options.map((option) => ({
    value: option.value,
    label: option.label
  }))
}
