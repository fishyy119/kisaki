import { assertUiConsistency, discoverUiEntries, loadKisxConfig, startUiDevServer } from '../build'
import { CliError, logger } from '../logger'
import { readValidManifest, resolveProject } from '../project'

export interface UiDevServerCommandOptions {
  project?: string
}

/**
 * Starts only the webview UI development server for one extension project.
 * Desktop's built-in extension harness runs one process per UI-bearing
 * extension, then passes each loopback origin to Kisaki at launch.
 */
export async function uiDevServerCommand(options: UiDevServerCommandOptions = {}): Promise<void> {
  const project = await resolveProject(options.project)
  const manifest = await readValidManifest(project, {
    checkEntry: false,
    checkProjectFiles: true
  })
  const uiEntries = await discoverUiEntries(project)
  assertUiConsistency(manifest, uiEntries)

  if (!manifest.ui || uiEntries.length === 0) {
    throw new CliError('This extension does not declare webview UI entries.')
  }

  logger.heading('kisx ui-dev-server', 'Serving extension webview UI.')
  logger.detail(`Project: ${project.rootDir}`)

  const config = await loadKisxConfig(project, { command: 'serve', mode: 'development' })
  const server = await startUiDevServer(project, config)
  logger.success(`UI dev server listening at ${server.origin}`)
  emitUiDevServerReady(project.rootDir, server.origin)

  let stopped = false
  const stop = (code = 0): void => {
    if (stopped) {
      return
    }

    stopped = true
    void server.close().finally(() => process.exit(code))
  }

  process.once('SIGINT', () => stop(130))
  process.once('SIGTERM', () => stop(143))

  await new Promise<void>(() => undefined)
}

function emitUiDevServerReady(projectDir: string, origin: string): void {
  if (typeof process.send === 'function') {
    process.send({ type: 'kisx:ui-dev-server-ready', project: projectDir, origin })
  }
}
