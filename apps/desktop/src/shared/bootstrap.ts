/**
 * Bootstrap Arguments
 *
 * Parsed early bootstrap arguments used by the main process.
 */

export interface BootstrapArgs {
  /** Print help and exit */
  help: boolean

  /** Print version and exit */
  version: boolean

  /** Development extension path from --dev-extension CLI argument */
  devExtension: string | undefined

  /** Extension host inspector settings from CLI args or environment */
  extensionHostInspect: ExtensionHostInspectOptions | undefined
}

export interface ExtensionHostInspectOptions {
  mode: 'inspect' | 'inspect-brk'
  address: string
}
