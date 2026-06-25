/** Repository layouts supported by the scaffold. */
export const EXTENSION_REPOSITORY_LAYOUTS = ['single', 'monorepo'] as const

/** A supported repository layout. */
export type ExtensionRepositoryLayout = (typeof EXTENSION_REPOSITORY_LAYOUTS)[number]

/** Release providers supported by the scaffold. */
export const EXTENSION_PUBLISH_PROVIDERS = ['manual', 'github'] as const

/** A supported release provider. */
export type ExtensionPublishProvider = (typeof EXTENSION_PUBLISH_PROVIDERS)[number]

/** Webview implementations that can be composed with any host starter. */
export const EXTENSION_WEBVIEWS = ['none', 'vanilla', 'vue', 'vue-kit'] as const

/** A supported generated webview implementation. */
export type ExtensionWebview = (typeof EXTENSION_WEBVIEWS)[number]

/** Host implementation starters available independently of manifest categories. */
export const EXTENSION_STARTERS = ['minimal', 'integration', 'scraper', 'theme', 'tool'] as const

/** A supported generated host implementation starter. */
export type ExtensionStarter = (typeof EXTENSION_STARTERS)[number]
