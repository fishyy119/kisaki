import {
  build,
  createServer,
  mergeConfig,
  type InlineConfig,
  type Rolldown,
  type ViteDevServer
} from 'vite'
import { DEVELOPMENT_EXTENSIONS_ENV, RENDERER_DEV_SERVER_URL_ENV } from '../../src/shared/bootstrap'
import { createBuiltinExtensionToolContext } from '../builtin-extensions/context'
import { startBuiltinExtensionDevSession } from '../builtin-extensions/dev-session'
import { buildWebviewFonts } from '../webview-fonts/build'
import { createWebviewFontToolContext } from '../webview-fonts/paths'
import { ElectronAppController } from './electron'
import type { BundlerPaths } from './paths'
import { DevReloadCoordinator } from './reload'
import { createMainConfig, createPreloadConfig, createRendererConfig } from './targets'

interface WatchBuildHandle {
  watcher: Rolldown.RolldownWatcher
  firstBuild: Promise<void>
  isBuilding(): boolean
  onRebuild(listener: () => void): void
  onCycleSettled(listener: () => void): void
}

/**
 * Runs the desktop dev workflow inside this single process: webview fonts,
 * built-in extension watchers and UI dev servers, renderer dev server with
 * HMR, main and preload watch builds, and an Electron instance restarted on
 * main rebuilds. Electron is the only long-lived child process.
 */
export async function runDevWorkflow(paths: BundlerPaths): Promise<void> {
  const mode = 'development'

  await buildWebviewFonts(createWebviewFontToolContext())
  const extensionSession = await startBuiltinExtensionDevSession(
    createBuiltinExtensionToolContext()
  )

  const rendererServer = await createServer(createRendererConfig(paths, mode))
  await rendererServer.listen()
  const rendererUrl = resolveRendererDevServerUrl(rendererServer)
  console.log(`[bundler] Renderer dev server running at ${rendererUrl}`)

  let watchers: Rolldown.RolldownWatcher[] = []
  let reloadCoordinator: DevReloadCoordinator | null = null
  let shuttingDown = false
  const shutdown = (code: number): void => {
    if (shuttingDown) {
      return
    }
    shuttingDown = true

    reloadCoordinator?.dispose()
    app.dispose()
    void Promise.allSettled([
      ...watchers.map((watcher) => watcher.close()),
      rendererServer.close(),
      extensionSession.close()
    ]).then(() => {
      process.exit(code)
    })
  }

  const app = new ElectronAppController({
    desktopRoot: paths.desktopRoot,
    env: {
      [RENDERER_DEV_SERVER_URL_ENV]: rendererUrl,
      [DEVELOPMENT_EXTENSIONS_ENV]: JSON.stringify(extensionSession.extensions)
    },
    onExit: shutdown
  })

  try {
    const [mainBuild, preloadBuild] = await Promise.all([
      startWatchBuild(createMainConfig(paths, mode)),
      startWatchBuild(createPreloadConfig(paths, mode))
    ])
    watchers = [mainBuild.watcher, preloadBuild.watcher]
    await Promise.all([mainBuild.firstBuild, preloadBuild.firstBuild])

    const builds = [mainBuild, preloadBuild]
    reloadCoordinator = new DevReloadCoordinator({
      isBuildInProgress: () => builds.some((build) => build.isBuilding()),
      apply: (action) => {
        if (action === 'restart-app') {
          console.log('[bundler] Main process rebuilt, restarting Electron')
          app.restart()
          return
        }

        console.log('[bundler] Preload rebuilt, reloading renderer')
        rendererServer.environments.client.hot.send({ type: 'full-reload' })
      }
    })
    const coordinator = reloadCoordinator

    mainBuild.onRebuild(() => coordinator.schedule('restart-app'))
    preloadBuild.onRebuild(() => coordinator.schedule('reload-renderer'))
    for (const build of builds) {
      build.onCycleSettled(() => coordinator.notifyBuildSettled())
    }
  } catch (error) {
    shutdown(1)
    throw error
  }

  app.start()

  process.once('SIGINT', () => shutdown(130))
  process.once('SIGTERM', () => shutdown(143))

  await new Promise<void>(() => undefined)
}

/** Starts a Vite watch build and reports successful build cycles. */
async function startWatchBuild(config: InlineConfig): Promise<WatchBuildHandle> {
  const watcher = (await build(
    mergeConfig(config, { build: { watch: {} } })
  )) as Rolldown.RolldownWatcher

  const rebuildListeners: (() => void)[] = []
  const cycleSettledListeners: (() => void)[] = []
  let building = false
  let sawSuccessfulBuild = false
  let currentCycleFailed = false
  let resolveFirstBuild!: () => void
  const firstBuild = new Promise<void>((resolve) => {
    resolveFirstBuild = resolve
  })

  const settleCycle = (): void => {
    if (!building) {
      return
    }
    building = false
    for (const listener of cycleSettledListeners) {
      listener()
    }
  }

  watcher.on('event', (event) => {
    if (event.code === 'START') {
      building = true
      currentCycleFailed = false
      return
    }
    if (event.code === 'ERROR') {
      currentCycleFailed = true
      console.error('[bundler] Build failed:', event.error.message)
      settleCycle()
      return
    }
    if (event.code === 'BUNDLE_END') {
      void event.result.close()
      return
    }
    if (event.code === 'END') {
      if (!currentCycleFailed) {
        if (sawSuccessfulBuild) {
          for (const listener of rebuildListeners) {
            listener()
          }
        } else {
          sawSuccessfulBuild = true
          resolveFirstBuild()
        }
      }
      settleCycle()
    }
  })

  return {
    watcher,
    firstBuild,
    isBuilding: () => building,
    onRebuild(listener) {
      rebuildListeners.push(listener)
    },
    onCycleSettled(listener) {
      cycleSettledListeners.push(listener)
    }
  }
}

function resolveRendererDevServerUrl(server: ViteDevServer): string {
  const url = server.resolvedUrls?.local[0]
  if (!url) {
    throw new Error('Renderer dev server did not resolve a local URL.')
  }
  return url
}
