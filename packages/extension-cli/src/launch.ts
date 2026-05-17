import { spawn, type ChildProcess } from 'node:child_process'

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
 * Starts Kisaki with the package output attached as a development extension.
 */
export function launchKisaki(extensionPath: string, options: DevLaunchOptions): ChildProcess {
  const args = [`--dev-extension=${extensionPath}`]
  const inspectArg = createExtensionHostInspectArg(options.extensionHostInspect)
  if (inspectArg) {
    args.push(inspectArg)
  }

  return spawn(options.kisakiCommand, args, {
    cwd: options.cwd ?? process.cwd(),
    stdio: 'inherit',
    shell: false
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
