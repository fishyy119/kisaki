import type { ExtensionStorage } from '@kisaki3/extension-sdk'
import type { BangumiCollectionPatch } from '../api/types'
import type { BangumiMediaScope } from '../media/scopes'
import { BANGUMI_STORAGE_KEYS } from '../shared/ids'

const SYNC_FINGERPRINT_VERSION = 1
const MAX_SYNC_FINGERPRINTS = 5000

export interface SyncFingerprintInput {
  scope: BangumiMediaScope
  localId: string
  subjectId: string
  playStatusEnabled: boolean
  mappedType?: number
  scoreEnabled: boolean
  mappedRate?: number
  clearRemoteScoreWhenEmpty: boolean
  payload: BangumiCollectionPatch
}

export interface SyncFingerprintRecord {
  scope: BangumiMediaScope
  localId: string
  subjectId: string
  fingerprint: string
  updatedAt: number
}

interface BangumiSyncStateV1 {
  version: 1
  fingerprints: Record<string, SyncFingerprintRecord>
}

export class SyncStateStore {
  constructor(private readonly storage: ExtensionStorage) {}

  async getLastFingerprint(scope: BangumiMediaScope, localId: string): Promise<string | undefined> {
    const state = await this.read()
    return state.fingerprints[createFingerprintKey(scope, localId)]?.fingerprint
  }

  async recordSuccessfulSync(record: SyncFingerprintRecord): Promise<void> {
    const state = await this.read()
    state.fingerprints[createFingerprintKey(record.scope, record.localId)] =
      normalizeFingerprintRecord(record)
    await this.write(pruneSyncState(state))
  }

  async clear(): Promise<void> {
    await this.storage.delete(BANGUMI_STORAGE_KEYS.syncState)
  }

  private async read(): Promise<BangumiSyncStateV1> {
    const raw = await this.storage.get(BANGUMI_STORAGE_KEYS.syncState)
    const state = normalizeSyncState(raw)

    if (!syncStateEqual(raw, state)) {
      await this.write(state)
    }

    return state
  }

  private async write(state: BangumiSyncStateV1): Promise<void> {
    await this.storage.set(BANGUMI_STORAGE_KEYS.syncState, state)
  }
}

export function createSyncFingerprint(input: SyncFingerprintInput): string {
  return stableStringify({
    version: SYNC_FINGERPRINT_VERSION,
    scope: input.scope,
    localId: input.localId,
    subjectId: input.subjectId,
    playStatusEnabled: input.playStatusEnabled,
    mappedType: input.mappedType ?? null,
    scoreEnabled: input.scoreEnabled,
    mappedRate: input.mappedRate ?? null,
    clearRemoteScoreWhenEmpty: input.clearRemoteScoreWhenEmpty,
    payload: {
      type: input.payload.type ?? null,
      rate: input.payload.rate ?? null
    }
  })
}

function normalizeSyncState(value: unknown): BangumiSyncStateV1 {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.fingerprints)) {
    return createEmptySyncState()
  }

  const fingerprints: Record<string, SyncFingerprintRecord> = {}
  for (const [key, record] of Object.entries(value.fingerprints)) {
    if (!isRecord(record)) {
      continue
    }

    const scope = normalizeScope(record.scope)
    const localId = readNonEmptyString(record.localId) || readLocalIdFromKey(key)
    if (!scope || !localId) {
      continue
    }

    const normalized = normalizeFingerprintRecord({
      scope,
      localId,
      subjectId: readNonEmptyString(record.subjectId),
      fingerprint: readNonEmptyString(record.fingerprint),
      updatedAt: readTimestamp(record.updatedAt)
    })

    if (normalized.subjectId && normalized.fingerprint) {
      fingerprints[createFingerprintKey(normalized.scope, normalized.localId)] = normalized
    }
  }

  return pruneSyncState({ version: 1, fingerprints })
}

function createEmptySyncState(): BangumiSyncStateV1 {
  return {
    version: 1,
    fingerprints: {}
  }
}

function pruneSyncState(state: BangumiSyncStateV1): BangumiSyncStateV1 {
  const entries = Object.entries(state.fingerprints).sort(
    (left, right) => right[1].updatedAt - left[1].updatedAt
  )

  return {
    version: 1,
    fingerprints: Object.fromEntries(entries.slice(0, MAX_SYNC_FINGERPRINTS))
  }
}

function normalizeFingerprintRecord(record: SyncFingerprintRecord): SyncFingerprintRecord {
  return {
    scope: record.scope,
    localId: record.localId.trim(),
    subjectId: record.subjectId.trim(),
    fingerprint: record.fingerprint,
    updatedAt: readTimestamp(record.updatedAt)
  }
}

function normalizeScope(value: unknown): BangumiMediaScope | undefined {
  return value === 'book' || value === 'game' || value === 'anime' || value === 'music'
    ? value
    : undefined
}

function createFingerprintKey(scope: BangumiMediaScope, localId: string): string {
  return `${scope}:${localId}`
}

function readLocalIdFromKey(key: string): string {
  const index = key.indexOf(':')
  return index >= 0 ? key.slice(index + 1).trim() : key.trim()
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

function readNonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readTimestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : Date.now()
}

function syncStateEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
