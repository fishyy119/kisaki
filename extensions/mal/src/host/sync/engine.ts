import type { LibraryMediaStatus } from '@kisaki3/extension-sdk'
import type { MalOfficialClient } from '../api/official-client'
import type { MalSettingsStore } from '../config/schema'
import { getEntry, readMalMediaId, type LocalMediaRef } from '../library'
import { toMalFamily } from '../media/kinds'
import { createSyncFingerprint, type SyncStateStore } from './state'
import type { SyncSuppressor } from './suppressor'

/** Local statuses map onto MAL's list statuses one to one, per family. */
export function toMalStatus(kind: 'anime' | 'manga', status: LibraryMediaStatus): string {
  switch (status) {
    case 'planned':
      return kind === 'anime' ? 'plan_to_watch' : 'plan_to_read'
    case 'active':
      return kind === 'anime' ? 'watching' : 'reading'
    case 'completed':
      return 'completed'
    case 'onHold':
      return 'on_hold'
    case 'dropped':
      return 'dropped'
  }
}

/** Import-side mapping; unknown remote statuses read as no statement. */
export function statusFromMal(value: string | null | undefined): LibraryMediaStatus | undefined {
  switch (value) {
    case 'watching':
    case 'reading':
      return 'active'
    case 'plan_to_watch':
    case 'plan_to_read':
      return 'planned'
    case 'completed':
      return 'completed'
    case 'on_hold':
      return 'onHold'
    case 'dropped':
      return 'dropped'
    default:
      return undefined
  }
}

/** Local scores are 0-10 with fractions; MAL scores are integers 1-10. */
export function toMalScore(score: number | null | undefined): number | undefined {
  if (typeof score !== 'number' || !Number.isFinite(score) || score <= 0) {
    return undefined
  }

  return Math.max(1, Math.min(10, Math.round(score)))
}

/** MAL list scores are integers 0-10, where 0 means unscored. */
export function scoreFromMal(score: number | null | undefined): number | undefined {
  if (typeof score !== 'number' || !Number.isFinite(score) || score <= 0) {
    return undefined
  }

  return Math.min(10, score)
}

export type SyncItemStatus =
  | 'synced'
  | 'skippedDisabled'
  | 'skippedMissingItem'
  | 'skippedNoMalId'
  | 'skippedNoStatus'
  | 'skippedNoChange'
  | 'skippedSuppressed'

export interface SyncItemResult {
  status: SyncItemStatus
  ref: LocalMediaRef
  mediaId?: number
}

export interface SyncEngineDependencies {
  settingsStore: MalSettingsStore
  client: MalOfficialClient
  stateStore: SyncStateStore
  suppressor: SyncSuppressor
}

/**
 * Pushes one entry's status and score to the matching MAL list.
 *
 * `PATCH my_list_status` upserts, so no remote existence check is needed. An
 * empty local score never clears the remote one, because clearing needs
 * stronger authority than writing.
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

    const mediaId = readMalMediaId(entry.externalIds ?? [])
    if (mediaId === null) {
      return { status: 'skippedNoMalId', ref }
    }

    if (!entry.status) {
      return { status: 'skippedNoStatus', ref, mediaId }
    }

    const family = toMalFamily(ref.kind)
    const status = toMalStatus(family, entry.status)
    const score = settings.sync.pushScore ? toMalScore(entry.score) : undefined
    const fingerprint = createSyncFingerprint({
      ref,
      mediaId,
      status,
      score,
      pushScore: settings.sync.pushScore
    })

    if (this.deps.suppressor.match(ref, fingerprint)) {
      return { status: 'skippedSuppressed', ref, mediaId }
    }

    if ((await this.deps.stateStore.getLastFingerprint(ref)) === fingerprint) {
      return { status: 'skippedNoChange', ref, mediaId }
    }

    await this.deps.client.updateListStatus(
      family,
      mediaId,
      { status, ...(score !== undefined ? { score } : {}) },
      { signal: options.signal }
    )
    await this.deps.stateStore.recordSuccessfulSync(ref, mediaId, fingerprint)
    this.deps.suppressor.suppressFingerprint(ref, fingerprint)

    return { status: 'synced', ref, mediaId }
  }
}
