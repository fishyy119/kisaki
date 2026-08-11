/**
 * Process launch namespace.
 *
 * Starts and terminates OS processes. Knows nothing about what the process is:
 * callers pass an already resolved absolute path or URL.
 */

import { shell } from 'electron'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import spawn from 'cross-spawn'
import { isWindows } from '@main/env'
import { createLogger } from '@main/log'
import { openExternalProtocol } from '@main/utils/external-url'
import type { ProcessLaunchResult } from './types'

const log = createLogger('Process')

export class ProcessLauncher {
  /** Opens a file with the system default application. */
  async openFile(absolutePath: string): Promise<ProcessLaunchResult> {
    if (!existsSync(absolutePath)) {
      return { status: 'failed', reason: 'fileNotFound' }
    }

    const failure = await shell.openPath(absolutePath)
    if (failure) {
      log.warn('Failed to open file.', { file: basename(absolutePath), openError: failure })
      return { status: 'failed', reason: 'openFileFailed' }
    }

    return { status: 'started' }
  }

  /** Opens a URL with the system default handler for its protocol. */
  async openUrl(url: string): Promise<ProcessLaunchResult> {
    try {
      new URL(url)
    } catch {
      return { status: 'failed', reason: 'invalidUrl' }
    }

    await openExternalProtocol(url, { allowCustomProtocols: true })
    return { status: 'started' }
  }

  /** Spawns a detached executable that outlives this process. */
  async exec(absolutePath: string, cwd?: string): Promise<ProcessLaunchResult> {
    if (!existsSync(absolutePath)) {
      return { status: 'failed', reason: 'executableNotFound' }
    }

    const child = spawn(absolutePath, [], {
      cwd,
      detached: true,
      stdio: 'ignore'
    })
    child.on('error', (error) => {
      log.error('Detached process failed.', error, { file: basename(absolutePath) })
    })
    child.unref()

    return { status: 'started' }
  }

  /** Terminates a process by pid, reporting whether the request went through. */
  async terminate(pid: number): Promise<boolean> {
    try {
      if (isWindows) {
        await runCommand('taskkill', ['/F', '/PID', String(pid)])
      } else {
        process.kill(pid, 'SIGTERM')
      }
      return true
    } catch (error) {
      log.warn('Failed to terminate process.', error, { processPid: pid })
      return false
    }
  }
}

function runCommand(command: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { stdio: 'ignore' })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} exited with code ${code ?? 'unknown'}.`))
      }
    })
  })
}
