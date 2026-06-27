import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { appendFileSync } from 'node:fs'

interface CommandOptions {
  env?: NodeJS.ProcessEnv
}

export function readRequiredEnv(name: string): string {
  const value = process.env[name]
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required.`)
  }
  return value
}

export function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]
  return value && value.length > 0 ? value : undefined
}

export function run(command: string, args: readonly string[], options: CommandOptions = {}): void {
  execFileSync(command, [...args], {
    env: { ...process.env, ...options.env },
    stdio: 'inherit'
  })
}

export function readCommand(
  command: string,
  args: readonly string[],
  options: CommandOptions = {}
): string {
  return execFileSync(command, [...args], {
    env: { ...process.env, ...options.env },
    encoding: 'utf8'
  }).trim()
}

export function commandSucceeds(
  command: string,
  args: readonly string[],
  options: CommandOptions = {}
): boolean {
  try {
    execFileSync(command, [...args], {
      env: { ...process.env, ...options.env },
      stdio: 'ignore'
    })
    return true
  } catch {
    return false
  }
}

export function writeGithubOutput(values: Record<string, string | boolean>): void {
  const outputPath = process.env.GITHUB_OUTPUT
  for (const [key, rawValue] of Object.entries(values)) {
    const value = String(rawValue)
    if (!outputPath) {
      console.log(`${key}=${value}`)
      continue
    }

    if (value.includes('\n')) {
      const delimiter = `kisaki_${randomUUID()}`
      appendFileSync(outputPath, `${key}<<${delimiter}\n${value}\n${delimiter}\n`)
    } else {
      appendFileSync(outputPath, `${key}=${value}\n`)
    }
  }
}

export function configureGitHubActionsAuthor(): void {
  run('git', ['config', 'user.name', 'github-actions[bot]'])
  run('git', ['config', 'user.email', 'github-actions[bot]@users.noreply.github.com'])
}
