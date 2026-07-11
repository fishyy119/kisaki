import {
  build,
  createServer,
  mergeConfig,
  type InlineConfig,
  type Rolldown,
  type ViteDevServer
} from 'vite'
import { ElectronAppController } from './electron'
import type { BundlerPaths } from './paths'
import { createMainConfig, createPreloadConfig, createRendererConfig } from './targets'

/** Dev contract consumed by src/main/env.ts to load renderer pages from the dev server. */
const RENDERER_DEV_SERVER_URL_ENV = 'KISAKI_RENDERER_DEV_SERVER_URL'

interface WatchBuildHandle {
  watcher: Rolldown.RolldownWatcher
  firstBuild: Promise<void>
  onRebuild(listener: () => void): void
}

/**
 * Runs the desktop dev workflow: renderer dev server with HMR, main and preload
 * watch builds, and an Electron instance restarted on main rebuilds.
 */
export async function runDevWorkflow(paths: BundlerPaths): Promise<void> {
  const mode = 'development'

  const rendererServer = await createServer(createRendererConfig(paths, mode))
  await rendererServer.listen()
  const rendererUrl = resolveRendererDevServerUrl(rendererServer)
  console.log(`[bundler] Renderer dev server running at ${rendererUrl}`)

  let watchers: Rolldown.RolldownWatcher[] = []
  let shuttingDown = false
  const shutdown = (code: number): void => {
    if (shuttingDown) {
      return
    }
    shuttingDown = true

    app.dispose()
    void Promise.allSettled([
      ...watchers.map((watcher) => watcher.close()),
      rendererServer.close()
    ]).then(() => {
      process.exit(code)
    })
  }

  const app = new ElectronAppController({
    desktopRoot: paths.desktopRoot,
    env: { [RENDERER_DEV_SERVER_URL_ENV]: rendererUrl },
    onExit: shutdown
  })

  try {
    const [mainBuild, preloadBuild] = await Promise.all([
      startWatchBuild(createMainConfig(paths, mode)),
      startWatchBuild(createPreloadConfig(paths, mode))
    ])
    watchers = [mainBuild.watcher, preloadBuild.watcher]
    await Promise.all([mainBuild.firstBuild, preloadBuild.firstBuild])

    mainBuild.onRebuild(() => {
      console.log('[bundler] Main process rebuilt, restarting Electron')
      app.restart()
    })
    preloadBuild.onRebuild(() => {
      console.log('[bundler] Preload rebuilt, reloading renderer')
      rendererServer.environments.client.hot.send({ type: 'full-reload' })
    })
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

  let rebuildListener: (() => void) | null = null
  let sawSuccessfulBuild = false
  let currentCycleFailed = false
  let resolveFirstBuild!: () => void
  const firstBuild = new Promise<void>((resolve) => {
    resolveFirstBuild = resolve
  })

  watcher.on('event', (event) => {
    if (event.code === 'START') {
      currentCycleFailed = false
      return
    }
    if (event.code === 'ERROR') {
      currentCycleFailed = true
      console.error('[bundler] Build failed:', event.error.message)
      return
    }
    if (event.code === 'BUNDLE_END') {
      void event.result.close()
      return
    }
    if (event.code === 'END' && !currentCycleFailed) {
      if (sawSuccessfulBuild) {
        rebuildListener?.()
        return
      }
      sawSuccessfulBuild = true
      resolveFirstBuild()
    }
  })

  return {
    watcher,
    firstBuild,
    onRebuild(listener) {
      rebuildListener = listener
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
