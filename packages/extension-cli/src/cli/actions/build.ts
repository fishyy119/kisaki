import { loadKisxConfig, watchExtensionBundles } from '../../build'
import { buildProject } from '../../build/project'
import { logger } from '../../logger'
import { readValidManifest, resolveProject } from '../../project'

/** Input accepted by the build action. */
export interface BuildOptions {
  project?: string
  watch?: boolean
  hostOnly?: boolean
}

/** Runs the extension build workflow. */
export async function runBuild(options: BuildOptions): Promise<void> {
  const project = await resolveProject(options.project)

  if (options.watch) {
    const manifest = await readValidManifest(project, { checkProjectFiles: true })
    const config = await loadKisxConfig(project)
    logger.heading(
      'kisx build --watch',
      options.hostOnly ? 'Watching extension host bundle.' : 'Watching extension bundles.'
    )
    logger.detail(`Project: ${project.rootDir}`)

    const bundles = await watchExtensionBundles(project, manifest, config, {
      includeUi: !options.hostOnly,
      onBuildError: ({ label, error }) => {
        logger.warn(`${label} build failed: ${error.message}`)
      }
    })
    await bundles.whenBuilt()
    logger.success('Extension bundles built. Watching for changes.')

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
  await buildProject(project, options.hostOnly === undefined ? {} : { hostOnly: options.hostOnly })
  logger.success('Extension build completed.')
}
