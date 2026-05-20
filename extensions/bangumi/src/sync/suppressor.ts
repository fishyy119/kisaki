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

  suppressImport(gameId: string, ttlMs = DEFAULT_IMPORT_SUPPRESS_MS): void {
    this.importSuppressions.set(gameId, Date.now() + normalizeTtlMs(ttlMs))
  }

  suppressFingerprint(
    gameId: string,
    fingerprint: string,
    ttlMs = DEFAULT_FINGERPRINT_SUPPRESS_MS
  ): void {
    this.fingerprintSuppressions.set(gameId, {
      fingerprint,
      expiresAt: Date.now() + normalizeTtlMs(ttlMs)
    })
  }

  match(gameId: string, fingerprint?: string): SyncSuppressMatch | undefined {
    const now = Date.now()
    const importExpiresAt = this.importSuppressions.get(gameId)
    if (importExpiresAt !== undefined) {
      if (importExpiresAt > now) {
        return { reason: 'import', expiresAt: importExpiresAt }
      }
      this.importSuppressions.delete(gameId)
    }

    const fingerprintRecord = this.fingerprintSuppressions.get(gameId)
    if (fingerprintRecord) {
      if (fingerprintRecord.expiresAt <= now) {
        this.fingerprintSuppressions.delete(gameId)
      } else if (fingerprintRecord.fingerprint === fingerprint) {
        return { reason: 'fingerprint', expiresAt: fingerprintRecord.expiresAt }
      }
    }

    return undefined
  }

  clearExpired(): void {
    const now = Date.now()
    for (const [gameId, expiresAt] of this.importSuppressions) {
      if (expiresAt <= now) {
        this.importSuppressions.delete(gameId)
      }
    }

    for (const [gameId, record] of this.fingerprintSuppressions) {
      if (record.expiresAt <= now) {
        this.fingerprintSuppressions.delete(gameId)
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
