/** Repository layouts supported by the scaffold. */
export const EXTENSION_REPOSITORY_LAYOUTS = ['single', 'monorepo'] as const

/** A supported repository layout. */
export type ExtensionRepositoryLayout = (typeof EXTENSION_REPOSITORY_LAYOUTS)[number]

/** Release providers supported by the scaffold. */
export const EXTENSION_PUBLISH_PROVIDERS = ['manual', 'github'] as const

/** A supported release provider. */
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

/** Repository layout options shown during interactive scaffolding. */
export const REPOSITORY_LAYOUT_OPTIONS: readonly OptionChoiceMetadata<ExtensionRepositoryLayout>[] =
  [
    { value: 'single', label: 'Single extension' },
    { value: 'monorepo', label: 'Extension monorepo' }
  ]

/** Release provider options shown during interactive scaffolding. */
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

/** Default repository layout when no choice is provided. */
export const DEFAULT_REPOSITORY_LAYOUT: ExtensionRepositoryLayout = 'single'

/** Default release provider when no choice is provided. */
export const DEFAULT_PUBLISH_PROVIDER: ExtensionPublishProvider = 'github'

/** Default project directory name when no target is provided. */
export const DEFAULT_PROJECT_NAME = 'my-kisaki-extension'

/** Formats a webview addon identifier as a human-readable label. */
export function formatWebviewAddonLabel(addon: ExtensionWebviewAddon): string {
  return addon === 'kisaki-ui-vue' ? 'Kisaki UI Vue' : addon
}
