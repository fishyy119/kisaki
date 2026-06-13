import { CliError, logger } from '../logger'
import { launchKisaki, type ExtensionHostInspectLaunchOptions } from '../launch'
import { readValidManifest, resolveProject } from '../project'
import {
  discoverUiEntries,
  loadKisxConfig,
  startUiDevServer,
  watchExtensionBundles,
  type ExtensionBundleWatchSession,
  type ExtensionUiDevServer
} from '../build'

export interface DevCommandOptions {
  kisaki: string
  inspectExtensionHost?: string | boolean
  inspectBrkExtensionHost?: string | boolean
}

/**
 * Runs the development loop: the extension is loaded directly from its `dist/`
 * output. Webview documents serve from a Vite dev server with full HMR, while
 * host code changes are applied on demand through Kisaki's reload action.
 */
export async function devCommand(options: DevCommandOptions): Promise<void> {
  const project = await resolveProject()

  logger.heading('kisx dev', 'Watching extension and launching Kisaki.')
  logger.detail(`Project: ${project.rootDir}`)

  const manifest = await readValidManifest(project, { checkEntry: false, checkProjectFiles: true })
  const buildConfig = await loadKisxConfig(project)
  const serveConfig = await loadKisxConfig(project, { command: 'serve', mode: 'development' })
  const inspectOptions = resolveExtensionHostInspectOptions(options)

  let uiServer: ExtensionUiDevServer | null = null
  const uiEntries = await discoverUiEntries(project)
  if (manifest.ui && uiEntries.length > 0) {
    uiServer = await startUiDevServer(project, serveConfig)
    logger.detail(`UI dev server: ${uiServer.origin}`)
  }

  const bundles: ExtensionBundleWatchSession = await watchExtensionBundles(
    project,
    manifest,
    buildConfig,
    { includeUi: uiServer === null }
  )
  await bundles.whenBuilt()

  const kisaki = launchKisaki(
    [{ path: project.rootDir, ...(uiServer ? { uiDevServerOrigin: uiServer.origin } : {}) }],
    {
      kisakiCommand: options.kisaki,
      cwd: project.rootDir,
      ...(inspectOptions === undefined ? {} : { extensionHostInspect: inspectOptions })
    }
  )

  let stopped = false
  const stop = (code = 0): void => {
    if (stopped) {
      return
    }

    stopped = true
    if (!kisaki.killed) {
      kisaki.kill()
    }

    void shutdownAndExit(bundles, uiServer, code)
  }

  kisaki.on('error', (error) => {
    logger.error(`Failed to launch Kisaki: ${error.message}`)
    stop(1)
  })

  kisaki.on('close', (code) => {
    if (!stopped) {
      stop(code ?? 0)
    }
  })

  logger.success('Kisaki started with development extension.')
  if (uiServer) {
    logger.detail(
      'Webview UI changes hot-reload in place; use Reload Process to apply host changes.'
    )
  } else {
    logger.detail('Edit and save, then use Reload Process in Kisaki to apply host changes.')
  }

  process.once('SIGINT', () => {
    stop(130)
  })
  process.once('SIGTERM', () => {
    stop(143)
  })

  await new Promise<void>(() => undefined)
}

function resolveExtensionHostInspectOptions(
  options: DevCommandOptions
): ExtensionHostInspectLaunchOptions | undefined {
  const inspectBrkAddress = readOptionalAddress(options.inspectBrkExtensionHost)
  if (inspectBrkAddress !== null) {
    return {
      mode: 'inspect-brk',
      ...(inspectBrkAddress === undefined ? {} : { address: inspectBrkAddress })
    }
  }

  const inspectAddress = readOptionalAddress(options.inspectExtensionHost)
  if (inspectAddress !== null) {
    return {
      mode: 'inspect',
      ...(inspectAddress === undefined ? {} : { address: inspectAddress })
    }
  }

  return undefined
}

function readOptionalAddress(value: string | boolean | undefined): string | undefined | null {
  if (value === undefined || value === false) {
    return null
  }

  if (value === true) {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

async function shutdownAndExit(
  bundles: ExtensionBundleWatchSession,
  uiServer: ExtensionUiDevServer | null,
  code: number
): Promise<void> {
  try {
    await bundles.close()
    await uiServer?.close()
  } catch (error) {
    if (error instanceof CliError) {
      logger.warn(error.message)
    }
  } finally {
    process.exit(code)
  }
}
