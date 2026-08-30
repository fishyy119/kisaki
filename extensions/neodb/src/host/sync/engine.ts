import type { LibraryMediaStatus } from '@kisaki3/extension-sdk'
import type { NeodbClient } from '../api/client'
import type { NdShelfType } from '../api/types'
import type { NeodbSettingsStore } from '../config/schema'
import type { NeodbSyncVisibility } from '../../shared/settings'
import { getNovel, readNeodbId } from '../library'
import { createSyncFingerprint, type SyncStateStore } from './state'
/**
 * NeoDB has no on-hold shelf, so `onHold` states nothing pushable; mapping it
 * to any shelf would misstate the user's record.
 */
export function toShelfType(status: LibraryMediaStatus): NdShelfType | undefined {
  switch (status) {
    case 'planned':
      return 'wishlist'
    case 'active':
      return 'progress'
    case 'completed':
      return 'complete'
    case 'dropped':
      return 'dropped'
    case 'onHold':
      return undefined
  }
}

export function statusFromShelf(
  shelfType: string | null | undefined
): LibraryMediaStatus | undefined {
  switch (shelfType) {
    case 'wishlist':
      return 'planned'
    case 'progress':
      return 'active'
    case 'complete':
      return 'completed'
    case 'dropped':
      return 'dropped'
    default:
      return undefined
  }
}

/** Local scores are 0-10 with fractions; NeoDB rating grades are integers 1-10. */
export function toRatingGrade(score: number | null | undefined): number | undefined {
  if (typeof score !== 'number' || !Number.isFinite(score) || score <= 0) {
    return undefined
  }

  return Math.max(1, Math.min(10, Math.round(score)))
}

export function scoreFromRatingGrade(grade: number | null | undefined): number | undefined {
  if (typeof grade !== 'number' || !Number.isFinite(grade) || grade <= 0) {
    return undefined
  }

  return Math.min(10, grade)
}

/** Fediverse visibility levels the API uses. */
export function toVisibilityLevel(visibility: NeodbSyncVisibility): number {
  switch (visibility) {
    case 'public':
      return 0
    case 'followers':
      return 1
    case 'self':
      return 2
  }
}

export type SyncItemStatus =
  | 'synced'
  | 'skippedDisabled'
  | 'skippedMissingItem'
  | 'skippedNoRemoteId'
  | 'skippedNoStatus'
  | 'skippedNoMapping'
  | 'skippedNoChange'

export interface SyncItemResult {
  status: SyncItemStatus
  novelId: string
  itemUuid?: string
}

export interface SyncEngineDependencies {
  settingsStore: NeodbSettingsStore
  client: NeodbClient
  stateStore: SyncStateStore
}

/**
 * Pushes one entry's status and score to the NeoDB shelf. Marking upserts.
 * An empty local score never clears the remote rating, because clearing
 * needs stronger authority than writing.
 */
export class SyncEngine {
  constructor(private readonly deps: SyncEngineDependencies) {}

  async syncItem(
    novelId: string,
    options: { signal?: AbortSignal; force?: boolean } = {}
  ): Promise<SyncItemResult> {
    const settings = await this.deps.settingsStore.get()
    // A manual full push is explicit user intent, so it bypasses the auto gate.
    if (!settings.sync.enabled && !options.force) {
      return { status: 'skippedDisabled', novelId }
    }

    const entry = await getNovel(novelId)
    if (!entry) {
      return { status: 'skippedMissingItem', novelId }
    }

    const itemUuid = readNeodbId(entry.externalIds ?? [])
    if (itemUuid === null) {
      return { status: 'skippedNoRemoteId', novelId }
    }

    if (!entry.status) {
      return { status: 'skippedNoStatus', novelId, itemUuid }
    }

    const shelfType = toShelfType(entry.status)
    if (!shelfType) {
      return { status: 'skippedNoMapping', novelId, itemUuid }
    }

    const ratingGrade = settings.sync.pushScore ? toRatingGrade(entry.score) : undefined
    const visibility = toVisibilityLevel(settings.sync.visibility)
    const fingerprint = createSyncFingerprint({
      novelId,
      itemUuid,
      shelfType,
      ratingGrade,
      visibility,
      pushScore: settings.sync.pushScore
    })

    if ((await this.deps.stateStore.getLastFingerprint(novelId)) === fingerprint) {
      return { status: 'skippedNoChange', novelId, itemUuid }
    }

    await this.deps.client.markItem(
      itemUuid,
      {
        shelfType,
        visibility,
        ...(ratingGrade !== undefined ? { ratingGrade } : {})
      },
      { signal: options.signal }
    )
    await this.deps.stateStore.recordSuccessfulSync(novelId, {
      fingerprint,
      updatedAt: Date.now()
    })

    return { status: 'synced', novelId, itemUuid }
  }
}
