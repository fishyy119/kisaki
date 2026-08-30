import {
  kisaki,
  type Disposable,
  type ExtensionLogger,
  type HooksRegistrar
} from '@kisaki3/extension-sdk'
import type { VndbSettingsStore } from '../config/schema'
import { m } from '../i18n'
import { subscribeGameChanges } from '../library'
import { VndbExtensionError, toSafeErrorLog } from '../utils/errors'
import type { SyncEngine } from './engine'

const SYNC_DEBOUNCE_MS = 3_000

interface PendingSync {
  timer: ReturnType<typeof setTimeout>
  controller: AbortController
}

/**
 * Debounced push of local game changes to the user's VNDB list.
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
      settingsStore: VndbSettingsStore
      engine: SyncEngine
      logger?: ExtensionLogger
    }
  ) {}

  start(): Disposable {
    this.registration = subscribeGameChanges(this.deps.hooks, this.deps.selfActor, (gameId) => {
      this.handleChange(gameId).catch((error) => {
        this.deps.logger?.warn('VNDB sync scheduling failed.', toSafeErrorLog(error))
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

  private async handleChange(gameId: string): Promise<void> {
    const settings = await this.deps.settingsStore.get()
    if (!settings.sync.enabled || this.disposed) {
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
      this.push(gameId, controller.signal).catch((error) => {
        void this.handlePushError(gameId, error, controller.signal)
      })
    }, SYNC_DEBOUNCE_MS)

    this.pending.set(gameId, { timer, controller })
  }

  private async push(gameId: string, signal: AbortSignal): Promise<void> {
    const result = await this.deps.engine.syncItem(gameId, { signal })

    if (result.status === 'synced') {
      this.deps.logger?.info('VNDB automatic sync completed.', {
        gameId: result.gameId,
        vnId: result.vnId
      })
      return
    }

    this.deps.logger?.debug('VNDB automatic sync skipped.', {
      status: result.status,
      gameId: result.gameId
    })
  }

  private async handlePushError(
    gameId: string,
    error: unknown,
    signal: AbortSignal
  ): Promise<void> {
    if (signal.aborted) {
      return
    }

    this.deps.logger?.warn('VNDB automatic sync failed.', {
      gameId,
      ...toSafeErrorLog(error)
    })

    try {
      await kisaki.notify.error(m().sync.autoSyncFailedTitle, {
        message: toUserMessage(error),
        id: `vndb-auto-sync:${gameId}`
      })
    } catch (notifyError) {
      this.deps.logger?.warn('VNDB sync notification failed.', toSafeErrorLog(notifyError))
    }
  }
}

function toUserMessage(error: unknown): string {
  if (error instanceof VndbExtensionError) {
    return error.message
  }

  return m().sync.autoSyncFailedFallback
}
