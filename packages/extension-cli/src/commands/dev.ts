import type { ChildProcess } from 'node:child_process'
import { CliError, logger } from '../logger'
import { launchKisaki, type ExtensionHostInspectLaunchOptions } from '../launch'
import { readValidManifest, resolveProject } from '../project'
import {
  discoverUiEntries,
  loadKisxConfig,
  startUiDevServer,
  type ExtensionUiDevServer
} from '../build'
import { watchExtensionOutput, type ExtensionOutputWatchSession } from '../publication'

export interface DevCommandOptions {
  kisaki: string
  outDir: string
  inspectExtensionHost?: string | boolean
  inspectBrkExtensionHost?: string | boolean
}

/**
 * Runs the two-track development loop: host bundle changes republish the
 * package and recycle the extension host, while webview documents serve from
 * a Vite dev server with full HMR and never touch the host.
 */
export async function devCommand(options: DevCommandOptions): Promise<void> {
  const project = await resolveProject()

  logger.heading('kisx dev', 'Watching extension and launching Kisaki.')
  logger.detail(`Project: ${project.rootDir}`)
  logger.detail(`Output: ${options.outDir}`)

  const manifest = await readValidManifest(project, { checkEntry: false, checkProjectFiles: true })
  const config = await loadKisxConfig(project, { command: 'serve', mode: 'development' })
  const inspectOptions = resolveExtensionHostInspectOptions(options)

  let uiServer: ExtensionUiDevServer | null = null
  const uiEntries = await discoverUiEntries(project)
  if (manifest.ui && uiEntries.length > 0) {
    uiServer = await startUiDevServer(project, config)
    logger.detail(`UI dev server: ${uiServer.origin}`)
  }

  const output = await watchExtensionOutput(project, {
    outDir: options.outDir,
    debugSources: true,
    ...(uiServer === null ? {} : { ui: { mode: 'dev-server', origin: uiServer.origin } })
  })
  const ready = await output.ready

  const kisaki: ChildProcess = launchKisaki(ready.publicationPath, {
    kisakiCommand: options.kisaki,
    cwd: project.rootDir,
    ...(inspectOptions === undefined ? {} : { extensionHostInspect: inspectOptions })
  })
  let stopped = false
  const stop = (code = 0): void => {
    if (stopped) {
      return
    }

    stopped = true
    if (!kisaki.killed) {
      kisaki.kill()
    }

    void shutdownAndExit(output, uiServer, code)
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

  logger.success('Kisaki started with development extension output.')
  if (uiServer) {
    logger.detail(
      'Webview UI changes hot-reload in place; host changes recycle the extension host.'
    )
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
  output: ExtensionOutputWatchSession,
  uiServer: ExtensionUiDevServer | null,
  code: number
): Promise<void> {
  try {
    await output.close()
    await uiServer?.close()
  } catch (error) {
    if (error instanceof CliError) {
      logger.warn(error.message)
    }
  } finally {
    process.exit(code)
  }
}
