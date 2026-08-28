import type { LibraryMediaStatus } from '@kisaki3/extension-sdk'
import type { MangadexClient } from '../api/client'
import type { MangadexSettingsStore } from '../config/schema'
import { getComic, readMangadexId } from '../library'
import { createSyncFingerprint, type SyncStateStore } from './state'
import type { SyncSuppressor } from './suppressor'

/** Local statuses map onto MangaDex reading statuses one to one. */
export function toMangadexStatus(status: LibraryMediaStatus): string {
  switch (status) {
    case 'planned':
      return 'plan_to_read'
    case 'active':
      return 'reading'
    case 'completed':
      return 'completed'
    case 'onHold':
      return 'on_hold'
    case 'dropped':
      return 'dropped'
  }
}

/** Import-side mapping; `re_reading` reads as actively consuming. */
export function statusFromMangadex(
  value: string | null | undefined
): LibraryMediaStatus | undefined {
  switch (value) {
    case 'reading':
    case 're_reading':
      return 'active'
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

/** Local scores are 0-10 with fractions; MangaDex ratings are integers 1-10. */
export function toMangadexRating(score: number | null | undefined): number | undefined {
  if (typeof score !== 'number' || !Number.isFinite(score) || score <= 0) {
    return undefined
  }

  return Math.max(1, Math.min(10, Math.round(score)))
}

export type SyncItemStatus =
  | 'synced'
  | 'skippedDisabled'
  | 'skippedMissingItem'
  | 'skippedNoMangadexId'
  | 'skippedNoStatus'
  | 'skippedNoChange'
  | 'skippedSuppressed'

export interface SyncItemResult {
  status: SyncItemStatus
  comicId: string
  mangaId?: string
}

export interface SyncEngineDependencies {
  settingsStore: MangadexSettingsStore
  client: MangadexClient
  stateStore: SyncStateStore
  suppressor: SyncSuppressor
}

/**
 * Pushes one entry's reading status and rating to MangaDex.
 *
 * Status and rating are separate endpoints; both upsert. An empty local score
 * never clears the remote rating, because clearing needs stronger authority
 * than writing.
 */
export class SyncEngine {
  constructor(private readonly deps: SyncEngineDependencies) {}

  async syncItem(
    comicId: string,
    options: { signal?: AbortSignal; force?: boolean } = {}
  ): Promise<SyncItemResult> {
    const settings = await this.deps.settingsStore.get()
    // A manual full push is explicit user intent, so it bypasses the auto gate.
    if (!settings.sync.enabled && !options.force) {
      return { status: 'skippedDisabled', comicId }
    }

    const entry = await getComic(comicId)
    if (!entry) {
      return { status: 'skippedMissingItem', comicId }
    }

    const mangaId = readMangadexId(entry.externalIds ?? [])
    if (mangaId === null) {
      return { status: 'skippedNoMangadexId', comicId }
    }

    if (!entry.status) {
      return { status: 'skippedNoStatus', comicId, mangaId }
    }

    const status = toMangadexStatus(entry.status)
    const rating = settings.sync.pushScore ? toMangadexRating(entry.score) : undefined
    const fingerprint = createSyncFingerprint({
      comicId,
      mangaId,
      status,
      rating,
      pushScore: settings.sync.pushScore
    })

    if (this.deps.suppressor.match(comicId, fingerprint)) {
      return { status: 'skippedSuppressed', comicId, mangaId }
    }

    if ((await this.deps.stateStore.getLastFingerprint(comicId)) === fingerprint) {
      return { status: 'skippedNoChange', comicId, mangaId }
    }

    await this.deps.client.updateReadingStatus(mangaId, status, { signal: options.signal })
    if (rating !== undefined) {
      await this.deps.client.updateRating(mangaId, rating, { signal: options.signal })
    }
    await this.deps.stateStore.recordSuccessfulSync(comicId, mangaId, fingerprint)
    this.deps.suppressor.suppressFingerprint(comicId, fingerprint)

    return { status: 'synced', comicId, mangaId }
  }
}
