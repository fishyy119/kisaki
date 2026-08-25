import path from 'node:path'
import { createLogger } from '@main/log'
import type { FileWatchScope, FileWatchService } from '@main/services/file-watch'
import { isInsideOrEqualPath } from '@shared/utils/path'

const log = createLogger('Extension')

/** Built output settles quickly, so a short batch window keeps reload prompt. */
const CHANGE_DEBOUNCE_MS = 300

/** Bundlers rewrite files in place; wait for the write to finish. */
const WRITE_FINISH_MS = 250

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
  private scope: FileWatchScope | null = null
  private targets: readonly ExtensionDevelopmentWatchTarget[] = []
  private targetSignature = ''

  constructor(
    private readonly fileWatch: FileWatchService,
    private readonly onChange: ExtensionDevelopmentChangeCallback
  ) {}

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

    this.scope = this.fileWatch.watch({
      id: 'extension-development',
      paths: [...new Set(this.targets.flatMap((target) => target.watchPaths))],
      depth: 8,
      ignored: (filePath) => this.shouldIgnorePath(filePath),
      debounceMs: CHANGE_DEBOUNCE_MS,
      awaitWriteFinishMs: WRITE_FINISH_MS,
      onEvents: (events) => {
        // One reload flag per extension, whichever of its files changed.
        const changedByExtension = new Map<string, string>()
        for (const event of events) {
          const match = findTargetForPath(this.targets, event.path)
          if (!match) continue
          changedByExtension.set(
            match.target.extensionId,
            describeChangedPath(match.watchPath, event.path)
          )
        }

        for (const [extensionId, relativePath] of changedByExtension) {
          this.reportChange(extensionId, relativePath)
        }
      }
    })

    log.info('Watching development extension(s).', { targetsLength: this.targets.length })
  }

  async stop(): Promise<void> {
    await this.scope?.close()
    this.scope = null
  }

  /**
   * Ignore rules are scoped to the owning target (deepest watch path wins) so
   * overlapping development extensions never mask each other's changes.
   */
  private shouldIgnorePath(filePath: string): boolean {
    if (isIgnoredExtensionWatchPath(filePath)) {
      return true
    }

    const match = findTargetForPath(this.targets, filePath)
    if (!match) {
      return false
    }

    return match.target.ignoredPaths.some((ignoredPath) =>
      isInsideOrEqualPath(ignoredPath, filePath)
    )
  }

  private reportChange(extensionId: string, relativePath: string): void {
    log.info('Development extension changed on disk.', {
      targetExtensionId: extensionId,
      changedRelativePath: relativePath
    })

    void Promise.resolve(this.onChange(extensionId)).catch((error) => {
      log.error('Failed to flag development extension change.', error, {
        targetExtensionId: extensionId
      })
    })
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
