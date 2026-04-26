import type { ChildProcess } from 'node:child_process'
import { CliError, logger } from '../logger'
import { readValidManifest } from '../manifest'
import { launchKisaki } from '../launch'
import { pathExists, resolveEntryFile, resolveProject } from '../project'
import { spawnTsdown } from './tsdown'

export interface DevCommandOptions {
  kisaki: string
}

/**
 * Starts tsdown in watch mode and launches Kisaki with --dev-extension.
 */
export async function devCommand(options: DevCommandOptions): Promise<void> {
  const project = await resolveProject()
  const manifest = await readValidManifest(project, { checkEntry: false, checkProjectFiles: true })
  const entryPath = resolveEntryFile(project, manifest)

  if (!entryPath) {
    throw new CliError('Manifest entry path is invalid.')
  }

  logger.heading('kisx dev', 'Watching extension and launching Kisaki.')
  logger.detail(`Project: ${project.rootDir}`)

  const tsdown = await spawnTsdown(project.rootDir, ['--watch'])

  let kisaki: ChildProcess | null = null
  let stopped = false
  const stop = (code = 0): void => {
    if (stopped) {
      return
    }

    stopped = true
    if (kisaki && !kisaki.killed) {
      kisaki.kill()
    }
    if (!tsdown.killed) {
      tsdown.kill()
    }
    process.exit(code)
  }

  const startWhenReady = setInterval(() => {
    void pathExists(entryPath)
      .then((exists) => {
        if (!exists || kisaki) {
          return
        }

        kisaki = launchKisaki(project, { kisakiCommand: options.kisaki })
        logger.success('Kisaki started with development extension.')
      })
      .catch((error: unknown) => {
        logger.warn(error instanceof Error ? error.message : 'Failed to check build output.')
      })
  }, 500)

  tsdown.on('error', (error) => {
    clearInterval(startWhenReady)
    logger.error(`Failed to start tsdown: ${error.message}`)
    stop(1)
  })

  tsdown.on('close', (code) => {
    clearInterval(startWhenReady)
    if (!stopped) {
      stop(code ?? 0)
    }
  })

  process.once('SIGINT', () => {
    clearInterval(startWhenReady)
    stop(130)
  })
  process.once('SIGTERM', () => {
    clearInterval(startWhenReady)
    stop(143)
  })

  await new Promise<void>(() => undefined)
}
