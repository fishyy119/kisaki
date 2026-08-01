import { rm } from 'node:fs/promises'
import type { Rolldown } from 'vite'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import type { KisxConfig } from '../config'
import type { ExtensionProject } from '../project'
import { buildHostBundle } from './host'
import { assertUiConsistency, buildUiBundle, discoverUiEntries } from './ui'

export interface ExtensionBundleWatchSession {
  /**
   * Resolves after every watched bundle completed its first successful build.
   */
  whenBuilt(): Promise<void>
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
  /** Reports asynchronous watch failures to the owning presentation layer. */
  onBuildError?: (failure: ExtensionBundleBuildFailure) => void
}

/** One failed bundle emitted by a Vite watch session. */
export interface ExtensionBundleBuildFailure {
  label: string
  error: Rolldown.RolldownError
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

  const watchers: Rolldown.RolldownWatcher[] = []
  const states: boolean[] = []
  let firstBuildResolvers: (() => void)[] = []

  const trackWatcher = (watcher: Rolldown.RolldownWatcher, label: string): void => {
    const index = states.length
    states.push(false)
    watchers.push(watcher)
    // Rolldown emits END after ERROR in the same cycle, so END alone must not
    // count as a successful build.
    let currentCycleFailed = false

    watcher.on('event', (event: Rolldown.RolldownWatcherEvent) => {
      if (event.code === 'START') {
        currentCycleFailed = false
        states[index] = false
        return
      }

      if (event.code === 'BUNDLE_END') {
        void event.result.close()
        return
      }

      if (event.code === 'END') {
        if (!currentCycleFailed) {
          states[index] = true
          notifyBuilt()
        }
        return
      }

      if (event.code === 'ERROR') {
        currentCycleFailed = true
        states[index] = false
        void event.result?.close()
        options.onBuildError?.({ label, error: event.error })
      }
    })
  }

  const notifyBuilt = (): void => {
    if (!states.every(Boolean)) {
      return
    }

    const resolvers = firstBuildResolvers
    firstBuildResolvers = []
    for (const resolve of resolvers) {
      resolve()
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
    async close() {
      await Promise.all(watchers.map((watcher) => watcher.close()))
    }
  }
}
