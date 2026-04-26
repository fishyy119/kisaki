import path from 'node:path'
import { watch, type FSWatcher } from 'chokidar'
import log from 'electron-log/main'
import { isInsideOrEqualPath } from './shared/path-confinement'

export interface ExtensionReloadWatchTarget {
  extensionId: string
  extensionPath: string
}

export type ExtensionReloadCallback = (extensionId: string) => Promise<void> | void

/**
 * Watches active extension package roots and requests a native runtime reload when
 * their files change. This is extension-system behavior, not a dev-only flow.
 */
export class ExtensionReloadWatcher {
  private readonly reloadDebounceTimers = new Map<string, NodeJS.Timeout>()
  private watcher: FSWatcher | null = null
  private targets: readonly ExtensionReloadWatchTarget[] = []
  private targetSignature = ''

  constructor(private readonly onReload: ExtensionReloadCallback) {}

  async updateTargets(targets: readonly ExtensionReloadWatchTarget[]): Promise<void> {
    const normalizedTargets = normalizeTargets(targets)
    const nextSignature = normalizedTargets
      .map((target) => `${target.extensionId}\0${target.extensionPath}`)
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

    this.watcher = watch(
      this.targets.map((target) => target.extensionPath),
      {
        ignored: [/(^|[/\\])\./, '**/node_modules/**', '**/.git/**', '**/*.map'],
        ignoreInitial: true,
        persistent: true,
        depth: 8,
        awaitWriteFinish: {
          stabilityThreshold: 250,
          pollInterval: 50
        }
      }
    )

    this.watcher.on('add', (filePath) => this.scheduleReload(filePath))
    this.watcher.on('change', (filePath) => this.scheduleReload(filePath))
    this.watcher.on('unlink', (filePath) => this.scheduleReload(filePath))

    log.info(`[ExtensionReloadWatcher] Watching ${this.targets.length} active extension(s)`)
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

  private scheduleReload(filePath: string): void {
    const target = findTargetForPath(this.targets, filePath)
    if (!target) {
      return
    }

    const existingTimer = this.reloadDebounceTimers.get(target.extensionId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const timer = setTimeout(() => {
      this.reloadDebounceTimers.delete(target.extensionId)

      log.info(
        `[ExtensionReloadWatcher] Reloading extension "${target.extensionId}" after file change`
      )

      void Promise.resolve(this.onReload(target.extensionId)).catch((error) => {
        log.error(
          `[ExtensionReloadWatcher] Failed to reload extension "${target.extensionId}":`,
          error
        )
      })
    }, 300)

    this.reloadDebounceTimers.set(target.extensionId, timer)
  }
}

function normalizeTargets(
  targets: readonly ExtensionReloadWatchTarget[]
): readonly ExtensionReloadWatchTarget[] {
  const byId = new Map<string, ExtensionReloadWatchTarget>()

  for (const target of targets) {
    byId.set(target.extensionId, {
      extensionId: target.extensionId,
      extensionPath: path.resolve(target.extensionPath)
    })
  }

  return [...byId.values()].sort((left, right) => left.extensionId.localeCompare(right.extensionId))
}

function findTargetForPath(
  targets: readonly ExtensionReloadWatchTarget[],
  filePath: string
): ExtensionReloadWatchTarget | null {
  const absolutePath = path.resolve(filePath)
  let bestTarget: ExtensionReloadWatchTarget | null = null

  for (const target of targets) {
    if (!isInsidePath(target.extensionPath, absolutePath)) {
      continue
    }

    if (!bestTarget || target.extensionPath.length > bestTarget.extensionPath.length) {
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
