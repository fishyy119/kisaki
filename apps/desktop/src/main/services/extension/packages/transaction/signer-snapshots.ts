import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type * as schema from '@shared/db'
import {
  ExtensionSignerTrustStore,
  type RestoreExtensionSignerTrustSnapshotInput,
  type TrustExtensionSignerInput
} from '../../signers'

export function snapshotSignerTrusts(
  db: BetterSQLite3Database<typeof schema>,
  signerTrusts: readonly TrustExtensionSignerInput[]
): readonly RestoreExtensionSignerTrustSnapshotInput[] {
  const store = new ExtensionSignerTrustStore(db)
  const seen = new Set<string>()
  const snapshots: RestoreExtensionSignerTrustSnapshotInput[] = []

  for (const signerTrust of signerTrusts) {
    const key = `${signerTrust.extensionId}\0${signerTrust.fingerprint}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    snapshots.push({
      extensionId: signerTrust.extensionId,
      fingerprint: signerTrust.fingerprint,
      row: store.getByScope(signerTrust.extensionId, signerTrust.fingerprint)
    })
  }

  return snapshots
}
