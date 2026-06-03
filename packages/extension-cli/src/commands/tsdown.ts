import type { ChildProcess } from 'node:child_process'
import { constants } from 'node:fs'
import { access } from 'node:fs/promises'
import path from 'node:path'
import spawn from 'cross-spawn'
import { CliError } from '../logger'

export async function runTsdown(cwd: string, args: readonly string[]): Promise<void> {
  const child = await spawnTsdown(cwd, args)
  await new Promise<void>((resolve, reject) => {
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

export async function spawnTsdown(cwd: string, args: readonly string[]): Promise<ChildProcess> {
  const localBin = await resolveLocalTsdownBin(cwd)
  if (!localBin) {
    throw new CliError(
      'tsdown was not found in this extension project. Install project dependencies before running kisx build or kisx dev.'
    )
  }

  return spawn(localBin, args, {
    cwd,
    stdio: 'inherit'
  })
}

async function resolveLocalTsdownBin(cwd: string): Promise<string | null> {
  const binName = process.platform === 'win32' ? 'tsdown.cmd' : 'tsdown'
  const binPath = path.join(cwd, 'node_modules', '.bin', binName)

  try {
    await access(binPath, process.platform === 'win32' ? constants.F_OK : constants.X_OK)
    return binPath
  } catch {
    return null
  }
}
