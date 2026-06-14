import type { ChildProcess } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { access, cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import spawn from 'cross-spawn'

type BuildTarget = 'dev' | 'resources'

interface ExtensionToolingPackage {
  readonly name: string
  readonly dir: string
}

interface ExtensionToolingManifest {
  readonly packages: readonly ExtensionToolingPackage[]
  readonly internalDependencies: Record<string, readonly string[]>
  readonly buildPackageGroups: readonly (readonly string[])[]
}

interface BuiltinExtensionPackageJson {
  readonly dependencies?: Record<string, string>
  readonly devDependencies?: Record<string, string>
  readonly optionalDependencies?: Record<string, string>
  readonly peerDependencies?: Record<string, string>
}

interface BuiltinExtensionWatcher {
  readonly process: ChildProcess
  readonly ready: Promise<void>
}

interface BuiltinExtensionUiDevServer {
  readonly process: ChildProcess
  readonly ready: Promise<BuiltinExtensionUiDevServerReady>
}

interface BuiltinExtensionUiDevServerReady {
  readonly project: string
  readonly origin: string
}

const kisxWatchReadyMessageType = 'kisx:watch-ready'
const kisxUiDevServerReadyMessageType = 'kisx:ui-dev-server-ready'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const desktopRoot = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(desktopRoot, '..', '..')
const builtinExtensionsRoot = path.join(repoRoot, 'extensions')
const extensionCliEntry = path.join(repoRoot, 'packages', 'extension-cli', 'src', 'index.ts')
const extensionToolingManifest = readExtensionToolingManifest()
const extensionDebugPackageNames = ['@kisaki3/extension-api', '@kisaki3/extension-sdk'] as const
const extensionPackageDependencyFields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies'
] as const
const extensionToolingPackagesByName = new Map(
  extensionToolingManifest.packages.map((toolingPackage) => [toolingPackage.name, toolingPackage])
)
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
  await prepareExtensionDebugPackages(outputRoot, debugSources, projects)

  if (projects.length === 0) {
    console.log(`[builtin-extensions] No built-in extensions found in ${builtinExtensionsRoot}`)
    return
  }

  console.log(`[builtin-extensions] Building ${projects.length} built-in extension(s)`)
  await Promise.all(projects.map((project) => runKisxOutput(project, outputRoot)))
}

async function watchBuiltinExtensions(outputRoot: string, childCommand: string[]): Promise<void> {
  const projects = await findBuiltinExtensionProjects()
  await resetOutputRoot(outputRoot)
  await prepareExtensionDebugPackages(outputRoot, true, projects)

  if (projects.length === 0) {
    console.log(`[builtin-extensions] No built-in extensions found in ${builtinExtensionsRoot}`)
  } else {
    console.log(`[builtin-extensions] Building ${projects.length} built-in extension(s)`)
    // Start from a clean dist so the readiness wait below only observes the fresh
    // watch build, never stale output from a previous run.
    await Promise.all(
      projects.map((project) => rm(path.join(project, 'dist'), { recursive: true, force: true }))
    )
  }

  const uiProjects = await findBuiltinExtensionProjectsWithUi(projects)
  const watchers = projects.map((project) => spawnKisxHostBuildWatcher(project))
  const uiServers = uiProjects.map((project) => spawnKisxUiDevServer(project))
  let uiServerOrigins = new Map<string, string>()

  try {
    const readyUiServers = await Promise.all([
      waitForBuiltinExtensionWatchersReady(watchers),
      waitForBuiltinExtensionUiDevServersReady(uiServers)
    ]).then(([, origins]) => origins)
    uiServerOrigins = new Map(
      readyUiServers.map((server) => [path.resolve(server.project), server.origin])
    )
  } catch (error) {
    for (const watcher of watchers) {
      terminateProcess(watcher.process)
    }
    for (const uiServer of uiServers) {
      terminateProcess(uiServer.process)
    }
    throw error
  }

  const [appCommand, ...appArgs] = childCommand
  const appProcess = spawn(appCommand, appArgs, {
    cwd: desktopRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      KISAKI_DEV_EXTENSIONS: JSON.stringify(
        projects.map((project) => {
          const uiDevServerOrigin = uiServerOrigins.get(path.resolve(project))
          return {
            path: project,
            ...(uiDevServerOrigin ? { uiDevServerOrigin } : {})
          }
        })
      )
    }
  })

  let stopping = false
  const stop = (code = 0): void => {
    if (stopping) {
      return
    }

    stopping = true

    for (const watcher of watchers) {
      terminateProcess(watcher.process)
    }
    for (const uiServer of uiServers) {
      terminateProcess(uiServer.process)
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
    watcher.process.on('close', (code) => {
      if (!stopping && code !== 0 && code !== null) {
        console.error(`[builtin-extensions] Extension build watcher exited with code ${code}`)
        stop(code)
      }
    })
  }
  for (const uiServer of uiServers) {
    uiServer.process.on('close', (code) => {
      if (!stopping && code !== 0 && code !== null) {
        console.error(`[builtin-extensions] Extension UI dev server exited with code ${code}`)
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
  debugSources: boolean,
  projects: readonly string[]
): Promise<void> {
  await buildExtensionPackages(projects)
  await copyExtensionDebugPackages(resolveDebugPackagesRoot(outputRoot), debugSources)
}

async function buildExtensionPackages(projects: readonly string[]): Promise<void> {
  const packageNames = await collectRequiredExtensionToolingPackages(projects)
  const packageGroups = resolveExtensionToolingBuildGroups(packageNames)

  for (const packageGroup of packageGroups) {
    await Promise.all(
      packageGroup.map((packageName) =>
        runProcess(pnpmCommand, ['--filter', packageName, 'build'], repoRoot)
      )
    )
  }
}

async function collectRequiredExtensionToolingPackages(
  projects: readonly string[]
): Promise<Set<string>> {
  const packageNames = new Set<string>()

  for (const packageName of extensionDebugPackageNames) {
    addExtensionToolingPackageWithDependencies(packageNames, packageName)
  }

  for (const project of projects) {
    const packageJson = JSON.parse(
      await readFile(path.join(project, 'package.json'), 'utf8')
    ) as BuiltinExtensionPackageJson

    for (const dependencyField of extensionPackageDependencyFields) {
      const dependencies = packageJson[dependencyField]
      if (!dependencies) {
        continue
      }

      for (const [packageName, versionRange] of Object.entries(dependencies)) {
        if (versionRange === 'workspace:*' && extensionToolingPackagesByName.has(packageName)) {
          addExtensionToolingPackageWithDependencies(packageNames, packageName)
        }
      }
    }
  }

  return packageNames
}

function addExtensionToolingPackageWithDependencies(
  packageNames: Set<string>,
  packageName: string
): void {
  if (packageNames.has(packageName)) {
    return
  }

  packageNames.add(packageName)

  for (const dependencyName of extensionToolingManifest.internalDependencies[packageName] ?? []) {
    addExtensionToolingPackageWithDependencies(packageNames, dependencyName)
  }
}

function resolveExtensionToolingBuildGroups(
  packageNames: ReadonlySet<string>
): readonly (readonly string[])[] {
  const packageGroups: string[][] = extensionToolingManifest.buildPackageGroups
    .map((packageGroup) => [...packageGroup].filter((packageName) => packageNames.has(packageName)))
    .filter((packageGroup) => packageGroup.length > 0)

  const groupedPackageNames = new Set(packageGroups.flat())
  const missingPackageNames = [...packageNames].filter(
    (packageName) => !groupedPackageNames.has(packageName)
  )

  if (missingPackageNames.length > 0) {
    throw new Error(
      `Missing extension tooling build group for package(s): ${missingPackageNames.join(', ')}`
    )
  }

  return packageGroups
}

async function copyExtensionDebugPackages(
  debugPackagesRoot: string,
  debugSources: boolean
): Promise<void> {
  await rm(debugPackagesRoot, { recursive: true, force: true })

  for (const packageName of extensionDebugPackageNames) {
    const toolingPackage = requireExtensionToolingPackage(packageName)
    const sourceDir = path.join(repoRoot, toolingPackage.dir, 'dist')
    const targetDir = path.join(debugPackagesRoot, path.basename(toolingPackage.dir), 'dist')
    await mkdir(path.dirname(targetDir), { recursive: true })
    await cp(sourceDir, targetDir, { recursive: true })
    if (debugSources) {
      await rewriteCopiedDistSourceMaps(sourceDir, targetDir)
    }
  }
}

function requireExtensionToolingPackage(packageName: string): ExtensionToolingPackage {
  const toolingPackage = extensionToolingPackagesByName.get(packageName)
  if (!toolingPackage) {
    throw new Error(`Unknown extension tooling package: ${packageName}`)
  }

  return toolingPackage
}

function readExtensionToolingManifest(): ExtensionToolingManifest {
  const manifestPath = path.join(repoRoot, 'packages', 'extension-tooling-manifest.json')
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as ExtensionToolingManifest
}

function runKisxOutput(projectDir: string, outputRoot: string): Promise<void> {
  return runProcess(
    process.execPath,
    createKisxCliArgs(['output', '--project', projectDir, '--out-dir', outputRoot]),
    desktopRoot
  )
}

function spawnKisxHostBuildWatcher(projectDir: string): BuiltinExtensionWatcher {
  const child = spawn(
    process.execPath,
    createKisxCliArgs(['build', '--project', projectDir, '--watch', '--host-only']),
    {
      cwd: desktopRoot,
      stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    }
  )

  return {
    process: child,
    ready: waitForKisxWatcherReady(projectDir, child)
  }
}

function spawnKisxUiDevServer(projectDir: string): BuiltinExtensionUiDevServer {
  const child = spawn(
    process.execPath,
    createKisxCliArgs(['ui-dev-server', '--project', projectDir]),
    {
      cwd: desktopRoot,
      stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    }
  )

  return {
    process: child,
    ready: waitForKisxUiDevServerReady(projectDir, child)
  }
}

function createKisxCliArgs(args: readonly string[]): string[] {
  return ['--import', 'tsx', extensionCliEntry, ...args]
}

async function waitForBuiltinExtensionWatchersReady(
  watchers: readonly BuiltinExtensionWatcher[]
): Promise<void> {
  await Promise.all(watchers.map((watcher) => watcher.ready))
}

async function waitForBuiltinExtensionUiDevServersReady(
  servers: readonly BuiltinExtensionUiDevServer[]
): Promise<readonly BuiltinExtensionUiDevServerReady[]> {
  return await Promise.all(servers.map((server) => server.ready))
}

function waitForKisxWatcherReady(projectDir: string, child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      child.off('message', handleMessage)
      child.off('error', handleError)
      child.off('close', handleClose)
    }

    const handleMessage = (message: unknown): void => {
      if (!isKisxWatchReadyMessage(message)) {
        return
      }

      if (path.resolve(message.project) !== path.resolve(projectDir)) {
        return
      }

      cleanup()
      resolve()
    }

    const handleError = (error: Error): void => {
      cleanup()
      reject(error)
    }

    const handleClose = (code: number | null): void => {
      cleanup()
      reject(
        new Error(
          `Built-in extension watcher for ${path.basename(projectDir)} exited before its first build with code ${code ?? 'unknown'}.`
        )
      )
    }

    child.on('message', handleMessage)
    child.on('error', handleError)
    child.on('close', handleClose)
  })
}

function waitForKisxUiDevServerReady(
  projectDir: string,
  child: ChildProcess
): Promise<BuiltinExtensionUiDevServerReady> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      child.off('message', handleMessage)
      child.off('error', handleError)
      child.off('close', handleClose)
    }

    const handleMessage = (message: unknown): void => {
      if (!isKisxUiDevServerReadyMessage(message)) {
        return
      }

      if (path.resolve(message.project) !== path.resolve(projectDir)) {
        return
      }

      cleanup()
      resolve({ project: message.project, origin: message.origin })
    }

    const handleError = (error: Error): void => {
      cleanup()
      reject(error)
    }

    const handleClose = (code: number | null): void => {
      cleanup()
      reject(
        new Error(
          `Built-in extension UI dev server for ${path.basename(projectDir)} exited before it was ready with code ${code ?? 'unknown'}.`
        )
      )
    }

    child.on('message', handleMessage)
    child.on('error', handleError)
    child.on('close', handleClose)
  })
}

function isKisxWatchReadyMessage(
  message: unknown
): message is { readonly type: string; readonly project: string } {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    'project' in message &&
    message.type === kisxWatchReadyMessageType &&
    typeof message.project === 'string'
  )
}

function isKisxUiDevServerReadyMessage(
  message: unknown
): message is { readonly type: string; readonly project: string; readonly origin: string } {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    'project' in message &&
    'origin' in message &&
    message.type === kisxUiDevServerReadyMessageType &&
    typeof message.project === 'string' &&
    typeof message.origin === 'string'
  )
}

async function findBuiltinExtensionProjectsWithUi(projects: readonly string[]): Promise<string[]> {
  const uiProjects: string[] = []

  for (const project of projects) {
    if (await hasBuiltinExtensionUi(project)) {
      uiProjects.push(project)
    }
  }

  return uiProjects
}

async function hasBuiltinExtensionUi(projectDir: string): Promise<boolean> {
  try {
    const manifest = JSON.parse(
      await readFile(path.join(projectDir, 'manifest.json'), 'utf8')
    ) as Record<string, unknown>
    return typeof manifest.ui === 'string' && manifest.ui.trim().length > 0
  } catch {
    return false
  }
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
