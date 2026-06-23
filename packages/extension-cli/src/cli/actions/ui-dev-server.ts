import {
  assertUiConsistency,
  discoverUiEntries,
  loadKisxConfig,
  startUiDevServer
} from '../../build'
import { CliError } from '../../errors'
import { logger } from '../../logger'
import { readValidManifest, resolveProject } from '../../project'

/** Input accepted by the webview development server action. */
export interface UiDevServerOptions {
  project?: string
}

/** Runs the internal webview development server workflow. */
export async function runUiDevServer(options: UiDevServerOptions): Promise<void> {
  const project = await resolveProject(options.project)
  const manifest = await readValidManifest(project, { checkProjectFiles: true })
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
