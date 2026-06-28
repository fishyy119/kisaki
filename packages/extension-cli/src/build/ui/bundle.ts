import path from 'node:path'
import type { RollupWatcher } from 'rollup'
import { build, mergeConfig, type InlineConfig } from 'vite'
import type { KisxConfig } from '../../config'
import type { ExtensionProject } from '../../project'
import type { ExtensionUiEntry } from './entries'

export interface UiBuildOptions {
  watch?: boolean
}

/**
 * Builds the webview document bundles into dist/ui.
 */
export async function buildUiBundle(
  project: ExtensionProject,
  entries: readonly ExtensionUiEntry[],
  config: KisxConfig,
  options: UiBuildOptions = {}
): Promise<RollupWatcher | null> {
  const result = await build(createUiBuildConfig(project, entries, config, options))
  return options.watch ? (result as RollupWatcher) : null
}

function createUiBuildConfig(
  project: ExtensionProject,
  entries: readonly ExtensionUiEntry[],
  config: KisxConfig,
  options: UiBuildOptions
): InlineConfig {
  const input = entries.map((entry) => entry.htmlPath)

  const base: InlineConfig = {
    configFile: false,
    root: project.uiSourceDir,
    appType: 'mpa',
    logLevel: 'warn',
    clearScreen: false,
    build: {
      outDir: path.join(project.distDir, 'ui'),
      emptyOutDir: false,
      sourcemap: true,
      rollupOptions: { input },
      watch: options.watch ? {} : null
    }
  }

  return config.ui ? mergeConfig(base, config.ui) : base
}
