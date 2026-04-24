import { spawn } from 'node:child_process'
import { CliError, logger } from '../logger'
import { readValidManifest } from '../manifest'
import { resolveProject } from '../project'

/**
 * Builds the current extension with tsdown.
 */
export async function buildCommand(): Promise<void> {
  const project = await resolveProject()

  logger.heading('kisx build', 'Building extension with tsdown.')
  await readValidManifest(project, { checkEntry: false, checkProjectFiles: true })
  await runTsdown(project.rootDir, [])
  await readValidManifest(project, { checkEntry: true })
  logger.success('Extension build completed.')
}

export async function runTsdown(cwd: string, args: readonly string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const command = createNpxCommand(['tsdown', ...args])
    const child = spawn(command.bin, command.args, {
      cwd,
      stdio: 'inherit',
      shell: false
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new CliError(`tsdown exited with code ${code ?? 'unknown'}.`))
      }
    })
  })
}

function createNpxCommand(args: readonly string[]): { bin: string; args: string[] } {
  if (process.platform === 'win32') {
    return {
      bin: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npx', ...args]
    }
  }

  return {
    bin: 'npx',
    args: [...args]
  }
}
