import {
  kisaki,
  type Disposable,
  type ExtensionLogger,
  type HooksRegistrar
} from '@kisaki3/extension-sdk'
import type { MangadexSettingsStore } from '../config/schema'
import { m } from '../i18n'
import { subscribeComicChanges } from '../library'
import { MangadexExtensionError, toSafeErrorLog } from '../utils/errors'
import type { SyncEngine } from './engine'

const SYNC_DEBOUNCE_MS = 3_000

interface PendingSync {
  timer: ReturnType<typeof setTimeout>
  controller: AbortController
}

/**
 * Debounced push of local comic changes to MangaDex.
 *
 * Change events arrive per facet write; the debounce folds an edit burst into
 * one request, and a newer event aborts the older pending push.
 */
export class SyncSubscription implements Disposable {
  private readonly pending = new Map<string, PendingSync>()
  private registration: Disposable | undefined
  private disposed = false

  constructor(
    private readonly deps: {
      hooks: HooksRegistrar
      /** This extension's own change-feed actor id, for self-echo skipping. */
      selfActor: string
      settingsStore: MangadexSettingsStore
      engine: SyncEngine
      logger?: ExtensionLogger
    }
  ) {}

  start(): Disposable {
    this.registration = subscribeComicChanges(this.deps.hooks, this.deps.selfActor, (comicId) => {
      this.handleChange(comicId).catch((error) => {
        this.deps.logger?.warn('MangaDex sync scheduling failed.', toSafeErrorLog(error))
      })
    })

    return this
  }

  dispose(): void {
    this.disposed = true

    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.controller.abort()
    }
    this.pending.clear()
    this.registration?.dispose()
    this.registration = undefined
  }

  private async handleChange(comicId: string): Promise<void> {
    const settings = await this.deps.settingsStore.get()
    if (!settings.sync.enabled || this.disposed) {
      return
    }

    const existing = this.pending.get(comicId)
    if (existing) {
      clearTimeout(existing.timer)
      existing.controller.abort()
    }

    const controller = new AbortController()
    const timer = setTimeout(() => {
      this.pending.delete(comicId)
      this.push(comicId, controller.signal).catch((error) => {
        void this.handlePushError(comicId, error, controller.signal)
      })
    }, SYNC_DEBOUNCE_MS)

    this.pending.set(comicId, { timer, controller })
  }

  private async push(comicId: string, signal: AbortSignal): Promise<void> {
    const result = await this.deps.engine.syncItem(comicId, { signal })

    if (result.status === 'synced') {
      this.deps.logger?.info('MangaDex automatic sync completed.', {
        comicId,
        mangaId: result.mangaId
      })
      return
    }

    this.deps.logger?.debug('MangaDex automatic sync skipped.', {
      status: result.status,
      comicId
    })
  }

  private async handlePushError(
    comicId: string,
    error: unknown,
    signal: AbortSignal
  ): Promise<void> {
    if (signal.aborted) {
      return
    }

    this.deps.logger?.warn('MangaDex automatic sync failed.', {
      comicId,
      ...toSafeErrorLog(error)
    })

    try {
      await kisaki.notify.error(m().sync.autoSyncFailedTitle, {
        message: toUserMessage(error),
        id: `mangadex-auto-sync:${comicId}`
      })
    } catch (notifyError) {
      this.deps.logger?.warn('MangaDex sync notification failed.', toSafeErrorLog(notifyError))
    }
  }
}

function toUserMessage(error: unknown): string {
  if (error instanceof MangadexExtensionError) {
    return error.message
  }

  return m().sync.autoSyncFailedFallback
}
