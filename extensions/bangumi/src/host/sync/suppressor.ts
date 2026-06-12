import type { BangumiMediaScope } from '../media/scopes'

export type SyncSuppressReason = 'import' | 'fingerprint'

export interface SyncSuppressMatch {
  reason: SyncSuppressReason
  expiresAt: number
}

interface FingerprintSuppressRecord {
  fingerprint: string
  expiresAt: number
}

const DEFAULT_IMPORT_SUPPRESS_MS = 60_000
const DEFAULT_FINGERPRINT_SUPPRESS_MS = 30_000

export class SyncSuppressor {
  private readonly importSuppressions = new Map<string, number>()
  private readonly fingerprintSuppressions = new Map<string, FingerprintSuppressRecord>()

  suppressImport(
    scope: BangumiMediaScope,
    localId: string,
    ttlMs = DEFAULT_IMPORT_SUPPRESS_MS
  ): void {
    this.importSuppressions.set(
      createSuppressKey(scope, localId),
      Date.now() + normalizeTtlMs(ttlMs)
    )
  }

  suppressFingerprint(
    scope: BangumiMediaScope,
    localId: string,
    fingerprint: string,
    ttlMs = DEFAULT_FINGERPRINT_SUPPRESS_MS
  ): void {
    this.fingerprintSuppressions.set(createSuppressKey(scope, localId), {
      fingerprint,
      expiresAt: Date.now() + normalizeTtlMs(ttlMs)
    })
  }

  match(
    scope: BangumiMediaScope,
    localId: string,
    fingerprint?: string
  ): SyncSuppressMatch | undefined {
    const now = Date.now()
    const key = createSuppressKey(scope, localId)
    const importExpiresAt = this.importSuppressions.get(key)
    if (importExpiresAt !== undefined) {
      if (importExpiresAt > now) {
        return { reason: 'import', expiresAt: importExpiresAt }
      }
      this.importSuppressions.delete(key)
    }

    const fingerprintRecord = this.fingerprintSuppressions.get(key)
    if (fingerprintRecord) {
      if (fingerprintRecord.expiresAt <= now) {
        this.fingerprintSuppressions.delete(key)
      } else if (fingerprintRecord.fingerprint === fingerprint) {
        return { reason: 'fingerprint', expiresAt: fingerprintRecord.expiresAt }
      }
    }

    return undefined
  }

  clearExpired(): void {
    const now = Date.now()
    for (const [key, expiresAt] of this.importSuppressions) {
      if (expiresAt <= now) {
        this.importSuppressions.delete(key)
      }
    }

    for (const [key, record] of this.fingerprintSuppressions) {
      if (record.expiresAt <= now) {
        this.fingerprintSuppressions.delete(key)
      }
    }
  }
}

export function createImportSuppressTtlMs(debounceMs: number): number {
  return Math.max(DEFAULT_IMPORT_SUPPRESS_MS, normalizeTtlMs(debounceMs) * 2)
}

function normalizeTtlMs(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : DEFAULT_IMPORT_SUPPRESS_MS
}

function createSuppressKey(scope: BangumiMediaScope, localId: string): string {
  return `${scope}:${localId}`
}
