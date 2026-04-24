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
}
