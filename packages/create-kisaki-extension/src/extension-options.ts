/** Publish providers supported by the scaffold. */
export const EXTENSION_PUBLISH_PROVIDERS = ['manual', 'github'] as const

/** A supported publish provider. */
export type ExtensionPublishProvider = (typeof EXTENSION_PUBLISH_PROVIDERS)[number]

/** Webview frameworks that can be composed with any host starter. */
export const EXTENSION_WEBVIEW_FRAMEWORKS = ['none', 'vanilla', 'vue'] as const

/** A supported generated webview framework. */
export type ExtensionWebviewFramework = (typeof EXTENSION_WEBVIEW_FRAMEWORKS)[number]

/** Optional webview addons layered after a compatible framework. */
export const EXTENSION_WEBVIEW_ADDONS = ['kisaki-ui-vue'] as const

/** A supported generated webview addon. */
export type ExtensionWebviewAddon = (typeof EXTENSION_WEBVIEW_ADDONS)[number]

/** Host implementation starters available independently of manifest categories. */
export const EXTENSION_STARTERS = ['minimal', 'integration', 'scraper', 'theme', 'tool'] as const

/** A supported generated host implementation starter. */
export type ExtensionStarter = (typeof EXTENSION_STARTERS)[number]

/**
 * Display metadata for one selectable option. The value is the canonical
 * identifier persisted into generated output; the label is terminal
 * presentation only. Co-locating them keeps the choice lists shown by the CLI
 * in sync with the values accepted by validation.
 */
export interface OptionChoiceMetadata<T extends string> {
  value: T
  label: string
}

/** Publish provider options shown during interactive scaffolding. */
export const PUBLISH_PROVIDER_OPTIONS: readonly OptionChoiceMetadata<ExtensionPublishProvider>[] = [
  { value: 'github', label: 'GitHub Releases' },
  { value: 'manual', label: 'Manual hosting' }
]

/** Starter options shown during interactive scaffolding. */
export const STARTER_OPTIONS: readonly OptionChoiceMetadata<ExtensionStarter>[] =
  EXTENSION_STARTERS.map((value) => ({ value, label: value }))

/** Webview framework options shown during interactive scaffolding. */
export const WEBVIEW_FRAMEWORK_OPTIONS: readonly OptionChoiceMetadata<ExtensionWebviewFramework>[] =
  [
    { value: 'none', label: 'None' },
    { value: 'vanilla', label: 'Vanilla' },
    { value: 'vue', label: 'Vue' }
  ]

/** Webview addon options shown during interactive scaffolding. */
export const WEBVIEW_ADDON_OPTIONS: readonly OptionChoiceMetadata<ExtensionWebviewAddon>[] = [
  { value: 'kisaki-ui-vue', label: 'Kisaki UI Vue' }
]

/** Default publish provider when no choice is provided. */
export const DEFAULT_PUBLISH_PROVIDER: ExtensionPublishProvider = 'github'

/** Default repository directory name when no target is provided. */
export const DEFAULT_REPOSITORY_NAME = 'my-kisaki-extension'

/** Default extension identifier when no extension id source is provided. */
export const DEFAULT_EXTENSION_ID = 'my-kisaki-extension'
