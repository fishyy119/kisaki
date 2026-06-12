import path from 'node:path'
import { readdir } from 'node:fs/promises'
import type { RollupWatcher } from 'rollup'
import { build, createServer, mergeConfig, type InlineConfig, type ViteDevServer } from 'vite'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import type { KisxConfig } from '../config'
import { CliError } from '../logger'
import type { ExtensionProject } from '../project'
import { pathExists } from '../project'

const UI_ENTRY_FILE = 'index.html'
const UI_ENTRY_MAX_DEPTH = 4
// Normalized form compared against parsed manifests; manifests declare the
// official package-relative style with a ./ prefix.
const EXPECTED_MANIFEST_UI_ROOT = 'dist/ui'
const MANIFEST_UI_DECLARATION = './dist/ui'

export interface ExtensionUiEntry {
  /**
   * Rollup input name and ui-root-relative directory, e.g. `settings`.
   * The root entry uses `index`.
   */
  name: string
  htmlPath: string
  /**
   * Document path relative to the manifest `ui` root, e.g. `settings/index.html`.
   */
  documentPath: string
}

export interface UiBuildOptions {
  watch?: boolean
}

export interface ExtensionUiDevServer {
  origin: string
  close(): Promise<void>
}

/**
 * Discovers webview document entries: every index.html under src/ui.
 */
export async function discoverUiEntries(
  project: ExtensionProject
): Promise<readonly ExtensionUiEntry[]> {
  if (!(await pathExists(project.uiSourceDir))) {
    return []
  }

  const entries: ExtensionUiEntry[] = []
  await collectUiEntries(project.uiSourceDir, '', 0, entries)
  return entries.toSorted((left, right) =>
    left.documentPath.localeCompare(right.documentPath, 'en')
  )
}

/**
 * Verifies that the manifest `ui` declaration and the src/ui sources agree.
 */
export function assertUiConsistency(
  manifest: ExtensionManifest,
  entries: readonly ExtensionUiEntry[]
): void {
  if (manifest.ui && entries.length === 0) {
    throw new CliError(
      'manifest.json declares "ui" but src/ui contains no index.html webview entries.'
    )
  }

  if (!manifest.ui && entries.length > 0) {
    throw new CliError(
      `src/ui contains webview entries but manifest.json does not declare "ui": "${MANIFEST_UI_DECLARATION}".`
    )
  }

  if (manifest.ui && manifest.ui !== EXPECTED_MANIFEST_UI_ROOT) {
    throw new CliError(
      `manifest.json "ui" must be "${MANIFEST_UI_DECLARATION}"; kisx emits webview assets there.`
    )
  }
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

/**
 * Starts the Vite dev server delivering webview documents with HMR. Documents
 * resolve at `<origin>/<entry>` exactly like bundled `dist/ui/<entry>` paths.
 */
export async function startUiDevServer(
  project: ExtensionProject,
  config: KisxConfig
): Promise<ExtensionUiDevServer> {
  const base: InlineConfig = {
    configFile: false,
    root: project.uiSourceDir,
    appType: 'mpa',
    logLevel: 'warn',
    clearScreen: false,
    server: {
      host: '127.0.0.1'
    }
  }

  const server = await createServer(config.ui ? mergeConfig(base, config.ui) : base)
  await server.listen()

  return {
    origin: resolveDevServerOrigin(server),
    close: () => server.close()
  }
}

function createUiBuildConfig(
  project: ExtensionProject,
  entries: readonly ExtensionUiEntry[],
  config: KisxConfig,
  options: UiBuildOptions
): InlineConfig {
  const input = Object.fromEntries(entries.map((entry) => [entry.name, entry.htmlPath]))

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

function resolveDevServerOrigin(server: ViteDevServer): string {
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') {
    throw new CliError('UI dev server did not expose a listening address.')
  }

  const hostname = address.address === '::1' ? '[::1]' : address.address
  return `http://${hostname}:${address.port}`
}

async function collectUiEntries(
  currentDir: string,
  relativeDir: string,
  depth: number,
  entries: ExtensionUiEntry[]
): Promise<void> {
  const dirents = await readdir(currentDir, { withFileTypes: true })

  for (const dirent of dirents) {
    if (dirent.isFile() && dirent.name === UI_ENTRY_FILE) {
      entries.push({
        name: relativeDir === '' ? 'index' : relativeDir.replaceAll('/', '-'),
        htmlPath: path.join(currentDir, dirent.name),
        documentPath: relativeDir === '' ? UI_ENTRY_FILE : `${relativeDir}/${UI_ENTRY_FILE}`
      })
      continue
    }

    if (dirent.isDirectory() && depth < UI_ENTRY_MAX_DEPTH && !dirent.name.startsWith('.')) {
      await collectUiEntries(
        path.join(currentDir, dirent.name),
        relativeDir === '' ? dirent.name : `${relativeDir}/${dirent.name}`,
        depth + 1,
        entries
      )
    }
  }
}
