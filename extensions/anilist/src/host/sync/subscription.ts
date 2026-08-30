import {
  kisaki,
  type Disposable,
  type ExtensionLogger,
  type HooksRegistrar
} from '@kisaki3/extension-sdk'
import type { AnilistSettingsStore } from '../config/schema'
import { m } from '../i18n'
import { subscribeEntryChanges, type LocalMediaRef } from '../library'
import { AnilistExtensionError, toSafeErrorLog } from '../utils/errors'
import type { SyncEngine } from './engine'

const SYNC_DEBOUNCE_MS = 3_000

interface PendingSync {
  timer: ReturnType<typeof setTimeout>
  controller: AbortController
}

/**
 * Debounced push of local media changes to the AniList lists.
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
      settingsStore: AnilistSettingsStore
      engine: SyncEngine
      logger?: ExtensionLogger
    }
  ) {}

  start(): Disposable {
    this.registration = subscribeEntryChanges(this.deps.hooks, this.deps.selfActor, (ref) => {
      this.handleChange(ref).catch((error) => {
        this.deps.logger?.warn('AniList sync scheduling failed.', toSafeErrorLog(error))
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

  private async handleChange(ref: LocalMediaRef): Promise<void> {
    const settings = await this.deps.settingsStore.get()
    if (!settings.sync.enabled || this.disposed) {
      return
    }

    const key = `${ref.kind}:${ref.id}`
    const existing = this.pending.get(key)
    if (existing) {
      clearTimeout(existing.timer)
      existing.controller.abort()
    }

    const controller = new AbortController()
    const timer = setTimeout(() => {
      this.pending.delete(key)
      this.push(ref, controller.signal).catch((error) => {
        void this.handlePushError(ref, error, controller.signal)
      })
    }, SYNC_DEBOUNCE_MS)

    this.pending.set(key, { timer, controller })
  }

  private async push(ref: LocalMediaRef, signal: AbortSignal): Promise<void> {
    const result = await this.deps.engine.syncItem(ref, { signal })

    if (result.status === 'synced') {
      this.deps.logger?.info('AniList automatic sync completed.', {
        kind: ref.kind,
        id: ref.id,
        mediaId: result.mediaId
      })
      return
    }

    this.deps.logger?.debug('AniList automatic sync skipped.', {
      status: result.status,
      kind: ref.kind,
      id: ref.id
    })
  }

  private async handlePushError(
    ref: LocalMediaRef,
    error: unknown,
    signal: AbortSignal
  ): Promise<void> {
    if (signal.aborted) {
      return
    }

    this.deps.logger?.warn('AniList automatic sync failed.', {
      kind: ref.kind,
      id: ref.id,
      ...toSafeErrorLog(error)
    })

    try {
      await kisaki.notify.error(m().sync.autoSyncFailedTitle, {
        message: toUserMessage(error),
        id: `anilist-auto-sync:${ref.kind}:${ref.id}`
      })
    } catch (notifyError) {
      this.deps.logger?.warn('AniList sync notification failed.', toSafeErrorLog(notifyError))
    }
  }
}

function toUserMessage(error: unknown): string {
  if (error instanceof AnilistExtensionError) {
    return error.message
  }

  return m().sync.autoSyncFailedFallback
}
