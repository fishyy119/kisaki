import type { ChildProcess } from 'node:child_process'
import { CliError, logger } from '../logger'
import { launchKisaki } from '../launch'
import { resolveProject } from '../project'
import { watchExtensionOutput, type ExtensionOutputWatchSession } from './output'

export interface DevCommandOptions {
  kisaki: string
  outDir: string
}

/**
 * Starts extension package output in watch mode and launches Kisaki with --dev-extension.
 */
export async function devCommand(options: DevCommandOptions): Promise<void> {
  const project = await resolveProject()

  logger.heading('kisx dev', 'Watching extension and launching Kisaki.')
  logger.detail(`Project: ${project.rootDir}`)
  logger.detail(`Output: ${options.outDir}`)

  const output = await watchExtensionOutput(project, { outDir: options.outDir })
  const ready = await output.ready

  const kisaki: ChildProcess = launchKisaki(ready.packagePath, {
    kisakiCommand: options.kisaki,
    cwd: project.rootDir
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

    void closeOutputAndExit(output, code)
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

  process.once('SIGINT', () => {
    stop(130)
  })
  process.once('SIGTERM', () => {
    stop(143)
  })

  await new Promise<void>(() => undefined)
}

async function closeOutputAndExit(
  output: ExtensionOutputWatchSession,
  code: number
): Promise<void> {
  try {
    await output.close()
  } catch (error) {
    if (error instanceof CliError) {
      logger.warn(error.message)
    }
  } finally {
    process.exit(code)
  }
}
