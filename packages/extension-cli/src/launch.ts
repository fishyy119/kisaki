import { spawn, type ChildProcess } from 'node:child_process'
import type { ExtensionProject } from './project'

export interface DevLaunchOptions {
  kisakiCommand: string
}

/**
 * Starts Kisaki with the current project attached as a development extension.
 */
export function launchKisaki(project: ExtensionProject, options: DevLaunchOptions): ChildProcess {
  return spawn(options.kisakiCommand, [`--dev-extension=${project.rootDir}`], {
    cwd: project.rootDir,
    stdio: 'inherit',
    shell: false
  })
}
