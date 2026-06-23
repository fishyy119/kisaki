/** Repository layouts and release workflows supported by the scaffold. */
export const EXTENSION_PUBLISH_WORKFLOWS = ['manual', 'github-single', 'github-monorepo'] as const

/** A supported repository layout and release workflow. */
export type ExtensionPublishWorkflow = (typeof EXTENSION_PUBLISH_WORKFLOWS)[number]

/** Webview implementations that can be composed with any host starter. */
export const EXTENSION_WEBVIEWS = ['none', 'vanilla', 'vue', 'vue-kit'] as const

/** A supported generated webview implementation. */
export type ExtensionWebview = (typeof EXTENSION_WEBVIEWS)[number]

/** Host implementation starters available independently of manifest categories. */
export const EXTENSION_STARTERS = ['minimal', 'integration', 'scraper', 'theme', 'tool'] as const

/** A supported generated host implementation starter. */
export type ExtensionStarter = (typeof EXTENSION_STARTERS)[number]
