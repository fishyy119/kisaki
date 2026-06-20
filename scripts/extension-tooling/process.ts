import spawn from 'cross-spawn'

export interface CapturedRunResult {
  readonly status: number | null
  readonly stdout: string
  readonly stderr: string
}

export function run(commandName: string, runArgs: readonly string[], cwd: string): void {
  const result = spawn.sync(commandName, runArgs, {
    cwd,
    stdio: 'inherit'
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(
      `${commandName} ${runArgs.join(' ')} failed with exit code ${String(result.status)}.`
    )
  }
}

export function runCapture(
  commandName: string,
  runArgs: readonly string[],
  cwd: string
): CapturedRunResult {
  const result = spawn.sync(commandName, runArgs, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe']
  })

  if (result.error) {
    throw result.error
  }

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  }
}

export function runAsync(
  commandName: string,
  runArgs: readonly string[],
  cwd: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, runArgs, {
      cwd,
      stdio: 'inherit'
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          `${commandName} ${runArgs.join(' ')} failed with exit code ${String(code ?? 'unknown')}.`
        )
      )
    })
  })
}
