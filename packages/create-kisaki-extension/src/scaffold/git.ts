import spawn from 'cross-spawn'

/** Initializes a Git repository with `main` as its default branch. */
export function initializeGitRepository(targetDir: string): void {
  runGit(targetDir, ['init', '-b', 'main'])
}

/** Creates one commit containing every current workspace change. */
export function commitGitChanges(targetDir: string, message: string): void {
  runGit(targetDir, ['add', '-A'])
  runGit(targetDir, ['commit', '-m', message])
}

/** Commits only the named workspace paths without absorbing unrelated changes. */
export function commitGitPaths(
  targetDir: string,
  message: string,
  relativePaths: readonly string[]
): void {
  if (relativePaths.length === 0) {
    throw new Error('At least one Git path is required for a scoped commit.')
  }

  runGit(targetDir, ['add', '--', ...relativePaths])
  runGit(targetDir, ['commit', '--only', '-m', message, '--', ...relativePaths])
}

/** Checks whether a directory belongs to a Git worktree. */
export function matchesGitRepository(targetDir: string): boolean {
  return runGit(targetDir, ['rev-parse', '--is-inside-work-tree'], true) === 0
}

/** Reads the configured Git author name for scaffold defaults. */
export function readGitUserName(targetDir = process.cwd()): string | undefined {
  const result = spawn.sync('git', ['config', 'user.name'], {
    cwd: targetDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  })
  const name = typeof result.stdout === 'string' ? result.stdout.trim() : ''
  return result.status === 0 && name ? name : undefined
}

function runGit(cwd: string, args: readonly string[], allowFailure = false): number {
  const result = spawn.sync('git', [...args], { cwd, stdio: 'ignore' })
  if (result.error) {
    throw new Error(`Could not run git: ${result.error.message}`)
  }

  const status = result.status ?? 1
  if (status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(' ')} failed with exit code ${String(status)}.`)
  }

  return status
}
