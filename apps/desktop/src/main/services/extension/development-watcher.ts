import path from 'node:path'
import { watch, type FSWatcher } from 'chokidar'
import { createLogger } from '@main/log'
import { isInsideOrEqualPath } from './shared/path-confinement'

const log = createLogger('Extension')

export interface ExtensionDevelopmentWatchTarget {
  extensionId: string
  watchPaths: readonly string[]
  ignoredPaths: readonly string[]
}

export type ExtensionDevelopmentChangeCallback = (extensionId: string) => Promise<void> | void

interface MatchedDevelopmentWatchTarget {
  target: ExtensionDevelopmentWatchTarget
  watchPath: string
}

/**
 * Watches the built output directory of each development extension and reports
 * when its code changes on disk. It only signals that newer code exists; applying
 * it is an explicit user action, mirroring the VS Code
 * model of "compile on save, reload on demand".
 */
export class ExtensionDevelopmentWatcher {
  private readonly changeDebounceTimers = new Map<string, NodeJS.Timeout>()
  private watcher: FSWatcher | null = null
  private targets: readonly ExtensionDevelopmentWatchTarget[] = []
  private targetSignature = ''

  constructor(private readonly onChange: ExtensionDevelopmentChangeCallback) {}

  async updateTargets(targets: readonly ExtensionDevelopmentWatchTarget[]): Promise<void> {
    const normalizedTargets = normalizeTargets(targets)
    const nextSignature = normalizedTargets
      .map(
        (target) =>
          `${target.extensionId}\0${target.watchPaths.join('\0')}\0${target.ignoredPaths.join('\0')}`
      )
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

    this.watcher = watch([...new Set(this.targets.flatMap((target) => target.watchPaths))], {
      ignored: (filePath) => this.shouldIgnorePath(filePath),
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

    for (const timer of this.changeDebounceTimers.values()) {
      clearTimeout(timer)
    }

    this.changeDebounceTimers.clear()
  }

  /**
   * Ignore rules are scoped to the owning target (deepest watch path wins) so
   * overlapping development extensions never mask each other's changes.
   */
  private shouldIgnorePath(filePath: string): boolean {
    if (isIgnoredExtensionWatchPath(filePath)) {
      return true
    }

    const absolutePath = path.resolve(filePath)
    const match = findTargetForPath(this.targets, absolutePath)
    if (!match) {
      return false
    }

    return match.target.ignoredPaths.some((ignoredPath) =>
      isInsideOrEqualPath(ignoredPath, absolutePath)
    )
  }

  private handleFileEvent(filePath: string): void {
    const absolutePath = path.resolve(filePath)
    const match = findTargetForPath(this.targets, absolutePath)
    if (!match) {
      return
    }

    this.scheduleChange(match.target, describeChangedPath(match.watchPath, absolutePath))
  }

  private scheduleChange(target: ExtensionDevelopmentWatchTarget, relativePath: string): void {
    const existingTimer = this.changeDebounceTimers.get(target.extensionId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const timer = setTimeout(() => {
      this.changeDebounceTimers.delete(target.extensionId)

      log.info('Development extension changed on disk.', {
        targetExtensionId: target.extensionId,
        changedRelativePath: relativePath
      })

      void Promise.resolve(this.onChange(target.extensionId)).catch((error) => {
        log.error('Failed to flag development extension change.', error, {
          targetExtensionId: target.extensionId
        })
      })
    }, 300)

    this.changeDebounceTimers.set(target.extensionId, timer)
  }
}

function normalizeTargets(
  targets: readonly ExtensionDevelopmentWatchTarget[]
): readonly ExtensionDevelopmentWatchTarget[] {
  const byId = new Map<string, ExtensionDevelopmentWatchTarget>()

  for (const target of targets) {
    const watchPaths = [
      ...new Set(target.watchPaths.map((watchPath) => path.resolve(watchPath)))
    ].sort((left, right) => left.localeCompare(right))
    const ignoredPaths = [
      ...new Set(target.ignoredPaths.map((ignoredPath) => path.resolve(ignoredPath)))
    ].sort((left, right) => left.localeCompare(right))

    if (watchPaths.length === 0) {
      continue
    }

    byId.set(target.extensionId, {
      extensionId: target.extensionId,
      watchPaths,
      ignoredPaths
    })
  }

  return [...byId.values()].sort((left, right) => left.extensionId.localeCompare(right.extensionId))
}

function findTargetForPath(
  targets: readonly ExtensionDevelopmentWatchTarget[],
  filePath: string
): MatchedDevelopmentWatchTarget | null {
  const absolutePath = path.resolve(filePath)
  let bestMatch: MatchedDevelopmentWatchTarget | null = null

  for (const target of targets) {
    for (const watchPath of target.watchPaths) {
      if (!isInsideOrEqualPath(watchPath, absolutePath)) {
        continue
      }

      if (!bestMatch || watchPath.length > bestMatch.watchPath.length) {
        bestMatch = { target, watchPath }
      }
    }
  }

  return bestMatch
}

function describeChangedPath(watchPath: string, filePath: string): string {
  const relativePath = path.relative(watchPath, filePath)
  return relativePath.length > 0 ? relativePath : path.basename(filePath)
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
