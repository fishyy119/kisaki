import {
  kisaki,
  type Disposable,
  type ExtensionLogger,
  type LibraryGameUpdatedEvent
} from '@kisaki/extension-sdk'
import type { SettingsStore } from '../config/store'
import { BangumiExtensionError } from '../shared/errors'
import type { SyncEngine, SyncGameResult } from './engine'
import type { SyncQueueStore } from './queue'

export interface SyncSubscriptionDependencies {
  settingsStore: SettingsStore
  engine: SyncEngine
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
    this.registrations.push(
      await kisaki.events.on('library.game.created', (event) =>
        this.handleCreated(event.gameId).catch((error) =>
          this.logError('Bangumi created-game sync subscription failed.', error)
        )
      )
    )
    this.registrations.push(
      await kisaki.events.on('library.game.updated', (event) =>
        this.handleUpdated(event).catch((error) =>
          this.logError('Bangumi updated-game sync subscription failed.', error)
        )
      )
    )

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

  private async handleCreated(gameId: string): Promise<void> {
    const settings = await this.deps.settingsStore.get()
    if (!settings.autoSync.syncOnCreate) {
      return
    }

    await this.deps.queueStore.enqueue(gameId, 'created')
    if (settings.autoSync.enabled) {
      this.schedule(gameId, settings.autoSync.debounceMs)
    }
  }

  private async handleUpdated(event: LibraryGameUpdatedEvent): Promise<void> {
    if (!hasSyncRelevantGameChange(event)) {
      return
    }

    const settings = await this.deps.settingsStore.get()
    await this.deps.queueStore.enqueue(event.gameId, 'updated')

    if (settings.autoSync.enabled) {
      this.schedule(event.gameId, settings.autoSync.debounceMs)
    }
  }

  private schedule(gameId: string, debounceMs: number): void {
    if (this.disposed) {
      return
    }

    const existing = this.pending.get(gameId)
    if (existing) {
      clearTimeout(existing.timer)
      existing.controller.abort()
    }

    const controller = new AbortController()
    const timer = setTimeout(() => {
      this.pending.delete(gameId)
      this.processGame(gameId, controller.signal).catch((error) =>
        this.handleSyncError(gameId, error)
      )
    }, normalizeDebounceMs(debounceMs))

    this.pending.set(gameId, { timer, controller })
  }

  private async processGame(gameId: string, signal: AbortSignal): Promise<void> {
    const result = await this.deps.engine.syncGame({
      gameId,
      signal
    })
    await this.deps.queueStore.remove([gameId])
    this.logResult(result)
  }

  private async handleSyncError(gameId: string, error: unknown): Promise<void> {
    if (isCancellationError(error)) {
      return
    }

    const settings = await this.deps.settingsStore.get()
    this.logError('Bangumi automatic sync failed.', error, { gameId })

    if (!settings.autoSync.notifyErrors) {
      return
    }

    try {
      await kisaki.notify.error('Bangumi 自动同步失败', {
        message: toUserErrorMessage(error),
        id: `bangumi-auto-sync:${gameId}`
      })
    } catch (notifyError) {
      this.logError('Bangumi automatic sync notification failed.', notifyError, { gameId })
    }
  }

  private logResult(result: SyncGameResult): void {
    if (result.status === 'synced') {
      this.deps.logger?.info('Bangumi automatic sync completed.', {
        gameId: result.gameId,
        subjectId: result.subjectId
      })
      return
    }

    this.deps.logger?.debug('Bangumi automatic sync skipped.', {
      status: result.status,
      gameId: result.gameId,
      subjectId: result.subjectId,
      suppressReason: result.suppressReason
    })
  }

  private logError(message: string, error: unknown, context: Record<string, unknown> = {}): void {
    this.deps.logger?.warn(message, {
      ...context,
      ...toSafeErrorLog(error)
    })
  }
}

function hasSyncRelevantGameChange(event: LibraryGameUpdatedEvent): boolean {
  return event.changes.some(
    (change) => change.facet === 'status' || change.facet === 'score' || change.facet === 'identity'
  )
}

function normalizeDebounceMs(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 3000
}

function isCancellationError(error: unknown): boolean {
  return (
    (error instanceof BangumiExtensionError && error.code === 'job_cancelled') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

function toUserErrorMessage(error: unknown): string {
  if (error instanceof BangumiExtensionError) {
    return error.message
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return 'Bangumi 自动同步失败。'
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
