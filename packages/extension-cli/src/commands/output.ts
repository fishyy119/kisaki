import path from 'node:path'
import { mkdir, readdir, readFile, rename, rm, rmdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { watch, type FSWatcher } from 'chokidar'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import { CliError, logger } from '../logger'
import { readValidManifest } from '../manifest'
import { type ExtensionProject, pathExists, resolveEntryFile, resolveProject } from '../project'
import { copyExtensionPackageFiles } from '../package-layout'
import { runTsdown } from './tsdown'

const CURRENT_OUTPUT_FILE = 'current.json'
const OUTPUT_VERSIONS_DIR = 'versions'
const OUTPUT_STAGING_DIR = '.staging'
const OUTPUT_VERSION_RETAIN_COUNT = 20

let outputBuildSequence = 0

export interface OutputCommandOptions {
  outDir: string
  project?: string
  watch?: boolean
  debugSources?: boolean
  skipInitialBuild?: boolean
}

export interface ExtensionOutputOptions {
  outDir: string
  debugSources?: boolean
  initialBuild?: boolean
}

export interface ExtensionOutputResult {
  manifest: ExtensionManifest
  packagePath: string
  publicationPath: string
}

export interface ExtensionOutputWatchSession {
  project: ExtensionProject
  publicationPath: string
  ready: Promise<ExtensionOutputResult>
  close(): Promise<void>
}

interface PublishedPackageOutput {
  packagePath: string
  publicationPath: string
}

interface CurrentOutputDocument {
  schemaVersion: 1
  extensionId: string
  version: string
  buildId: string
  packagePath: string
  publishedAt: string
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
    logger.detail(`Publication: ${path.relative(project.rootDir, result.publicationPath)}`)

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
  logger.detail(`Publication: ${path.relative(project.rootDir, result.publicationPath)}`)
}

/**
 * Builds the extension and publishes an immutable unpacked package version.
 */
export async function buildExtensionOutput(
  project: ExtensionProject,
  options: ExtensionOutputOptions
): Promise<ExtensionOutputResult> {
  await readValidManifest(project, { checkEntry: false, checkProjectFiles: true })
  await runTsdown(project.rootDir, [])

  const manifest = await readValidManifest(project, { checkEntry: true, checkProjectFiles: true })
  const output = await writeExtensionPackageOutput(project, manifest, options)

  return { manifest, packagePath: output.packagePath, publicationPath: output.publicationPath }
}

/**
 * Watches extension project inputs, rebuilds with tsdown, and publishes each ready version.
 */
export async function watchExtensionOutput(
  project: ExtensionProject,
  options: ExtensionOutputOptions
): Promise<ExtensionOutputWatchSession> {
  const manifest = await readValidManifest(project, { checkEntry: false, checkProjectFiles: true })
  const outputRoot = path.resolve(project.rootDir, options.outDir)
  const publicationPath = path.join(outputRoot, manifest.id)
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

      const packagePath = await readCurrentPackageOutputPath(publicationPath, currentManifest.id)

      lastSyncError = null
      if (!readySettled) {
        readySettled = true
        resolveReady({ manifest: currentManifest, packagePath, publicationPath })
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

      const currentOutput = await writeExtensionPackageOutput(project, currentManifest, options)

      lastSyncError = null
      logger.detail(`Synced ${path.relative(project.rootDir, currentOutput.packagePath)}`)

      if (!readySettled) {
        readySettled = true
        resolveReady({
          manifest: currentManifest,
          packagePath: currentOutput.packagePath,
          publicationPath: currentOutput.publicationPath
        })
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
    publicationPath,
    ready,
    close
  }
}

async function writeExtensionPackageOutput(
  project: ExtensionProject,
  manifest: ExtensionManifest,
  options: ExtensionOutputOptions
): Promise<PublishedPackageOutput> {
  const outputRoot = path.resolve(project.rootDir, options.outDir)
  const publicationPath = path.join(outputRoot, manifest.id)
  const buildId = createOutputBuildId()
  const stagingPath = path.join(publicationPath, OUTPUT_STAGING_DIR, buildId)
  const packagePath = path.join(publicationPath, OUTPUT_VERSIONS_DIR, buildId)

  await removePath(stagingPath)
  await mkdir(stagingPath, { recursive: true })

  try {
    await copyPackageFiles(project, manifest, stagingPath)
    if (options.debugSources) {
      await rewriteCopiedDistSourceMaps(project.distDir, path.join(stagingPath, 'dist'))
    }

    await mkdir(path.dirname(packagePath), { recursive: true })
    await retryFileSystemOperation(() => rename(stagingPath, packagePath))
    await writeCurrentOutputDocument(publicationPath, manifest, {
      buildId,
      packagePath
    })
    await removeEmptyDirectory(path.dirname(stagingPath)).catch(() => undefined)
    await cleanupPublishedVersions(publicationPath, buildId).catch(() => undefined)
    return { packagePath, publicationPath }
  } catch (error) {
    await removePath(stagingPath).catch(() => undefined)
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

async function readCurrentPackageOutputPath(
  publicationPath: string,
  extensionId: string
): Promise<string> {
  const documentPath = path.join(publicationPath, CURRENT_OUTPUT_FILE)

  if (!(await pathExists(documentPath))) {
    throw new CliError('Existing package output is not ready yet.')
  }

  const document = JSON.parse(await readFile(documentPath, 'utf8')) as Record<string, unknown>
  if (document.schemaVersion !== 1) {
    throw new CliError('Existing package output uses an unknown current.json schema.')
  }

  if (document.extensionId !== extensionId) {
    throw new CliError('Existing package output belongs to another extension.')
  }

  if (typeof document.packagePath !== 'string' || document.packagePath.trim().length === 0) {
    throw new CliError('Existing package output is missing a package path.')
  }

  const packagePath = resolveOutputRelativePath(publicationPath, document.packagePath)
  if (!(await pathExists(path.join(packagePath, 'manifest.json')))) {
    throw new CliError('Existing package output is not ready yet.')
  }

  return packagePath
}

async function writeCurrentOutputDocument(
  publicationPath: string,
  manifest: ExtensionManifest,
  current: Pick<CurrentOutputDocument, 'buildId' | 'packagePath'>
): Promise<void> {
  const documentPath = path.join(publicationPath, CURRENT_OUTPUT_FILE)
  const tempDocumentPath = path.join(
    publicationPath,
    `.${CURRENT_OUTPUT_FILE}.${process.pid}-${Date.now()}.tmp`
  )
  const document: CurrentOutputDocument = {
    schemaVersion: 1,
    extensionId: manifest.id,
    version: manifest.version,
    buildId: current.buildId,
    packagePath: toOutputRelativePath(publicationPath, current.packagePath),
    publishedAt: new Date().toISOString()
  }

  await writeFile(tempDocumentPath, `${JSON.stringify(document, null, 2)}\n`)
  try {
    await retryFileSystemOperation(() => rename(tempDocumentPath, documentPath))
  } catch (error) {
    await removePath(tempDocumentPath).catch(() => undefined)
    throw error
  }
}

async function cleanupPublishedVersions(
  publicationPath: string,
  currentBuildId: string
): Promise<void> {
  const versionsPath = path.join(publicationPath, OUTPUT_VERSIONS_DIR)
  if (!(await pathExists(versionsPath))) {
    return
  }

  const entries = await readdir(versionsPath, { withFileTypes: true })
  const staleBuildIds = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((buildId) => buildId !== currentBuildId)
    .sort()
    .reverse()
    .slice(Math.max(OUTPUT_VERSION_RETAIN_COUNT - 1, 0))

  await Promise.all(
    staleBuildIds.map((buildId) =>
      removePath(path.join(versionsPath, buildId)).catch(() => undefined)
    )
  )
}

function createOutputBuildId(): string {
  outputBuildSequence += 1
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '').replace('T', 't')
  return `${timestamp}-${process.pid}-${outputBuildSequence}`
}

function toOutputRelativePath(rootPath: string, targetPath: string): string {
  return path.relative(rootPath, targetPath).split(path.sep).join('/')
}

function resolveOutputRelativePath(rootPath: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    throw new CliError('Package output path must be relative.')
  }

  const segments = relativePath.split(/[\\/]+/).filter(Boolean)
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === '.' || segment === '..') ||
    segments[0] !== OUTPUT_VERSIONS_DIR
  ) {
    throw new CliError('Package output path must point inside versions/.')
  }

  return path.resolve(rootPath, ...segments)
}

async function removePath(targetPath: string): Promise<void> {
  await rm(targetPath, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100
  })
}

async function removeEmptyDirectory(targetPath: string): Promise<void> {
  await rmdir(targetPath)
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
