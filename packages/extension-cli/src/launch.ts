import { spawn, type ChildProcess } from 'node:child_process'

export interface DevLaunchOptions {
  kisakiCommand: string
  cwd?: string
}

/**
 * Starts Kisaki with the package output attached as a development extension.
 */
export function launchKisaki(extensionPath: string, options: DevLaunchOptions): ChildProcess {
  return spawn(options.kisakiCommand, [`--dev-extension=${extensionPath}`], {
    cwd: options.cwd ?? process.cwd(),
    stdio: 'inherit',
    shell: false
  })
}
