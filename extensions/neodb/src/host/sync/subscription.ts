import {
  kisaki,
  type Disposable,
  type ExtensionLogger,
  type HooksRegistrar
} from '@kisaki3/extension-sdk'
import type { NeodbSettingsStore } from '../config/schema'
import { m } from '../i18n'
import { subscribeNovelChanges } from '../library'
import { NeodbExtensionError, toSafeErrorLog } from '../utils/errors'
import type { SyncEngine } from './engine'

const SYNC_DEBOUNCE_MS = 3_000

interface PendingSync {
  timer: ReturnType<typeof setTimeout>
  controller: AbortController
}

/**
 * Debounced push of local novel changes to the NeoDB shelf.
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
      settingsStore: NeodbSettingsStore
      engine: SyncEngine
      logger?: ExtensionLogger
    }
  ) {}

  start(): Disposable {
    this.registration = subscribeNovelChanges(this.deps.hooks, this.deps.selfActor, (novelId) => {
      this.handleChange(novelId).catch((error) => {
        this.deps.logger?.warn('NeoDB sync scheduling failed.', toSafeErrorLog(error))
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

  private async handleChange(novelId: string): Promise<void> {
    const settings = await this.deps.settingsStore.get()
    if (!settings.sync.enabled || this.disposed) {
      return
    }

    const existing = this.pending.get(novelId)
    if (existing) {
      clearTimeout(existing.timer)
      existing.controller.abort()
    }

    const controller = new AbortController()
    const timer = setTimeout(() => {
      this.pending.delete(novelId)
      this.push(novelId, controller.signal).catch((error) => {
        void this.handlePushError(novelId, error, controller.signal)
      })
    }, SYNC_DEBOUNCE_MS)

    this.pending.set(novelId, { timer, controller })
  }

  private async push(novelId: string, signal: AbortSignal): Promise<void> {
    const result = await this.deps.engine.syncItem(novelId, { signal })

    if (result.status === 'synced') {
      this.deps.logger?.info('NeoDB automatic sync completed.', {
        novelId,
        itemUuid: result.itemUuid
      })
      return
    }

    this.deps.logger?.debug('NeoDB automatic sync skipped.', {
      status: result.status,
      novelId
    })
  }

  private async handlePushError(
    novelId: string,
    error: unknown,
    signal: AbortSignal
  ): Promise<void> {
    if (signal.aborted) {
      return
    }

    this.deps.logger?.warn('NeoDB automatic sync failed.', {
      novelId,
      ...toSafeErrorLog(error)
    })

    try {
      await kisaki.notify.error(m().sync.autoSyncFailedTitle, {
        message: toUserMessage(error),
        id: `neodb-auto-sync:${novelId}`
      })
    } catch (notifyError) {
      this.deps.logger?.warn('NeoDB sync notification failed.', toSafeErrorLog(notifyError))
    }
  }
}

function toUserMessage(error: unknown): string {
  if (error instanceof NeodbExtensionError) {
    return error.message
  }

  return m().sync.autoSyncFailedFallback
}
