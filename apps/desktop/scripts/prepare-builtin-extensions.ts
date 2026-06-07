import type { ChildProcess } from 'node:child_process'
import { access, cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import spawn from 'cross-spawn'

type BuildTarget = 'dev' | 'resources'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const desktopRoot = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(desktopRoot, '..', '..')
const builtinExtensionsRoot = path.join(repoRoot, 'extensions')
const extensionCliEntry = path.join(repoRoot, 'packages', 'extension-cli', 'src', 'index.ts')
const extensionBuildPackageNames = ['extension-api', 'extension-registry', 'extension-sdk'] as const
const extensionDebugPackageNames = ['extension-api', 'extension-sdk'] as const
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)

  if (command === 'build') {
    const target = parseTarget(args)
    await buildBuiltinExtensions(target)
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

async function buildBuiltinExtensions(target: BuildTarget): Promise<void> {
  const outputRoot = resolveOutputRoot(target)
  const debugSources = target === 'dev'
  const projects = await findBuiltinExtensionProjects()
  await resetOutputRoot(outputRoot)
  await prepareExtensionDebugPackages(outputRoot, debugSources)

  if (projects.length === 0) {
    console.log(`[builtin-extensions] No built-in extensions found in ${builtinExtensionsRoot}`)
    return
  }

  console.log(`[builtin-extensions] Building ${projects.length} built-in extension(s)`)
  for (const project of projects) {
    await runKisxOutput(project, outputRoot, false, debugSources)
  }
}

async function watchBuiltinExtensions(outputRoot: string, childCommand: string[]): Promise<void> {
  const projects = await findBuiltinExtensionProjects()
  await resetOutputRoot(outputRoot)
  await prepareExtensionDebugPackages(outputRoot, true)

  if (projects.length > 0) {
    console.log(`[builtin-extensions] Preparing ${projects.length} built-in extension(s)`)
    for (const project of projects) {
      await runKisxOutput(project, outputRoot, false, true)
    }
  } else {
    console.log(`[builtin-extensions] No built-in extensions found in ${builtinExtensionsRoot}`)
  }

  const watchers = projects.map((project) => spawnKisxOutputWatcher(project, outputRoot))
  const [appCommand, ...appArgs] = childCommand
  const appProcess = spawn(appCommand, appArgs, {
    cwd: desktopRoot,
    stdio: 'inherit'
  })

  let stopping = false
  const stop = (code = 0): void => {
    if (stopping) {
      return
    }

    stopping = true

    for (const watcher of watchers) {
      terminateProcess(watcher)
    }

    terminateProcess(appProcess)

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

async function prepareExtensionDebugPackages(
  outputRoot: string,
  debugSources: boolean
): Promise<void> {
  await buildExtensionPackages()
  await copyExtensionDebugPackages(resolveDebugPackagesRoot(outputRoot), debugSources)
}

async function buildExtensionPackages(): Promise<void> {
  for (const packageName of extensionBuildPackageNames) {
    await runProcess(pnpmCommand, ['--filter', `@kisaki3/${packageName}`, 'build'], repoRoot)
  }
}

async function copyExtensionDebugPackages(
  debugPackagesRoot: string,
  debugSources: boolean
): Promise<void> {
  await rm(debugPackagesRoot, { recursive: true, force: true })

  for (const packageName of extensionDebugPackageNames) {
    const sourceDir = path.join(repoRoot, 'packages', packageName, 'dist')
    const targetDir = path.join(debugPackagesRoot, packageName, 'dist')
    await mkdir(path.dirname(targetDir), { recursive: true })
    await cp(sourceDir, targetDir, { recursive: true })
    if (debugSources) {
      await rewriteCopiedDistSourceMaps(sourceDir, targetDir)
    }
  }
}

function runKisxOutput(
  projectDir: string,
  outputRoot: string,
  watch: boolean,
  debugSources: boolean
): Promise<void> {
  return runProcess(
    pnpmCommand,
    createKisxOutputArgs(projectDir, outputRoot, watch, debugSources),
    desktopRoot
  )
}

function spawnKisxOutputWatcher(projectDir: string, outputRoot: string): ChildProcess {
  return spawn(pnpmCommand, createKisxOutputArgs(projectDir, outputRoot, true, true, true), {
    cwd: desktopRoot,
    stdio: 'inherit'
  })
}

function createKisxOutputArgs(
  projectDir: string,
  outputRoot: string,
  watch: boolean,
  debugSources: boolean,
  skipInitialBuild = false
): string[] {
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

  if (debugSources) {
    args.push('--debug-sources')
  }

  if (watch) {
    args.push('--watch')
  }

  if (skipInitialBuild) {
    args.push('--skip-initial-build')
  }

  return args
}

function runProcess(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit'
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

function terminateProcess(child: ChildProcess): void {
  if (child.killed || child.exitCode !== null || child.signalCode !== null) {
    return
  }

  if (process.platform === 'win32' && child.pid) {
    spawn.sync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    return
  }

  child.kill()
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

function resolveDebugPackagesRoot(outputRoot: string): string {
  return path.join(path.dirname(outputRoot), 'packages')
}

async function rewriteCopiedDistSourceMaps(
  sourceDistDir: string,
  targetDistDir: string
): Promise<void> {
  const entries = await readdir(targetDistDir, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(sourceDistDir, entry.name)
    const targetPath = path.join(targetDistDir, entry.name)

    if (entry.isDirectory()) {
      await rewriteCopiedDistSourceMaps(sourcePath, targetPath)
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.map')) {
      await rewriteSourceMapSourceRoot(targetPath, sourceDistDir)
    }
  }
}

async function rewriteSourceMapSourceRoot(mapPath: string, originalMapDir: string): Promise<void> {
  const sourceMap = JSON.parse(await readFile(mapPath, 'utf8')) as Record<string, unknown>
  sourceMap.sourceRoot = toDirectoryFileUrl(originalMapDir)
  await writeFile(mapPath, `${JSON.stringify(sourceMap)}\n`)
}

function toDirectoryFileUrl(directoryPath: string): string {
  const directoryWithSeparator = directoryPath.endsWith(path.sep)
    ? directoryPath
    : `${directoryPath}${path.sep}`
  return pathToFileURL(directoryWithSeparator).href
}

main().catch((error: unknown) => {
  console.error('[builtin-extensions]', error instanceof Error ? error.message : error)
  process.exit(1)
})
