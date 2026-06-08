import path from 'node:path'
import { watch, type FSWatcher } from 'chokidar'
import { createLogger } from '@main/log'
import { EXTENSION_PACKAGE_CURRENT_FILE } from './packages'
import { isInsideOrEqualPath } from './shared/path-confinement'

const log = createLogger('Extension')

export interface ExtensionDevelopmentReloadWatchTarget {
  extensionId: string
  extensionPath: string
  watchPath: string
}

export type ExtensionDevelopmentReloadCallback = (extensionId: string) => Promise<void> | void

/**
 * Watches development extension outputs and requests runtime reloads after a
 * complete dev package publication or direct dev package file change.
 */
export class ExtensionDevelopmentReloadWatcher {
  private readonly reloadDebounceTimers = new Map<string, NodeJS.Timeout>()
  private watcher: FSWatcher | null = null
  private targets: readonly ExtensionDevelopmentReloadWatchTarget[] = []
  private targetSignature = ''

  constructor(private readonly onReload: ExtensionDevelopmentReloadCallback) {}

  async updateTargets(targets: readonly ExtensionDevelopmentReloadWatchTarget[]): Promise<void> {
    const normalizedTargets = normalizeTargets(targets)
    const nextSignature = normalizedTargets
      .map((target) => `${target.extensionId}\0${target.extensionPath}\0${target.watchPath}`)
      .join('\n')

    if (nextSignature === this.targetSignature) {
      return
    }

    await this.stop()
    this.targets = normalizedTargets
    this.targetSignature = nextSignature

    if (this.targets.length === 0) {
      return
    }

    this.watcher = watch([...new Set(this.targets.map((target) => target.watchPath))], {
      ignored: isIgnoredExtensionWatchPath,
      ignoreInitial: true,
      persistent: true,
      depth: 8,
      awaitWriteFinish: {
        stabilityThreshold: 250,
        pollInterval: 50
      }
    })

    this.watcher.on('add', (filePath) => this.handleFileEvent(filePath))
    this.watcher.on('change', (filePath) => this.handleFileEvent(filePath))
    this.watcher.on('unlink', (filePath) => this.handleFileEvent(filePath))

    log.info('Watching development extension(s).', { targetsLength: this.targets.length })
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }

    for (const timer of this.reloadDebounceTimers.values()) {
      clearTimeout(timer)
    }

    this.reloadDebounceTimers.clear()
  }

  private handleFileEvent(filePath: string): void {
    const absolutePath = path.resolve(filePath)
    const target = findTargetForPath(this.targets, absolutePath)
    if (!target) {
      return
    }

    if (!shouldReloadForPath(target, absolutePath)) {
      return
    }

    this.scheduleReload(target, path.relative(target.watchPath, absolutePath))
  }

  private scheduleReload(
    target: ExtensionDevelopmentReloadWatchTarget,
    relativePath: string
  ): void {
    const existingTimer = this.reloadDebounceTimers.get(target.extensionId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const timer = setTimeout(() => {
      this.reloadDebounceTimers.delete(target.extensionId)

      log.info('Reloading development extension after file change.', {
        targetExtensionId: target.extensionId,
        changedRelativePath: relativePath
      })

      void Promise.resolve(this.onReload(target.extensionId)).catch((error) => {
        log.error('Failed to reload extension.', error, { targetExtensionId: target.extensionId })
      })
    }, 300)

    this.reloadDebounceTimers.set(target.extensionId, timer)
  }
}

function normalizeTargets(
  targets: readonly ExtensionDevelopmentReloadWatchTarget[]
): readonly ExtensionDevelopmentReloadWatchTarget[] {
  const byId = new Map<string, ExtensionDevelopmentReloadWatchTarget>()

  for (const target of targets) {
    byId.set(target.extensionId, {
      extensionId: target.extensionId,
      extensionPath: path.resolve(target.extensionPath),
      watchPath: path.resolve(target.watchPath)
    })
  }

  return [...byId.values()].sort((left, right) => left.extensionId.localeCompare(right.extensionId))
}

function findTargetForPath(
  targets: readonly ExtensionDevelopmentReloadWatchTarget[],
  filePath: string
): ExtensionDevelopmentReloadWatchTarget | null {
  const absolutePath = path.resolve(filePath)
  let bestTarget: ExtensionDevelopmentReloadWatchTarget | null = null

  for (const target of targets) {
    if (!isInsidePath(target.watchPath, absolutePath)) {
      continue
    }

    if (!bestTarget || target.watchPath.length > bestTarget.watchPath.length) {
      bestTarget = target
    }
  }

  return bestTarget
}

function isInsidePath(parentPath: string, childPath: string): boolean {
  return (
    path.relative(path.resolve(parentPath), path.resolve(childPath)) !== '' &&
    isInsideOrEqualPath(parentPath, childPath)
  )
}

function shouldReloadForPath(
  target: ExtensionDevelopmentReloadWatchTarget,
  filePath: string
): boolean {
  if (path.resolve(target.watchPath) === path.resolve(target.extensionPath)) {
    return true
  }

  return filePath === path.resolve(target.watchPath, EXTENSION_PACKAGE_CURRENT_FILE)
}

function isIgnoredExtensionWatchPath(filePath: string): boolean {
  const normalizedPath = path.normalize(filePath)
  const segments = normalizedPath.split(/[/\\]+/).filter(Boolean)
  const basename = segments.at(-1) ?? ''

  return (
    basename.endsWith('.map') ||
    segments.some((segment) => segment === 'node_modules' || segment === '.git') ||
    segments.some((segment) => segment.startsWith('.') && !isDriveSegment(segment))
  )
}

function isDriveSegment(segment: string): boolean {
  return /^[A-Za-z]:$/.test(segment)
}
