import { rm } from 'node:fs/promises'
import type { RollupWatcher, RollupWatcherEvent } from 'rollup'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import type { KisxConfig } from '../config'
import { logger } from '../logger'
import type { ExtensionProject } from '../project'
import { buildHostBundle } from './host'
import { assertUiConsistency, buildUiBundle, discoverUiEntries } from './ui'

export { loadKisxConfig } from './load-config'
export { buildHostBundle } from './host'
export {
  assertUiConsistency,
  buildUiBundle,
  discoverUiEntries,
  startUiDevServer,
  type ExtensionUiDevServer,
  type ExtensionUiEntry
} from './ui'

export interface ExtensionBundleWatchSession {
  /**
   * Resolves after every watched bundle completed its first successful build.
   */
  whenBuilt(): Promise<void>
  /**
   * True while every watched bundle is in a successfully built state.
   */
  isBuilt(): boolean
  onRebuilt(listener: () => void): void
  close(): Promise<void>
}

/**
 * Builds the host bundle and webview document bundles once.
 */
export async function buildExtensionBundles(
  project: ExtensionProject,
  manifest: ExtensionManifest,
  config: KisxConfig
): Promise<void> {
  await rm(project.distDir, { recursive: true, force: true })

  const uiEntries = await discoverUiEntries(project)
  assertUiConsistency(manifest, uiEntries)

  await buildHostBundle(project, manifest, config)
  if (uiEntries.length > 0) {
    await buildUiBundle(project, uiEntries, config)
  }
}

export interface WatchExtensionBundlesOptions {
  /**
   * Watch the webview document bundles too. Disabled when a dev server
   * delivers webview documents instead.
   */
  includeUi: boolean
}

/**
 * Starts Vite watch builds for the extension bundles and exposes a combined
 * built-state signal for development loops.
 */
export async function watchExtensionBundles(
  project: ExtensionProject,
  manifest: ExtensionManifest,
  config: KisxConfig,
  options: WatchExtensionBundlesOptions
): Promise<ExtensionBundleWatchSession> {
  await rm(project.distDir, { recursive: true, force: true })

  const uiEntries = await discoverUiEntries(project)
  assertUiConsistency(manifest, uiEntries)

  const watchers: RollupWatcher[] = []
  const states: boolean[] = []
  const rebuiltListeners = new Set<() => void>()
  let firstBuildResolvers: (() => void)[] = []

  const trackWatcher = (watcher: RollupWatcher, label: string): void => {
    const index = states.length
    states.push(false)
    watchers.push(watcher)

    watcher.on('event', (event: RollupWatcherEvent) => {
      if (event.code === 'BUNDLE_START') {
        states[index] = false
        return
      }

      if (event.code === 'BUNDLE_END') {
        void event.result.close()
        return
      }

      if (event.code === 'END') {
        states[index] = true
        notifyRebuilt()
        return
      }

      if (event.code === 'ERROR') {
        states[index] = false
        void event.result?.close()
        logger.warn(`${label} build failed: ${event.error.message}`)
      }
    })
  }

  const notifyRebuilt = (): void => {
    if (!states.every(Boolean)) {
      return
    }

    const resolvers = firstBuildResolvers
    firstBuildResolvers = []
    for (const resolve of resolvers) {
      resolve()
    }

    for (const listener of rebuiltListeners) {
      listener()
    }
  }

  const hostWatcher = await buildHostBundle(project, manifest, config, { watch: true })
  if (hostWatcher) {
    trackWatcher(hostWatcher, 'Host bundle')
  }

  if (options.includeUi && uiEntries.length > 0) {
    const uiWatcher = await buildUiBundle(project, uiEntries, config, { watch: true })
    if (uiWatcher) {
      trackWatcher(uiWatcher, 'UI bundle')
    }
  }

  return {
    whenBuilt() {
      if (states.length === 0 || states.every(Boolean)) {
        return Promise.resolve()
      }

      return new Promise<void>((resolve) => {
        firstBuildResolvers.push(resolve)
      })
    },
    isBuilt() {
      return states.every(Boolean)
    },
    onRebuilt(listener) {
      rebuiltListeners.add(listener)
    },
    async close() {
      rebuiltListeners.clear()
      await Promise.all(watchers.map((watcher) => watcher.close()))
    }
  }
}
