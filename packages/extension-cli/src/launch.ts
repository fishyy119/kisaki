import type { ChildProcess } from 'node:child_process'
import spawn from 'cross-spawn'

const DEVELOPMENT_EXTENSIONS_ENV = 'KISAKI_DEV_EXTENSIONS'

export interface DevelopmentExtensionLaunch {
  /** Absolute path to the extension project root. */
  path: string
  /** Loopback http origin of the Vite dev server delivering webview UI, if any. */
  uiDevServerOrigin?: string
}

export interface DevLaunchOptions {
  kisakiCommand: string
  cwd?: string
  extensionHostInspect?: ExtensionHostInspectLaunchOptions
}

export interface ExtensionHostInspectLaunchOptions {
  mode: 'inspect' | 'inspect-brk'
  address?: string
}

/**
 * Starts Kisaki with development extensions loaded directly from their project
 * directories. The set is handed over through the environment so the app's
 * bootstrap reads it before the extension host starts.
 */
export function launchKisaki(
  developmentExtensions: readonly DevelopmentExtensionLaunch[],
  options: DevLaunchOptions
): ChildProcess {
  const args: string[] = []
  const inspectArg = createExtensionHostInspectArg(options.extensionHostInspect)
  if (inspectArg) {
    args.push(inspectArg)
  }

  const environment = { ...process.env }

  // Parent Node flags belong to pnpm/kisx, not to the Electron application.
  // In particular, VS Code auto-attach injects a require hook through these
  // variables, which packaged Electron rejects and propagates to every child.
  // Extension host debugging uses the explicit inspect argument above.
  delete environment.NODE_OPTIONS
  delete environment.VSCODE_INSPECTOR_OPTIONS
  environment[DEVELOPMENT_EXTENSIONS_ENV] = JSON.stringify(
    developmentExtensions.map((extension) => ({
      path: extension.path,
      ...(extension.uiDevServerOrigin ? { uiDevServerOrigin: extension.uiDevServerOrigin } : {})
    }))
  )

  return spawn(options.kisakiCommand, args, {
    cwd: options.cwd ?? process.cwd(),
    stdio: 'inherit',
    env: environment
  })
}

function createExtensionHostInspectArg(
  options: ExtensionHostInspectLaunchOptions | undefined
): string | null {
  if (!options) {
    return null
  }

  const argName =
    options.mode === 'inspect-brk' ? '--inspect-brk-extension-host' : '--inspect-extension-host'
  return options.address ? `${argName}=${options.address}` : argName
}
