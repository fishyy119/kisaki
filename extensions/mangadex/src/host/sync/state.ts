import type { ExtensionStorage } from '@kisaki3/extension-sdk'
import { MANGADEX_STORAGE_KEYS } from '../utils/ids'

const MAX_FINGERPRINTS = 5000

export interface SyncFingerprintRecord {
  comicId: string
  mangaId: string
  fingerprint: string
  updatedAt: number
}

interface MangadexSyncStateV1 {
  version: 1
  fingerprints: Record<string, SyncFingerprintRecord>
}

/**
 * Last successfully pushed digest per entry.
 *
 * Change detection compares the would-be push against this record, so a
 * repeated change event for unchanged state costs no network request.
 */
export class SyncStateStore {
  constructor(private readonly storage: ExtensionStorage) {}

  async getLastFingerprint(comicId: string): Promise<string | undefined> {
    const state = await this.read()
    return state.fingerprints[comicId]?.fingerprint
  }

  async recordSuccessfulSync(comicId: string, mangaId: string, fingerprint: string): Promise<void> {
    const state = await this.read()
    state.fingerprints[comicId] = { comicId, mangaId, fingerprint, updatedAt: Date.now() }
    await this.storage.set(MANGADEX_STORAGE_KEYS.syncState, prune(state))
  }

  async clear(): Promise<void> {
    await this.storage.delete(MANGADEX_STORAGE_KEYS.syncState)
  }

  private async read(): Promise<MangadexSyncStateV1> {
    return normalizeState(await this.storage.get(MANGADEX_STORAGE_KEYS.syncState))
  }
}

/** Digest of everything one push would write; every payload field appears. */
export function createSyncFingerprint(input: {
  comicId: string
  mangaId: string
  status: string
  rating: number | undefined
  pushScore: boolean
}): string {
  return JSON.stringify({
    version: 1,
    comicId: input.comicId,
    mangaId: input.mangaId,
    status: input.status,
    rating: input.rating ?? null,
    pushScore: input.pushScore
  })
}

function normalizeState(value: unknown): MangadexSyncStateV1 {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.fingerprints)) {
    return { version: 1, fingerprints: {} }
  }

  const fingerprints: Record<string, SyncFingerprintRecord> = {}
  for (const [comicId, record] of Object.entries(value.fingerprints)) {
    if (!isRecord(record)) {
      continue
    }

    const fingerprint = typeof record.fingerprint === 'string' ? record.fingerprint : ''
    const mangaId = typeof record.mangaId === 'string' ? record.mangaId : ''
    if (!fingerprint || !mangaId) {
      continue
    }

    fingerprints[comicId] = {
      comicId,
      mangaId,
      fingerprint,
      updatedAt:
        typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
          ? Math.trunc(record.updatedAt)
          : Date.now()
    }
  }

  return prune({ version: 1, fingerprints })
}

function prune(state: MangadexSyncStateV1): MangadexSyncStateV1 {
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
