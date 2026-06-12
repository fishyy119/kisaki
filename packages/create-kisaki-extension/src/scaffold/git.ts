import spawn from 'cross-spawn'

export interface GitInitResult {
  gitInitialized: boolean
  initialCommitCreated: boolean
}

export function initGit(targetDir: string, extensionName: string): GitInitResult {
  try {
    initGitMainBranch(targetDir)
  } catch {
    return { gitInitialized: false, initialCommitCreated: false }
  }

  try {
    runGit(targetDir, ['add', '-A'])
    runGit(targetDir, ['commit', '-m', `Initial commit: ${extensionName}`])
    return { gitInitialized: true, initialCommitCreated: true }
  } catch {
    return { gitInitialized: true, initialCommitCreated: false }
  }
}

function initGitMainBranch(targetDir: string): void {
  try {
    runGit(targetDir, ['init', '-b', 'main'])
    return
  } catch {
    runGit(targetDir, ['init'])
  }

  runGit(targetDir, ['branch', '-M', 'main'])
}

function runGit(cwd: string, args: readonly string[]): void {
  const result = spawn.sync('git', args, { cwd, stdio: 'ignore' })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed with exit code ${String(result.status)}.`)
  }
}
