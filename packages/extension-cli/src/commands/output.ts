import path from 'node:path'
import { logger } from '../logger'
import { resolveProject } from '../project'
import { buildExtensionOutput, watchExtensionOutput } from '../publication'

export interface OutputCommandOptions {
  outDir: string
  project?: string
  watch?: boolean
  debugSources?: boolean
  skipInitialBuild?: boolean
}

/**
 * Builds or watch-builds an unpacked extension package directory.
 */
export async function outputCommand(options: OutputCommandOptions): Promise<void> {
  const project = await resolveProject(options.project)

  if (options.watch) {
    logger.heading('kisx output --watch', 'Watching extension package output.')
    logger.detail(`Project: ${project.rootDir}`)
    logger.detail(`Output: ${path.resolve(project.rootDir, options.outDir)}`)
    if (options.debugSources) {
      logger.detail('Debug source maps: enabled')
    }
    if (options.skipInitialBuild) {
      logger.detail('Initial publish: skipped')
    }

    const session = await watchExtensionOutput(project, {
      outDir: options.outDir,
      ...(options.debugSources === undefined ? {} : { debugSources: options.debugSources }),
      ...(options.skipInitialBuild === undefined
        ? {}
        : { skipInitialBuild: options.skipInitialBuild })
    })
    const result = await session.ready
    logger.success(`Output ready at ${path.relative(project.rootDir, result.packagePath)}`)
    logger.detail(`Publication: ${path.relative(project.rootDir, result.publicationPath)}`)

    let stopped = false
    const stop = (code = 0): void => {
      if (stopped) {
        return
      }

      stopped = true
      void session.close().finally(() => process.exit(code))
    }

    process.once('SIGINT', () => stop(130))
    process.once('SIGTERM', () => stop(143))

    await new Promise<void>(() => undefined)
    return
  }

  logger.heading('kisx output', 'Building extension package output.')
  logger.detail(`Project: ${project.rootDir}`)
  logger.detail(`Output: ${path.resolve(project.rootDir, options.outDir)}`)
  if (options.debugSources) {
    logger.detail('Debug source maps: enabled')
  }

  const result = await buildExtensionOutput(project, {
    outDir: options.outDir,
    ...(options.debugSources === undefined ? {} : { debugSources: options.debugSources })
  })
  logger.success(`Output written to ${path.relative(project.rootDir, result.packagePath)}`)
  logger.detail(`Publication: ${path.relative(project.rootDir, result.publicationPath)}`)
}
