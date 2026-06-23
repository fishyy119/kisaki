import spawn from 'cross-spawn'

/** Installs repository dependencies with the package manager declared by the scaffold. */
export function installDependencies(targetDir: string): void {
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const result = spawn.sync(command, ['install'], { cwd: targetDir, stdio: 'inherit' })

  if (result.error) {
    throw new Error(`Could not run pnpm install: ${result.error.message}`)
  }

  if (result.status !== 0) {
    throw new Error(`pnpm install failed with exit code ${String(result.status ?? 'unknown')}.`)
  }
}
