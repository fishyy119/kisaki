import type { UserConfig } from 'vite'

/**
 * kisx project configuration. Keys mirror the manifest fields they build:
 * `entry` configures the Node host bundle behind `manifest.entry`, `ui`
 * configures the webview document bundles behind `manifest.ui`. Each value is
 * a Vite user config merged over the kisx defaults.
 */
export interface KisxConfig {
  entry?: UserConfig
  ui?: UserConfig
}

export function defineConfig(config: KisxConfig): KisxConfig {
  return config
}
