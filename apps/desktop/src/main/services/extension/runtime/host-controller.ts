import { once } from 'node:events'
import { utilityProcess, type UtilityProcess } from 'electron'
import { createLogger } from '@main/log'
import type { RpcMessage } from '@kisaki/extension-api'

const log = createLogger('Extension')

export interface ExtensionHostExitInfo {
  code: number
  expected: boolean
}

/**
 * Owns the shared Electron utility process that runs the extension host runtime.
 */
export class ExtensionHostController {
  private process: UtilityProcess | null = null
  private expectedExit = false

  constructor(private readonly modulePath: string) {}

  async start(onMessage: (message: unknown) => Promise<void> | void): Promise<void> {
    if (this.process?.pid) {
      return
    }

    this.expectedExit = false
    const child = utilityProcess.fork(this.modulePath, [], {
      serviceName: 'Kisaki Extension Host',
      stdio: 'pipe'
    })

    child.on('message', (message) => {
      void Promise.resolve(onMessage(message)).catch((error) => {
        log.error('Failed to handle host message.', error)
      })
    })

    child.on('error', (type, location, report) => {
      log.error('Host fatal error.', { type, location, report })
    })

    child.stdout?.on('data', (chunk: Buffer | string) => {
      writeHostStreamLog('stdout', chunk)
    })

    child.stderr?.on('data', (chunk: Buffer | string) => {
      writeHostStreamLog('stderr', chunk)
    })

    this.process = child
    await once(child, 'spawn')
    log.info('Spawned extension host.', { pid: child.pid ?? null })
  }

  async stop(): Promise<void> {
    const child = this.process
    if (!child) {
      return
    }

    this.expectedExit = true
    this.process = null

    const exited = once(child, 'exit').catch(() => undefined)
    child.kill()
    await Promise.race([exited, delay(2_000)])
  }

  send(message: RpcMessage): void {
    if (!this.process?.pid) {
      throw new Error('Extension host process is not running')
    }

    this.process.postMessage(message)
  }

  isRunning(): boolean {
    return Boolean(this.process?.pid)
  }

  onExit(listener: (info: ExtensionHostExitInfo) => void): void {
    this.process?.on('exit', (code) => {
      const expected = this.expectedExit
      this.expectedExit = false
      this.process = null
      listener({
        code,
        expected
      })
    })
  }
}

function writeHostStreamLog(stream: 'stdout' | 'stderr', chunk: Buffer | string): void {
  const text = chunk.toString().trim()
  if (!text) {
    return
  }

  for (const line of text.split(/\r?\n/)) {
    if (!line) {
      continue
    }

    if (stream === 'stderr') {
      log.warn('Extension host stderr.', { line })
    } else {
      log.info('Extension host stdout.', { line })
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
