import type { ChildProcess } from 'node:child_process'
import path from 'node:path'
import spawn from 'cross-spawn'
import { runProcess } from './process'
import type {
  BuiltinExtensionToolContext,
  BuiltinExtensionUiDevServer,
  BuiltinExtensionUiDevServerReady,
  BuiltinExtensionWatcher
} from './types'

const kisxWatchReadyMessageType = 'kisx:watch-ready'
const kisxUiDevServerReadyMessageType = 'kisx:ui-dev-server-ready'

/** Writes one built-in extension project through kisx output. */
export function runKisxOutput(
  context: BuiltinExtensionToolContext,
  projectDir: string,
  outputRoot: string
): Promise<void> {
  return runProcess(
    process.execPath,
    createKisxCliArgs(context, ['output', '--project', projectDir, '--out-dir', outputRoot]),
    context.desktopRoot
  )
}

/** Starts a kisx host build watcher for one built-in extension project. */
export function spawnKisxHostBuildWatcher(
  context: BuiltinExtensionToolContext,
  projectDir: string
): BuiltinExtensionWatcher {
  const child = spawn(
    process.execPath,
    createKisxCliArgs(context, ['build', '--project', projectDir, '--watch', '--host-only']),
    {
      cwd: context.desktopRoot,
      stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    }
  )

  return {
    process: child,
    ready: waitForKisxWatcherReady(projectDir, child)
  }
}

/** Starts a kisx UI dev server for one built-in extension project. */
export function spawnKisxUiDevServer(
  context: BuiltinExtensionToolContext,
  projectDir: string
): BuiltinExtensionUiDevServer {
  const child = spawn(
    process.execPath,
    createKisxCliArgs(context, ['ui-dev-server', '--project', projectDir]),
    {
      cwd: context.desktopRoot,
      stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    }
  )

  return {
    process: child,
    ready: waitForKisxUiDevServerReady(projectDir, child)
  }
}

/** Waits until all host build watchers have produced their first build. */
export async function waitForBuiltinExtensionWatchersReady(
  watchers: readonly BuiltinExtensionWatcher[]
): Promise<void> {
  await Promise.all(watchers.map((watcher) => watcher.ready))
}

/** Waits until all webview UI dev servers have reported their origins. */
export async function waitForBuiltinExtensionUiDevServersReady(
  servers: readonly BuiltinExtensionUiDevServer[]
): Promise<readonly BuiltinExtensionUiDevServerReady[]> {
  return await Promise.all(servers.map((server) => server.ready))
}

function createKisxCliArgs(
  context: BuiltinExtensionToolContext,
  args: readonly string[]
): string[] {
  return ['--import', 'tsx', context.extensionCliEntry, ...args]
}

function waitForKisxWatcherReady(projectDir: string, child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      child.off('message', handleMessage)
      child.off('error', handleError)
      child.off('close', handleClose)
    }

    const handleMessage = (message: unknown): void => {
      if (!isKisxWatchReadyMessage(message)) {
        return
      }

      if (path.resolve(message.project) !== path.resolve(projectDir)) {
        return
      }

      cleanup()
      resolve()
    }

    const handleError = (error: Error): void => {
      cleanup()
      reject(error)
    }

    const handleClose = (code: number | null): void => {
      cleanup()
      reject(
        new Error(
          `Built-in extension watcher for ${path.basename(projectDir)} exited before its first build with code ${code ?? 'unknown'}.`
        )
      )
    }

    child.on('message', handleMessage)
    child.on('error', handleError)
    child.on('close', handleClose)
  })
}

function waitForKisxUiDevServerReady(
  projectDir: string,
  child: ChildProcess
): Promise<BuiltinExtensionUiDevServerReady> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      child.off('message', handleMessage)
      child.off('error', handleError)
      child.off('close', handleClose)
    }

    const handleMessage = (message: unknown): void => {
      if (!isKisxUiDevServerReadyMessage(message)) {
        return
      }

      if (path.resolve(message.project) !== path.resolve(projectDir)) {
        return
      }

      cleanup()
      resolve({ project: message.project, origin: message.origin })
    }

    const handleError = (error: Error): void => {
      cleanup()
      reject(error)
    }

    const handleClose = (code: number | null): void => {
      cleanup()
      reject(
        new Error(
          `Built-in extension UI dev server for ${path.basename(projectDir)} exited before it was ready with code ${code ?? 'unknown'}.`
        )
      )
    }

    child.on('message', handleMessage)
    child.on('error', handleError)
    child.on('close', handleClose)
  })
}

function isKisxWatchReadyMessage(
  message: unknown
): message is { readonly type: string; readonly project: string } {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    'project' in message &&
    message.type === kisxWatchReadyMessageType &&
    typeof message.project === 'string'
  )
}

function isKisxUiDevServerReadyMessage(
  message: unknown
): message is { readonly type: string; readonly project: string; readonly origin: string } {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    'project' in message &&
    'origin' in message &&
    message.type === kisxUiDevServerReadyMessageType &&
    typeof message.project === 'string' &&
    typeof message.origin === 'string'
  )
}
