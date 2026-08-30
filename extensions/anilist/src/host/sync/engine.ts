import type { ExtensionLogger, LibraryMediaStatus } from '@kisaki3/extension-sdk'
import type { AnilistClient } from '../api/client'
import type { AnilistSettingsStore } from '../config/schema'
import { getEntry, readAnilistMediaId, type LocalMediaRef } from '../library'
import { createSyncFingerprint, type SyncStateStore } from './state'

/** Local statuses map onto AniList's list statuses one to one. */
export const ANILIST_STATUS_BY_LOCAL: Record<LibraryMediaStatus, string> = {
  planned: 'PLANNING',
  active: 'CURRENT',
  completed: 'COMPLETED',
  onHold: 'PAUSED',
  dropped: 'DROPPED'
}

export type SyncItemStatus =
  | 'synced'
  | 'skippedDisabled'
  | 'skippedMissingItem'
  | 'skippedNoRemoteId'
  | 'skippedNoStatus'
  | 'skippedNoChange'

export interface SyncItemResult {
  status: SyncItemStatus
  ref: LocalMediaRef
  mediaId?: number
}

export interface SyncEngineDependencies {
  settingsStore: AnilistSettingsStore
  client: AnilistClient
  stateStore: SyncStateStore
  logger?: ExtensionLogger
}

/**
 * Pushes one entry's status and score to the matching AniList list.
 *
 * `SaveMediaListEntry` upserts, so no remote existence check is needed. The
 * score travels as `scoreRaw` on the 100-point scale, which is valid whatever
 * score format the account uses; an empty local score never clears the remote
 * one, because clearing needs stronger authority than writing.
 */
export class SyncEngine {
  constructor(private readonly deps: SyncEngineDependencies) {}

  async syncItem(
    ref: LocalMediaRef,
    options: { signal?: AbortSignal; force?: boolean } = {}
  ): Promise<SyncItemResult> {
    const settings = await this.deps.settingsStore.get()
    // A manual full push is explicit user intent, so it bypasses the auto gate.
    if (!settings.sync.enabled && !options.force) {
      return { status: 'skippedDisabled', ref }
    }

    const entry = await getEntry(ref)
    if (!entry) {
      return { status: 'skippedMissingItem', ref }
    }

    const mediaId = readAnilistMediaId(entry.externalIds ?? [])
    if (mediaId === null) {
      return { status: 'skippedNoRemoteId', ref }
    }

    if (!entry.status) {
      return { status: 'skippedNoStatus', ref, mediaId }
    }

    const status = ANILIST_STATUS_BY_LOCAL[entry.status]
    const scoreRaw = settings.sync.pushScore ? toScoreRaw(entry.score) : undefined
    const fingerprint = createSyncFingerprint({
      ref,
      mediaId,
      status,
      scoreRaw,
      pushScore: settings.sync.pushScore
    })

    if ((await this.deps.stateStore.getLastFingerprint(ref)) === fingerprint) {
      return { status: 'skippedNoChange', ref, mediaId }
    }

    await this.deps.client.saveMediaListEntry(
      mediaId,
      { status, ...(scoreRaw !== undefined ? { scoreRaw } : {}) },
      { signal: options.signal }
    )
    await this.deps.stateStore.recordSuccessfulSync(ref, fingerprint)

    return { status: 'synced', ref, mediaId }
  }
}

/** Local scores are 0-10; AniList raw scores are integers 1-100. */
export function toScoreRaw(score: number | null | undefined): number | undefined {
  if (typeof score !== 'number' || !Number.isFinite(score) || score <= 0) {
    return undefined
  }

  return Math.max(1, Math.min(100, Math.round(score * 10)))
}

/** AniList list scores arrive on the 100 scale; local scores are 0-10. */
export function fromScore100(score: number | null | undefined): number | undefined {
  if (typeof score !== 'number' || !Number.isFinite(score) || score <= 0) {
    return undefined
  }

  return Math.min(10, Math.round(score) / 10)
}

/** Import-side mapping; `REPEATING` reads as actively consuming. */
export function statusFromAnilist(
  value: string | null | undefined
): LibraryMediaStatus | undefined {
  switch (value) {
    case 'CURRENT':
    case 'REPEATING':
      return 'active'
    case 'PLANNING':
      return 'planned'
    case 'COMPLETED':
      return 'completed'
    case 'PAUSED':
      return 'onHold'
    case 'DROPPED':
      return 'dropped'
    default:
      return undefined
  }
}
