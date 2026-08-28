/**
 * Bootstrap Contract
 *
 * Early launch arguments and environment contract consumed by the main
 * process. Launchers (the bundler dev workflow, kisx dev) publish the
 * environment side of this contract.
 */

/** Environment variable carrying a JSON array of DevelopmentExtension entries. */
export const DEVELOPMENT_EXTENSIONS_ENV = 'KISAKI_DEV_EXTENSIONS'

/** Environment variable carrying the renderer dev server origin in development. */
export const RENDERER_DEV_SERVER_URL_ENV = 'KISAKI_RENDERER_DEV_SERVER_URL'

export interface BootstrapArgs {
  /** Print help and exit */
  help: boolean

  /** Print version and exit */
  version: boolean

  /** Extensions loaded directly from their source/output directory in development */
  developmentExtensions: DevelopmentExtension[]

  /** Extension host inspector settings from CLI args or environment */
  extensionHostInspect: ExtensionHostInspectOptions | undefined
}

/**
 * A development extension to load directly from disk (VS Code style), instead of
 * installing it. The project root holds `manifest.json` and the built `dist/`.
 */
export interface DevelopmentExtension {
  /** Absolute path to the extension project root. */
  path: string
  /** Loopback http origin of the Vite dev server delivering webview UI, if any. */
  uiDevServerOrigin?: string
}

export interface ExtensionHostInspectOptions {
  mode: 'inspect' | 'inspect-brk'
  address: string
}
