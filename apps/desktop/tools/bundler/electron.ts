import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'

const nodeRequire = createRequire(import.meta.url)

export interface ElectronAppOptions {
  desktopRoot: string
  env?: Record<string, string>
  onExit: (code: number) => void
}

/**
 * Owns the Electron app child process for dev and start workflows.
 * Restarts keep the same launch options; onExit only fires for external exits.
 */
export class ElectronAppController {
  private child: ChildProcess | null = null
  private restarting = false
  private disposed = false

  constructor(private readonly options: ElectronAppOptions) {}

  start(): void {
    if (this.disposed || this.child) {
      return
    }

    const child = spawn(resolveElectronBinary(), createElectronArgs(), {
      cwd: this.options.desktopRoot,
      stdio: 'inherit',
      env: { ...process.env, ...this.options.env }
    })
    this.child = child

    child.on('error', (error) => {
      console.error('[bundler] Failed to start Electron:', error)
      if (this.child === child) {
        this.child = null
        this.options.onExit(1)
      }
    })

    child.on('exit', (code) => {
      if (this.child !== child) {
        return
      }
      this.child = null
      if (this.restarting || this.disposed) {
        return
      }
      this.options.onExit(code ?? 0)
    })
  }

  restart(): void {
    if (this.disposed) {
      return
    }
    if (!this.child) {
      this.start()
      return
    }

    this.restarting = true
    this.child.once('exit', () => {
      this.restarting = false
      this.start()
    })
    terminateProcessTree(this.child)
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true

    const child = this.child
    this.child = null
    if (child) {
      terminateProcessTree(child)
    }
  }
}

/** Resolves the Electron binary path exported by the electron package. */
function resolveElectronBinary(): string {
  return nodeRequire('electron') as string
}

/** Builds Electron launch args, honoring the debugger contract used by .vscode/launch.json. */
function createElectronArgs(): string[] {
  const remoteDebuggingPort = process.env['REMOTE_DEBUGGING_PORT']
  return remoteDebuggingPort ? ['.', `--remote-debugging-port=${remoteDebuggingPort}`] : ['.']
}

/** Terminates a process tree when the platform supports it. */
function terminateProcessTree(child: ChildProcess): void {
  if (child.killed || child.exitCode !== null || child.signalCode !== null) {
    return
  }

  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    return
  }

  child.kill()
}
