/**
 * Episode-level sync bookkeeping.
 *
 * The fingerprint of an entry is the set of Bangumi episode ids already known
 * to be marked watched remotely: pushes are the difference against it, so a
 * replayed local change does not re-send the whole season.
 */

import type { ExtensionStorage } from '@kisaki3/extension-sdk'
import { isBangumiMediaScope, type BangumiMediaScope } from '../../shared/scopes'
import { BANGUMI_STORAGE_KEYS } from '../utils/ids'

const MAX_EPISODE_SYNC_ENTRIES = 2000

export interface EpisodeSyncRecord {
  scope: BangumiMediaScope
  localId: string
  subjectId: string
  /** Bangumi episode ids last confirmed as watched remotely. */
  watchedEpisodeIds: number[]
  updatedAt: number
}

interface BangumiEpisodeSyncStateV1 {
  version: 1
  entries: Record<string, EpisodeSyncRecord>
}

export class EpisodeSyncStateStore {
  constructor(private readonly storage: ExtensionStorage) {}

  async get(scope: BangumiMediaScope, localId: string): Promise<EpisodeSyncRecord | undefined> {
    const state = await this.read()
    return state.entries[createEntryKey(scope, localId)]
  }

  async record(record: EpisodeSyncRecord): Promise<void> {
    const state = await this.read()
    state.entries[createEntryKey(record.scope, record.localId)] = normalizeRecord(record)
    await this.write(pruneState(state))
  }

  async clear(): Promise<void> {
    await this.storage.delete(BANGUMI_STORAGE_KEYS.episodeSyncState)
  }

  private async read(): Promise<BangumiEpisodeSyncStateV1> {
    const raw = await this.storage.get(BANGUMI_STORAGE_KEYS.episodeSyncState)
    const state = normalizeState(raw)

    if (JSON.stringify(raw) !== JSON.stringify(state)) {
      await this.write(state)
    }

    return state
  }

  private async write(state: BangumiEpisodeSyncStateV1): Promise<void> {
    await this.storage.set(BANGUMI_STORAGE_KEYS.episodeSyncState, state)
  }
}

function normalizeState(value: unknown): BangumiEpisodeSyncStateV1 {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.entries)) {
    return { version: 1, entries: {} }
  }

  const entries: Record<string, EpisodeSyncRecord> = {}
  for (const entry of Object.values(value.entries)) {
    if (!isRecord(entry)) {
      continue
    }

    const scope = normalizeScope(entry.scope)
    const localId = readNonEmptyString(entry.localId)
    const subjectId = readNonEmptyString(entry.subjectId)
    if (!scope || !localId || !subjectId) {
      continue
    }

    entries[createEntryKey(scope, localId)] = normalizeRecord({
      scope,
      localId,
      subjectId,
      watchedEpisodeIds: readEpisodeIds(entry.watchedEpisodeIds),
      updatedAt: readTimestamp(entry.updatedAt)
    })
  }

  return pruneState({ version: 1, entries })
}

function pruneState(state: BangumiEpisodeSyncStateV1): BangumiEpisodeSyncStateV1 {
  const entries = Object.entries(state.entries).sort(
    (left, right) => right[1].updatedAt - left[1].updatedAt
  )

  return {
    version: 1,
    entries: Object.fromEntries(entries.slice(0, MAX_EPISODE_SYNC_ENTRIES))
  }
}

function normalizeRecord(record: EpisodeSyncRecord): EpisodeSyncRecord {
  return {
    scope: record.scope,
    localId: record.localId.trim(),
    subjectId: record.subjectId.trim(),
    watchedEpisodeIds: [...new Set(record.watchedEpisodeIds)].sort((left, right) => left - right),
    updatedAt: readTimestamp(record.updatedAt)
  }
}

function normalizeScope(value: unknown): BangumiMediaScope | undefined {
  return isBangumiMediaScope(value) ? value : undefined
}

function readEpisodeIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(
    (entry): entry is number => typeof entry === 'number' && Number.isInteger(entry) && entry > 0
  )
}

function createEntryKey(scope: BangumiMediaScope, localId: string): string {
  return `${scope}:${localId}`
}

function readNonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readTimestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : Date.now()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
