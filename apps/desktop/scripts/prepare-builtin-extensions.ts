import { spawn, type ChildProcess } from 'node:child_process'
import { access, mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type BuildTarget = 'dev' | 'resources'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const desktopRoot = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(desktopRoot, '..', '..')
const builtinExtensionsRoot = path.join(repoRoot, 'extensions')
const extensionCliEntry = path.join(repoRoot, 'packages', 'extension-cli', 'src', 'index.ts')
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const shouldUseShell = process.platform === 'win32'

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)

  if (command === 'build') {
    const target = parseTarget(args)
    await buildBuiltinExtensions(resolveOutputRoot(target))
    return
  }

  if (command === 'watch') {
    const childCommand = parseChildCommand(args)
    if (childCommand.length === 0) {
      throw new Error('watch requires a command after --')
    }

    await watchBuiltinExtensions(resolveOutputRoot('dev'), childCommand)
    return
  }

  throw new Error('Usage: prepare-builtin-extensions.ts <build|watch>')
}

async function buildBuiltinExtensions(outputRoot: string): Promise<void> {
  const projects = await findBuiltinExtensionProjects()
  await resetOutputRoot(outputRoot)

  if (projects.length === 0) {
    console.log(`[builtin-extensions] No built-in extensions found in ${builtinExtensionsRoot}`)
    return
  }

  console.log(`[builtin-extensions] Building ${projects.length} built-in extension(s)`)
  for (const project of projects) {
    await runKisxOutput(project, outputRoot, false)
  }
}

async function watchBuiltinExtensions(outputRoot: string, childCommand: string[]): Promise<void> {
  const projects = await findBuiltinExtensionProjects()
  await resetOutputRoot(outputRoot)

  if (projects.length > 0) {
    console.log(`[builtin-extensions] Preparing ${projects.length} built-in extension(s)`)
    for (const project of projects) {
      await runKisxOutput(project, outputRoot, false)
    }
  } else {
    console.log(`[builtin-extensions] No built-in extensions found in ${builtinExtensionsRoot}`)
  }

  const watchers = projects.map((project) => spawnKisxOutputWatcher(project, outputRoot))
  const [appCommand, ...appArgs] = childCommand
  const appProcess = spawn(appCommand, appArgs, {
    cwd: desktopRoot,
    stdio: 'inherit',
    shell: shouldUseShell
  })

  let stopping = false
  const stop = (code = 0): void => {
    if (stopping) {
      return
    }

    stopping = true

    for (const watcher of watchers) {
      if (!watcher.killed) {
        watcher.kill()
      }
    }

    if (!appProcess.killed) {
      appProcess.kill()
    }

    process.exit(code)
  }

  appProcess.on('error', (error) => {
    console.error(`[builtin-extensions] Failed to start ${appCommand}:`, error)
    stop(1)
  })

  appProcess.on('close', (code) => {
    stop(code ?? 0)
  })

  for (const watcher of watchers) {
    watcher.on('close', (code) => {
      if (!stopping && code !== 0 && code !== null) {
        console.error(`[builtin-extensions] Extension output watcher exited with code ${code}`)
        stop(code)
      }
    })
  }

  process.once('SIGINT', () => stop(130))
  process.once('SIGTERM', () => stop(143))

  await new Promise<void>(() => undefined)
}

async function findBuiltinExtensionProjects(): Promise<string[]> {
  await mkdir(builtinExtensionsRoot, { recursive: true })

  const entries = await readdir(builtinExtensionsRoot, { withFileTypes: true })
  const projects: string[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const projectDir = path.join(builtinExtensionsRoot, entry.name)
    const manifestPath = path.join(projectDir, 'manifest.json')

    try {
      await access(manifestPath)
      projects.push(projectDir)
    } catch {
      continue
    }
  }

  return projects.sort((left, right) => left.localeCompare(right, 'en'))
}

async function resetOutputRoot(outputRoot: string): Promise<void> {
  await rm(outputRoot, { recursive: true, force: true })
  await mkdir(outputRoot, { recursive: true })
}

function runKisxOutput(projectDir: string, outputRoot: string, watch: boolean): Promise<void> {
  return runProcess(pnpmCommand, createKisxOutputArgs(projectDir, outputRoot, watch), desktopRoot)
}

function spawnKisxOutputWatcher(projectDir: string, outputRoot: string): ChildProcess {
  return spawn(pnpmCommand, createKisxOutputArgs(projectDir, outputRoot, true), {
    cwd: desktopRoot,
    stdio: 'inherit',
    shell: shouldUseShell
  })
}

function createKisxOutputArgs(projectDir: string, outputRoot: string, watch: boolean): string[] {
  const args = [
    'exec',
    'tsx',
    extensionCliEntry,
    'output',
    '--project',
    projectDir,
    '--out-dir',
    outputRoot
  ]

  if (watch) {
    args.push('--watch')
  }

  return args
}

function runProcess(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: shouldUseShell
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} exited with code ${code ?? 'unknown'}`))
      }
    })
  })
}

function parseTarget(args: string[]): BuildTarget {
  const targetArg = args.find((arg) => arg.startsWith('--target='))
  const target = targetArg ? targetArg.slice('--target='.length) : 'dev'

  if (target === 'dev' || target === 'resources') {
    return target
  }

  throw new Error(`Unknown built-in extension output target: ${target}`)
}

function parseChildCommand(args: string[]): string[] {
  const separatorIndex = args.indexOf('--')
  if (separatorIndex === -1) {
    return []
  }

  return args.slice(separatorIndex + 1)
}

function resolveOutputRoot(target: BuildTarget): string {
  if (target === 'resources') {
    return path.join(desktopRoot, 'resources', 'extensions')
  }

  return path.join(desktopRoot, 'out', 'extensions')
}

main().catch((error: unknown) => {
  console.error('[builtin-extensions]', error instanceof Error ? error.message : error)
  process.exit(1)
})
