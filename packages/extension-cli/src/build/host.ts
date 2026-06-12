import path from 'node:path'
import type { RollupWatcher } from 'rollup'
import { build, mergeConfig, type InlineConfig } from 'vite'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import type { KisxConfig } from '../config'
import { CliError } from '../logger'
import type { ExtensionProject } from '../project'
import { pathExists } from '../project'

const HOST_BUNDLED_PACKAGES = ['@kisaki3/extension-sdk', '@kisaki3/extension-api']

export interface HostBuildOptions {
  watch?: boolean
}

/**
 * Builds the Node extension host bundle declared by `manifest.entry` from the
 * `src/host/index.ts` convention entry. The SDK and API packages are bundled
 * in; every other runtime dependency stays external and ships as copied
 * node_modules in the package.
 */
export async function buildHostBundle(
  project: ExtensionProject,
  manifest: ExtensionManifest,
  config: KisxConfig,
  options: HostBuildOptions = {}
): Promise<RollupWatcher | null> {
  const inlineConfig = await createHostInlineConfig(project, manifest, config, options)
  const result = await build(inlineConfig)
  return options.watch ? (result as RollupWatcher) : null
}

async function createHostInlineConfig(
  project: ExtensionProject,
  manifest: ExtensionManifest,
  config: KisxConfig,
  options: HostBuildOptions
): Promise<InlineConfig> {
  if (!(await pathExists(project.entrySourcePath))) {
    throw new CliError('Host entry source src/host/index.ts was not found.')
  }

  const entryFileName = path.posix.basename(manifest.entry)
  const outDir = path.posix.dirname(manifest.entry)
  const format = entryFileName.endsWith('.cjs') ? 'cjs' : 'es'

  const base: InlineConfig = {
    configFile: false,
    root: project.rootDir,
    logLevel: 'warn',
    clearScreen: false,
    build: {
      ssr: project.entrySourcePath,
      outDir,
      emptyOutDir: false,
      target: 'node22',
      sourcemap: true,
      minify: false,
      rollupOptions: {
        output: {
          format,
          entryFileNames: entryFileName
        }
      },
      watch: options.watch ? {} : null
    },
    ssr: {
      target: 'node',
      noExternal: HOST_BUNDLED_PACKAGES
    }
  }

  return config.entry ? mergeConfig(base, config.entry) : base
}
