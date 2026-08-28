import {
  isCancellationError,
  kisaki,
  type Disposable,
  type ExtensionLogger
} from '@kisaki3/extension-sdk'
import type { BangumiSettingsStore } from '../config/schema'
import type { BangumiMediaScope } from '../../shared/scopes'
import type { LocalMediaChangeEvent } from '../media/types'
import type { MediaRegistry } from '../media/registry'
import { BangumiExtensionError } from '../utils/errors'
import { m } from '../i18n'
import type { SyncEngine, SyncItemResult } from './engine'
import type { EpisodeSyncEngine, EpisodeSyncResult } from './episodes'
import type { SyncQueueStore } from './queue'

export interface SyncSubscriptionDependencies {
  settingsStore: BangumiSettingsStore
  engine: SyncEngine
  episodeEngine: EpisodeSyncEngine
  mediaRegistry: MediaRegistry
  queueStore: SyncQueueStore
  logger?: ExtensionLogger
}

interface PendingSync {
  timer: ReturnType<typeof setTimeout>
  controller: AbortController
}

export class SyncSubscription implements Disposable {
  private readonly pending = new Map<string, PendingSync>()
  private readonly registrations: Disposable[] = []
  private disposed = false

  constructor(private readonly deps: SyncSubscriptionDependencies) {}

  async start(): Promise<Disposable> {
    for (const adapter of this.deps.mediaRegistry.listLocalAdapters()) {
      if (!adapter.supportsAutoSync || !adapter.subscribeLocalChanges) {
        continue
      }

      this.registrations.push(
        await adapter.subscribeLocalChanges((event) =>
          this.handleLocalChange(event).catch((error) =>
            this.logError('Bangumi local media sync subscription failed.', error, {
              scope: event.scope,
              localId: event.localId
            })
          )
        )
      )
    }

    return this
  }

  dispose(): void {
    this.disposed = true

    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.controller.abort()
    }
    this.pending.clear()

    for (const registration of this.registrations.splice(0)) {
      registration.dispose()
    }
  }

  private async handleLocalChange(event: LocalMediaChangeEvent): Promise<void> {
    const settings = await this.deps.settingsStore.get()
    const autoSync = settings.autoSync

    if (!settings.media[event.scope].localSyncEnabled) {
      return
    }

    if (event.reason === 'created' && !autoSync.syncOnCreate) {
      return
    }

    await this.deps.queueStore.enqueue(event.scope, event.localId, event.reason)
    if (autoSync.enabled) {
      this.schedule(event, autoSync.debounceMs)
    }
  }

  private schedule(event: LocalMediaChangeEvent, debounceMs: number): void {
    if (this.disposed) {
      return
    }

    const key = createPendingKey(event.scope, event.localId)
    const existing = this.pending.get(key)
    if (existing) {
      clearTimeout(existing.timer)
      existing.controller.abort()
    }

    const controller = new AbortController()
    const timer = setTimeout(() => {
      this.pending.delete(key)
      this.processItem(event.scope, event.localId, controller.signal).catch((error) =>
        this.handleSyncError(event.scope, event.localId, error)
      )
    }, normalizeDebounceMs(debounceMs))

    this.pending.set(key, { timer, controller })
  }

  private async processItem(
    scope: BangumiMediaScope,
    localId: string,
    signal: AbortSignal
  ): Promise<void> {
    const result = await this.deps.engine.syncItem({
      scope,
      localId,
      signal
    })
    const episodeResult = await this.deps.episodeEngine.syncEpisodes({ scope, localId, signal })
    await this.deps.queueStore.remove([{ scope, localId }])
    this.logResult(result)
    this.logEpisodeResult(episodeResult)
  }

  private async handleSyncError(
    scope: BangumiMediaScope,
    localId: string,
    error: unknown
  ): Promise<void> {
    if (isCancellationError(error)) {
      return
    }

    const settings = await this.deps.settingsStore.get()
    this.logError('Bangumi automatic sync failed.', error, { scope, localId })

    if (!settings.autoSync.notifyErrors) {
      return
    }

    try {
      await kisaki.notify.error(m().notifications.autoSyncFailedTitle, {
        message: toUserErrorMessage(error),
        id: `bangumi-auto-sync:${scope}:${localId}`
      })
    } catch (notifyError) {
      this.logError('Bangumi automatic sync notification failed.', notifyError, {
        scope,
        localId
      })
    }
  }

  private logResult(result: SyncItemResult): void {
    if (result.status === 'synced') {
      this.deps.logger?.info('Bangumi automatic sync completed.', {
        scope: result.scope,
        localId: result.localId,
        subjectId: result.subjectId
      })
      return
    }

    this.deps.logger?.debug('Bangumi automatic sync skipped.', {
      status: result.status,
      scope: result.scope,
      localId: result.localId,
      subjectId: result.subjectId,
      suppressReason: result.suppressReason
    })
  }

  private logEpisodeResult(result: EpisodeSyncResult): void {
    if (result.status !== 'synced') {
      return
    }

    this.deps.logger?.info('Bangumi episode sync completed.', {
      scope: result.scope,
      localId: result.localId,
      subjectId: result.subjectId,
      markedCount: result.markedCount,
      unmarkedCount: result.unmarkedCount
    })
  }

  private logError(message: string, error: unknown, context: Record<string, unknown> = {}): void {
    this.deps.logger?.warn(message, {
      ...context,
      ...toSafeErrorLog(error)
    })
  }
}

function createPendingKey(scope: BangumiMediaScope, localId: string): string {
  return `${scope}:${localId}`
}

function normalizeDebounceMs(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 3000
}

function toUserErrorMessage(error: unknown): string {
  if (error instanceof BangumiExtensionError) {
    return error.message
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return m().notifications.autoSyncFailedFallback
}

function toSafeErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof BangumiExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}
