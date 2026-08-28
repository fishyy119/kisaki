import type { ExtensionStorage } from '@kisaki3/extension-sdk'
import { VNDB_STORAGE_KEYS } from '../utils/ids'

const MAX_FINGERPRINTS = 5000

export interface SyncFingerprintRecord {
  gameId: string
  vnId: string
  fingerprint: string
  updatedAt: number
}

interface VndbSyncStateV1 {
  version: 1
  fingerprints: Record<string, SyncFingerprintRecord>
}

/**
 * Last successfully pushed digest per game entry.
 *
 * Change detection compares the would-be push against this record, so a
 * repeated change event for unchanged state costs no network request.
 */
export class SyncStateStore {
  constructor(private readonly storage: ExtensionStorage) {}

  async getLastFingerprint(gameId: string): Promise<string | undefined> {
    const state = await this.read()
    return state.fingerprints[gameId]?.fingerprint
  }

  async recordSuccessfulSync(record: SyncFingerprintRecord): Promise<void> {
    const state = await this.read()
    state.fingerprints[record.gameId] = {
      gameId: record.gameId.trim(),
      vnId: record.vnId.trim(),
      fingerprint: record.fingerprint,
      updatedAt: record.updatedAt
    }
    await this.storage.set(VNDB_STORAGE_KEYS.syncState, prune(state))
  }

  async clear(): Promise<void> {
    await this.storage.delete(VNDB_STORAGE_KEYS.syncState)
  }

  private async read(): Promise<VndbSyncStateV1> {
    return normalizeState(await this.storage.get(VNDB_STORAGE_KEYS.syncState))
  }
}

/** Digest of everything one push would write; every payload field appears. */
export function createSyncFingerprint(input: {
  gameId: string
  vnId: string
  labelId: number
  vote: number | undefined
  pushScore: boolean
}): string {
  return JSON.stringify({
    version: 1,
    gameId: input.gameId,
    vnId: input.vnId,
    labelId: input.labelId,
    vote: input.vote ?? null,
    pushScore: input.pushScore
  })
}

function normalizeState(value: unknown): VndbSyncStateV1 {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.fingerprints)) {
    return { version: 1, fingerprints: {} }
  }

  const fingerprints: Record<string, SyncFingerprintRecord> = {}
  for (const [key, record] of Object.entries(value.fingerprints)) {
    if (!isRecord(record)) {
      continue
    }

    const gameId = readString(record.gameId) || key.trim()
    const vnId = readString(record.vnId)
    const fingerprint = readString(record.fingerprint)
    if (!gameId || !vnId || !fingerprint) {
      continue
    }

    fingerprints[gameId] = {
      gameId,
      vnId,
      fingerprint,
      updatedAt: readTimestamp(record.updatedAt)
    }
  }

  return prune({ version: 1, fingerprints })
}

function prune(state: VndbSyncStateV1): VndbSyncStateV1 {
  const entries = Object.entries(state.fingerprints).sort(
    (left, right) => right[1].updatedAt - left[1].updatedAt
  )

  return {
    version: 1,
    fingerprints: Object.fromEntries(entries.slice(0, MAX_FINGERPRINTS))
  }
}

function readString(value: unknown): string {
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
