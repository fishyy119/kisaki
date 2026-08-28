import type { ExtensionStorage } from '@kisaki3/extension-sdk'
import { NEODB_STORAGE_KEYS } from '../utils/ids'

const MAX_FINGERPRINTS = 5000

export interface SyncFingerprintRecord {
  novelId: string
  itemUuid: string
  fingerprint: string
  updatedAt: number
}

interface NeodbSyncStateV1 {
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

  async getLastFingerprint(novelId: string): Promise<string | undefined> {
    const state = await this.read()
    return state.fingerprints[novelId]?.fingerprint
  }

  async recordSuccessfulSync(
    novelId: string,
    itemUuid: string,
    fingerprint: string
  ): Promise<void> {
    const state = await this.read()
    state.fingerprints[novelId] = { novelId, itemUuid, fingerprint, updatedAt: Date.now() }
    await this.storage.set(NEODB_STORAGE_KEYS.syncState, prune(state))
  }

  async clear(): Promise<void> {
    await this.storage.delete(NEODB_STORAGE_KEYS.syncState)
  }

  private async read(): Promise<NeodbSyncStateV1> {
    return normalizeState(await this.storage.get(NEODB_STORAGE_KEYS.syncState))
  }
}

/** Digest of everything one push would write; every payload field appears. */
export function createSyncFingerprint(input: {
  novelId: string
  itemUuid: string
  shelfType: string
  ratingGrade: number | undefined
  visibility: number
  pushScore: boolean
}): string {
  return JSON.stringify({
    version: 1,
    novelId: input.novelId,
    itemUuid: input.itemUuid,
    shelfType: input.shelfType,
    ratingGrade: input.ratingGrade ?? null,
    visibility: input.visibility,
    pushScore: input.pushScore
  })
}

function normalizeState(value: unknown): NeodbSyncStateV1 {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.fingerprints)) {
    return { version: 1, fingerprints: {} }
  }

  const fingerprints: Record<string, SyncFingerprintRecord> = {}
  for (const [novelId, record] of Object.entries(value.fingerprints)) {
    if (!isRecord(record)) {
      continue
    }

    const fingerprint = typeof record.fingerprint === 'string' ? record.fingerprint : ''
    const itemUuid = typeof record.itemUuid === 'string' ? record.itemUuid : ''
    if (!fingerprint || !itemUuid) {
      continue
    }

    fingerprints[novelId] = {
      novelId,
      itemUuid,
      fingerprint,
      updatedAt:
        typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
          ? Math.trunc(record.updatedAt)
          : Date.now()
    }
  }

  return prune({ version: 1, fingerprints })
}

function prune(state: NeodbSyncStateV1): NeodbSyncStateV1 {
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
