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

/**
 * Keeps the push path from echoing writes that came from NeoDB itself.
 *
 * An import writes remote state into the library, which raises the same
 * change events a user edit would; suppressing the touched entries for a
 * short window breaks that loop. Fingerprint suppressions likewise absorb the
 * change event our own successful push produces.
 */
export class SyncSuppressor {
  private readonly importSuppressions = new Map<string, number>()
  private readonly fingerprintSuppressions = new Map<string, FingerprintSuppressRecord>()

  suppressImport(novelId: string, ttlMs = DEFAULT_IMPORT_SUPPRESS_MS): void {
    this.importSuppressions.set(novelId, Date.now() + normalizeTtlMs(ttlMs))
  }

  suppressFingerprint(
    novelId: string,
    fingerprint: string,
    ttlMs = DEFAULT_FINGERPRINT_SUPPRESS_MS
  ): void {
    this.fingerprintSuppressions.set(novelId, {
      fingerprint,
      expiresAt: Date.now() + normalizeTtlMs(ttlMs)
    })
  }

  match(novelId: string, fingerprint?: string): SyncSuppressMatch | undefined {
    const now = Date.now()

    const importExpiresAt = this.importSuppressions.get(novelId)
    if (importExpiresAt !== undefined) {
      if (importExpiresAt > now) {
        return { reason: 'import', expiresAt: importExpiresAt }
      }
      this.importSuppressions.delete(novelId)
    }

    const record = this.fingerprintSuppressions.get(novelId)
    if (record) {
      if (record.expiresAt <= now) {
        this.fingerprintSuppressions.delete(novelId)
      } else if (record.fingerprint === fingerprint) {
        return { reason: 'fingerprint', expiresAt: record.expiresAt }
      }
    }

    return undefined
  }
}

function normalizeTtlMs(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : DEFAULT_IMPORT_SUPPRESS_MS
}
