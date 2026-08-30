import type { ExtensionStorage } from '@kisaki3/extension-sdk'
import type { LocalMediaRef } from '../library'
import { ANILIST_STORAGE_KEYS } from '../utils/ids'

const MAX_FINGERPRINTS = 5000

export interface SyncFingerprintEntry {
  fingerprint: string
  updatedAt: number
}

interface AnilistSyncStateV1 {
  version: 1
  fingerprints: Record<string, SyncFingerprintEntry>
}

/**
 * Last successfully pushed digest per entry.
 *
 * Change detection compares the would-be push against this record, so a
 * repeated change event for unchanged state costs no network request.
 */
export class SyncStateStore {
  constructor(private readonly storage: ExtensionStorage) {}

  async getLastFingerprint(ref: LocalMediaRef): Promise<string | undefined> {
    const state = await this.read()
    return state.fingerprints[createStateKey(ref)]?.fingerprint
  }

  async recordSuccessfulSync(ref: LocalMediaRef, fingerprint: string): Promise<void> {
    const state = await this.read()
    state.fingerprints[createStateKey(ref)] = { fingerprint, updatedAt: Date.now() }
    await this.storage.set(ANILIST_STORAGE_KEYS.syncState, prune(state))
  }

  async clear(): Promise<void> {
    await this.storage.delete(ANILIST_STORAGE_KEYS.syncState)
  }

  private async read(): Promise<AnilistSyncStateV1> {
    return normalizeState(await this.storage.get(ANILIST_STORAGE_KEYS.syncState))
  }
}

/** Digest of everything one push would write; every payload field appears. */
export function createSyncFingerprint(input: {
  ref: LocalMediaRef
  mediaId: number
  status: string
  scoreRaw: number | undefined
  pushScore: boolean
}): string {
  return JSON.stringify({
    version: 1,
    key: createStateKey(input.ref),
    mediaId: input.mediaId,
    status: input.status,
    scoreRaw: input.scoreRaw ?? null,
    pushScore: input.pushScore
  })
}

function createStateKey(ref: LocalMediaRef): string {
  return `${ref.kind}:${ref.id}`
}

function normalizeState(value: unknown): AnilistSyncStateV1 {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.fingerprints)) {
    return { version: 1, fingerprints: {} }
  }

  const fingerprints: Record<string, SyncFingerprintEntry> = {}
  for (const [key, record] of Object.entries(value.fingerprints)) {
    if (!isRecord(record)) {
      continue
    }

    const id = key.trim()
    const fingerprint = typeof record.fingerprint === 'string' ? record.fingerprint : ''
    if (!id || !fingerprint) {
      continue
    }

    fingerprints[id] = {
      fingerprint,
      updatedAt:
        typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
          ? Math.trunc(record.updatedAt)
          : Date.now()
    }
  }

  return prune({ version: 1, fingerprints })
}

function prune(state: AnilistSyncStateV1): AnilistSyncStateV1 {
  const entries = Object.entries(state.fingerprints).sort(
    (left, right) => right[1].updatedAt - left[1].updatedAt
  )

  return {
    version: 1,
    fingerprints: Object.fromEntries(entries.slice(0, MAX_FINGERPRINTS))
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
