import path from 'node:path'
import { watch as watchFiles, type FSWatcher } from 'chokidar'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import { loadKisxConfig, watchExtensionBundles, type ExtensionBundleWatchSession } from '../build'
import { CliError, logger } from '../logger'
import { pathExists, readValidManifest, resolveEntryFile, type ExtensionProject } from '../project'
import {
  readCurrentPackageOutputPath,
  writeExtensionPackageOutput,
  type ExtensionOutputOptions,
  type ExtensionOutputResult
} from './write'

const PUBLISH_DEBOUNCE_MS = 100

export interface ExtensionOutputWatchSession {
  project: ExtensionProject
  publicationPath: string
  ready: Promise<ExtensionOutputResult>
  close(): Promise<void>
}

/**
 * Watch-builds the extension with Vite and publishes each ready version.
 * Manifest and asset files outside the module graph are watched separately so
 * their changes republish too.
 */
export async function watchExtensionOutput(
  project: ExtensionProject,
  options: ExtensionOutputOptions
): Promise<ExtensionOutputWatchSession> {
  const manifest = await readValidManifest(project, { checkEntry: false, checkProjectFiles: true })
  const config = await loadKisxConfig(project)
  const outputRoot = path.resolve(project.rootDir, options.outDir)
  const publicationPath = path.join(outputRoot, manifest.id)

  let fileWatcher: FSWatcher | null = null
  let debounceTimer: NodeJS.Timeout | null = null
  let closed = false
  let readySettled = false
  let publishRunning = false
  let publishQueued = false
  let suppressNextPublish = options.skipInitialBuild ?? false
  let lastSyncError: string | null = null

  let resolveReady!: (result: ExtensionOutputResult) => void
  const ready = new Promise<ExtensionOutputResult>((resolve) => {
    resolveReady = resolve
  })

  const bundles: ExtensionBundleWatchSession = await watchExtensionBundles(
    project,
    manifest,
    config,
    { includeUi: options.ui?.mode !== 'dev-server' }
  )

  const settleReady = (result: ExtensionOutputResult): void => {
    if (!readySettled) {
      readySettled = true
      resolveReady(result)
    }
  }

  const settleReadyFromExistingOutput = async (): Promise<void> => {
    try {
      const currentManifest = await readValidManifest(project, {
        checkEntry: true,
        checkProjectFiles: true
      })
      const packagePath = await readCurrentPackageOutputPath(publicationPath, currentManifest.id)
      settleReady({ manifest: currentManifest, packagePath, publicationPath })
    } catch {
      suppressNextPublish = false
    }
  }

  const publishOutput = async (): Promise<void> => {
    if (closed || !bundles.isBuilt()) {
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

      const currentOutput = await writeExtensionPackageOutput(project, currentManifest, options)

      lastSyncError = null
      logger.detail(`Synced ${path.relative(project.rootDir, currentOutput.packagePath)}`)
      settleReady({
        manifest: currentManifest,
        packagePath: currentOutput.packagePath,
        publicationPath: currentOutput.publicationPath
      })
    } catch (error) {
      const message = toErrorMessage(error)
      if (message !== lastSyncError) {
        logger.warn(`Output sync waiting: ${message}`)
        lastSyncError = message
      }
    }
  }

  const runPublishQueue = async (): Promise<void> => {
    if (closed) {
      return
    }

    if (publishRunning) {
      publishQueued = true
      return
    }

    if (suppressNextPublish) {
      suppressNextPublish = false
      await settleReadyFromExistingOutput()
      if (readySettled) {
        return
      }
    }

    publishRunning = true
    try {
      do {
        publishQueued = false
        await publishOutput()
      } while (publishQueued && !closed)
    } finally {
      publishRunning = false
    }
  }

  const schedulePublish = (): void => {
    if (closed) {
      return
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void runPublishQueue()
    }, PUBLISH_DEBOUNCE_MS)
  }

  bundles.onRebuilt(schedulePublish)

  fileWatcher = watchFiles(collectPackageFileWatchTargets(project, manifest), {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 250,
      pollInterval: 50
    }
  })
  fileWatcher.on('add', schedulePublish)
  fileWatcher.on('change', schedulePublish)
  fileWatcher.on('unlink', schedulePublish)
  fileWatcher.on('error', (error) => {
    logger.warn(`Output watcher error: ${toErrorMessage(error)}`)
  })

  const close = async (): Promise<void> => {
    if (closed) {
      return
    }

    closed = true

    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }

    await bundles.close()
    if (fileWatcher) {
      await fileWatcher.close()
      fileWatcher = null
    }
  }

  return {
    project,
    publicationPath,
    ready,
    close
  }
}

function collectPackageFileWatchTargets(
  project: ExtensionProject,
  manifest: ExtensionManifest
): string[] {
  const targets = [project.manifestPath, project.readmePath, project.assetsDir]

  if (manifest.icon) {
    targets.push(path.resolve(project.rootDir, manifest.icon))
  }

  return targets
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown output error.'
}
