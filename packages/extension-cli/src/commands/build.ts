import { logger } from '../logger'
import { readValidManifest, resolveProject } from '../project'
import {
  buildExtensionBundles,
  buildHostBundle,
  loadKisxConfig,
  watchExtensionBundles
} from '../build'

export interface BuildCommandOptions {
  project?: string
  watch?: boolean
  hostOnly?: boolean
}

/**
 * Builds (or watch-builds) the current extension's bundles into `dist/`.
 * Development loads the extension directly from `dist/`, so there is no package
 * output step.
 */
export async function buildCommand(options: BuildCommandOptions = {}): Promise<void> {
  const project = await resolveProject(options.project)
  const manifest = await readValidManifest(project, { checkEntry: false, checkProjectFiles: true })
  const config = await loadKisxConfig(project)

  if (options.watch) {
    logger.heading(
      'kisx build --watch',
      options.hostOnly ? 'Watching extension host bundle.' : 'Watching extension bundles.'
    )
    logger.detail(`Project: ${project.rootDir}`)

    const bundles = await watchExtensionBundles(project, manifest, config, {
      includeUi: !options.hostOnly
    })
    await bundles.whenBuilt()
    logger.success('Extension bundles built. Watching for changes.')
    emitWatchReady(project.rootDir)

    let stopped = false
    const stop = (code = 0): void => {
      if (stopped) {
        return
      }

      stopped = true
      void bundles.close().finally(() => process.exit(code))
    }

    process.once('SIGINT', () => stop(130))
    process.once('SIGTERM', () => stop(143))

    await new Promise<void>(() => undefined)
    return
  }

  logger.heading('kisx build', 'Building extension with Vite.')
  if (options.hostOnly) {
    await buildHostBundle(project, manifest, config)
  } else {
    await buildExtensionBundles(project, manifest, config)
  }
  await readValidManifest(project, { checkEntry: true })
  logger.success('Extension build completed.')
}

function emitWatchReady(projectDir: string): void {
  if (typeof process.send === 'function') {
    process.send({ type: 'kisx:watch-ready', project: projectDir })
  }
}
