import path from 'node:path'
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { watch, type FSWatcher } from 'chokidar'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import { CliError, logger } from '../logger'
import { readValidManifest } from '../manifest'
import { type ExtensionProject, pathExists, resolveEntryFile, resolveProject } from '../project'
import { copyExtensionPackageFiles } from '../package-layout'
import { runTsdown, spawnTsdown } from './tsdown'

export interface OutputCommandOptions {
  outDir: string
  project?: string
  watch?: boolean
  debugSources?: boolean
}

export interface ExtensionOutputOptions {
  outDir: string
  preservePackageRoot?: boolean
  debugSources?: boolean
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

    const session = await watchExtensionOutput(project, {
      outDir: options.outDir,
      ...(options.debugSources === undefined ? {} : { debugSources: options.debugSources })
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
 * Starts tsdown in watch mode and keeps outDir/id synchronized with the package layout.
 */
export async function watchExtensionOutput(
  project: ExtensionProject,
  options: ExtensionOutputOptions
): Promise<ExtensionOutputWatchSession> {
  const manifest = await readValidManifest(project, { checkEntry: false, checkProjectFiles: true })
  const outputRoot = path.resolve(project.rootDir, options.outDir)
  const packagePath = path.join(outputRoot, manifest.id)
  const tsdown = await spawnTsdown(project.rootDir, ['--watch'])

  let watcher: FSWatcher | null = null
  let debounceTimer: NodeJS.Timeout | null = null
  let retryTimer: NodeJS.Timeout | null = null
  let closed = false
  let readySettled = false
  let lastSyncError: string | null = null
  let syncQueue = Promise.resolve()

  let resolveReady!: (result: ExtensionOutputResult) => void
  let rejectReady!: (error: unknown) => void
  const ready = new Promise<ExtensionOutputResult>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })

  const syncNow = async (): Promise<void> => {
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

      const currentPackagePath = await writeExtensionPackageOutput(project, currentManifest, {
        ...options,
        preservePackageRoot: true
      })

      lastSyncError = null
      if (retryTimer) {
        clearInterval(retryTimer)
        retryTimer = null
      }
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

  const scheduleSync = (): void => {
    if (closed) {
      return
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = null
      syncQueue = syncQueue.then(syncNow, syncNow)
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

    if (retryTimer) {
      clearInterval(retryTimer)
      retryTimer = null
    }

    if (watcher) {
      await watcher.close()
      watcher = null
    }

    if (!tsdown.killed) {
      tsdown.kill()
    }
  }

  tsdown.on('error', (error) => {
    if (!readySettled) {
      readySettled = true
      rejectReady(error)
    }
  })

  tsdown.on('close', (code) => {
    if (closed) {
      return
    }

    const error = new CliError(`tsdown watch exited with code ${code ?? 'unknown'}.`)
    if (!readySettled) {
      readySettled = true
      rejectReady(error)
    } else {
      logger.warn(error.message)
    }
  })

  watcher = watch(createOutputWatchTargets(project), {
    ignored: [/(^|[/\\])\./, '**/node_modules/**', '**/.git/**', '**/*.map'],
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 250,
      pollInterval: 50
    }
  })

  watcher.on('add', scheduleSync)
  watcher.on('change', scheduleSync)
  watcher.on('unlink', scheduleSync)
  watcher.on('addDir', scheduleSync)
  watcher.on('unlinkDir', scheduleSync)
  watcher.on('error', (error) => {
    logger.warn(`Output watcher error: ${toErrorMessage(error)}`)
  })

  retryTimer = setInterval(scheduleSync, 500)
  scheduleSync()

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

function createOutputWatchTargets(project: ExtensionProject): string[] {
  return [
    project.manifestPath,
    project.packageJsonPath,
    project.readmePath,
    project.assetsDir,
    project.distDir
  ]
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown output error.'
}
