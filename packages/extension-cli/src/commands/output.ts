import path from 'node:path'
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { watch, type FSWatcher } from 'chokidar'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import { CliError, logger } from '../logger'
import { readValidManifest } from '../manifest'
import { type ExtensionProject, pathExists, resolveEntryFile, resolveProject } from '../project'
import { copyExtensionPackageFiles } from '../package-layout'
import { runTsdown } from './tsdown'

export interface OutputCommandOptions {
  outDir: string
  project?: string
  watch?: boolean
  debugSources?: boolean
  skipInitialBuild?: boolean
}

export interface ExtensionOutputOptions {
  outDir: string
  preservePackageRoot?: boolean
  debugSources?: boolean
  initialBuild?: boolean
}

export interface ExtensionOutputResult {
  manifest: ExtensionManifest
  packagePath: string
}

export interface ExtensionOutputWatchSession {
  project: ExtensionProject
  packagePath: string
  ready: Promise<ExtensionOutputResult>
  close(): Promise<void>
}

/**
 * Builds or watch-builds an unpacked extension package directory.
 */
export async function outputCommand(options: OutputCommandOptions): Promise<void> {
  const project = await resolveProject(options.project)

  if (options.watch) {
    logger.heading('kisx output --watch', 'Watching extension package output.')
    logger.detail(`Project: ${project.rootDir}`)
    logger.detail(`Output: ${path.resolve(project.rootDir, options.outDir)}`)
    if (options.debugSources) {
      logger.detail('Debug source maps: enabled')
    }
    if (options.skipInitialBuild) {
      logger.detail('Initial build: skipped')
    }

    const session = await watchExtensionOutput(project, {
      outDir: options.outDir,
      ...(options.debugSources === undefined ? {} : { debugSources: options.debugSources }),
      ...(options.skipInitialBuild === undefined ? {} : { initialBuild: !options.skipInitialBuild })
    })
    const result = await session.ready
    logger.success(`Output ready at ${path.relative(project.rootDir, result.packagePath)}`)

    let stopped = false
    const stop = (code = 0): void => {
      if (stopped) {
        return
      }

      stopped = true
      void session.close().finally(() => process.exit(code))
    }

    process.once('SIGINT', () => stop(130))
    process.once('SIGTERM', () => stop(143))

    await new Promise<void>(() => undefined)
    return
  }

  logger.heading('kisx output', 'Building extension package output.')
  logger.detail(`Project: ${project.rootDir}`)
  logger.detail(`Output: ${path.resolve(project.rootDir, options.outDir)}`)
  if (options.debugSources) {
    logger.detail('Debug source maps: enabled')
  }

  const result = await buildExtensionOutput(project, {
    outDir: options.outDir,
    ...(options.debugSources === undefined ? {} : { debugSources: options.debugSources })
  })
  logger.success(`Output written to ${path.relative(project.rootDir, result.packagePath)}`)
}

/**
 * Builds the extension and writes the official unpacked package layout to outDir/id.
 */
export async function buildExtensionOutput(
  project: ExtensionProject,
  options: ExtensionOutputOptions
): Promise<ExtensionOutputResult> {
  await readValidManifest(project, { checkEntry: false, checkProjectFiles: true })
  await runTsdown(project.rootDir, [])

  const manifest = await readValidManifest(project, { checkEntry: true, checkProjectFiles: true })
  const packagePath = await writeExtensionPackageOutput(project, manifest, options)

  return { manifest, packagePath }
}

/**
 * Watches extension project inputs, rebuilds with tsdown, and keeps outDir/id synchronized.
 */
export async function watchExtensionOutput(
  project: ExtensionProject,
  options: ExtensionOutputOptions
): Promise<ExtensionOutputWatchSession> {
  const manifest = await readValidManifest(project, { checkEntry: false, checkProjectFiles: true })
  const outputRoot = path.resolve(project.rootDir, options.outDir)
  const packagePath = path.join(outputRoot, manifest.id)
  const initialBuild = options.initialBuild ?? true

  let watcher: FSWatcher | null = null
  let debounceTimer: NodeJS.Timeout | null = null
  let closed = false
  let readySettled = false
  let refreshRunning = false
  let refreshQueued = false
  let lastSyncError: string | null = null

  let resolveReady!: (result: ExtensionOutputResult) => void
  const ready = new Promise<ExtensionOutputResult>((resolve) => {
    resolveReady = resolve
  })

  const settleReadyFromExistingOutput = async (): Promise<void> => {
    if (closed) {
      return
    }

    try {
      const currentManifest = await readValidManifest(project, {
        checkEntry: true,
        checkProjectFiles: true
      })
      const currentEntryPath = resolveEntryFile(project, currentManifest)
      if (!currentEntryPath || !(await pathExists(currentEntryPath))) {
        throw new CliError('Built entry is not ready yet.')
      }

      if (!(await pathExists(path.join(packagePath, 'manifest.json')))) {
        throw new CliError('Existing package output is not ready yet.')
      }

      lastSyncError = null
      if (!readySettled) {
        readySettled = true
        resolveReady({ manifest: currentManifest, packagePath })
      }
    } catch (error) {
      const message = toErrorMessage(error)
      if (message !== lastSyncError) {
        logger.warn(`Output sync waiting: ${message}`)
        lastSyncError = message
      }
      scheduleRefresh()
    }
  }

  const refreshOutput = async (): Promise<void> => {
    if (closed) {
      return
    }

    try {
      await readValidManifest(project, { checkEntry: false, checkProjectFiles: true })
      await runTsdown(project.rootDir, [])

      const currentManifest = await readValidManifest(project, {
        checkEntry: true,
        checkProjectFiles: true
      })
      const currentEntryPath = resolveEntryFile(project, currentManifest)
      if (!currentEntryPath || !(await pathExists(currentEntryPath))) {
        throw new CliError('Built entry is not ready yet.')
      }

      const currentPackagePath = await writeExtensionPackageOutput(project, currentManifest, {
        ...options,
        preservePackageRoot: true
      })

      lastSyncError = null
      logger.detail(`Synced ${path.relative(project.rootDir, currentPackagePath)}`)

      if (!readySettled) {
        readySettled = true
        resolveReady({ manifest: currentManifest, packagePath: currentPackagePath })
      }
    } catch (error) {
      const message = toErrorMessage(error)
      if (message !== lastSyncError) {
        logger.warn(`Output sync waiting: ${message}`)
        lastSyncError = message
      }
    }
  }

  const runRefreshQueue = async (): Promise<void> => {
    if (closed) {
      return
    }

    if (refreshRunning) {
      refreshQueued = true
      return
    }

    refreshRunning = true
    try {
      do {
        refreshQueued = false
        await refreshOutput()
      } while (refreshQueued && !closed)
    } finally {
      refreshRunning = false
    }
  }

  const scheduleRefresh = (): void => {
    if (closed) {
      return
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void runRefreshQueue()
    }, 150)
  }

  const close = async (): Promise<void> => {
    if (closed) {
      return
    }

    closed = true

    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }

    if (watcher) {
      await watcher.close()
      watcher = null
    }
  }

  watcher = watch(project.rootDir, {
    ignored: (filePath) => isIgnoredOutputWatchPath(project, outputRoot, filePath),
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 250,
      pollInterval: 50
    }
  })

  watcher.on('add', scheduleRefresh)
  watcher.on('change', scheduleRefresh)
  watcher.on('unlink', scheduleRefresh)
  watcher.on('addDir', scheduleRefresh)
  watcher.on('unlinkDir', scheduleRefresh)
  watcher.on('error', (error) => {
    logger.warn(`Output watcher error: ${toErrorMessage(error)}`)
  })

  if (initialBuild) {
    scheduleRefresh()
  } else {
    void settleReadyFromExistingOutput()
  }

  return {
    project,
    packagePath,
    ready,
    close
  }
}

async function writeExtensionPackageOutput(
  project: ExtensionProject,
  manifest: ExtensionManifest,
  options: ExtensionOutputOptions
): Promise<string> {
  const outputRoot = path.resolve(project.rootDir, options.outDir)
  const packagePath = path.join(outputRoot, manifest.id)

  if (options.preservePackageRoot) {
    await mkdir(packagePath, { recursive: true })
    await clearDirectoryContents(packagePath)
    await copyPackageFiles(project, manifest, packagePath)
    if (options.debugSources) {
      await rewriteCopiedDistSourceMaps(project.distDir, path.join(packagePath, 'dist'))
    }
    return packagePath
  }

  const tempPackagePath = path.join(outputRoot, `.${manifest.id}.tmp-${process.pid}-${Date.now()}`)

  await removePath(tempPackagePath)
  await mkdir(tempPackagePath, { recursive: true })

  try {
    await copyPackageFiles(project, manifest, tempPackagePath)
    if (options.debugSources) {
      await rewriteCopiedDistSourceMaps(project.distDir, path.join(tempPackagePath, 'dist'))
    }

    await replacePath(tempPackagePath, packagePath)
    return packagePath
  } catch (error) {
    await removePath(tempPackagePath).catch(() => undefined)
    throw error
  }
}

async function copyPackageFiles(
  project: ExtensionProject,
  manifest: ExtensionManifest,
  packagePath: string
): Promise<void> {
  await copyExtensionPackageFiles(project, manifest, packagePath)
}

async function clearDirectoryContents(directoryPath: string): Promise<void> {
  const entries = await readdir(directoryPath)
  await Promise.all(entries.map((entry) => removePath(path.join(directoryPath, entry))))
}

async function removePath(targetPath: string): Promise<void> {
  await rm(targetPath, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100
  })
}

async function replacePath(sourcePath: string, targetPath: string): Promise<void> {
  await removePath(targetPath)
  await retryFileSystemOperation(() => rename(sourcePath, targetPath))
}

async function retryFileSystemOperation(operation: () => Promise<void>): Promise<void> {
  const retryDelays = [50, 100, 250, 500, 1000]
  let lastError: unknown

  for (const delayMs of [0, ...retryDelays]) {
    if (delayMs > 0) {
      await delay(delayMs)
    }

    try {
      await operation()
      return
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function rewriteCopiedDistSourceMaps(
  sourceDistDir: string,
  targetDistDir: string
): Promise<void> {
  const entries = await readdir(targetDistDir, { withFileTypes: true })

  for (const entry of entries) {
    const targetPath = path.join(targetDistDir, entry.name)
    const sourcePath = path.join(sourceDistDir, entry.name)

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

function isIgnoredOutputWatchPath(
  project: ExtensionProject,
  outputRoot: string,
  filePath: string
): boolean {
  const absolutePath = path.resolve(filePath)

  if (
    isInsideOrEqualPath(project.distDir, absolutePath) ||
    isInsideOrEqualPath(outputRoot, absolutePath)
  ) {
    return true
  }

  const relativePath = path.relative(project.rootDir, absolutePath)
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return false
  }

  const segments = relativePath.split(path.sep)
  const basename = segments.at(-1) ?? ''

  return (
    basename.endsWith('.map') ||
    segments.some((segment) => segment === 'node_modules' || segment === '.git') ||
    segments.some((segment) => segment === 'artifacts' || segment.startsWith('.'))
  )
}

function isInsideOrEqualPath(parentPath: string, childPath: string): boolean {
  const relativePath = path.relative(path.resolve(parentPath), path.resolve(childPath))
  return !relativePath || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown output error.'
}
