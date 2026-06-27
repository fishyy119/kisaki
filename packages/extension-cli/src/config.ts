import type { UserConfig } from 'vite'

/**
 * kisx project configuration for the extension build targets. `host`
 * configures the Node bundle emitted at `manifest.entry`; `ui` configures the
 * webview document bundles emitted below `manifest.ui`. Each value is a Vite
 * user config merged over the kisx defaults.
 */
export interface KisxConfig {
  host?: UserConfig
  ui?: UserConfig
}

export function defineConfig(config: KisxConfig): KisxConfig {
  return config
}
