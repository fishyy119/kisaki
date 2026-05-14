import type { ExtensionSignerTrustRow } from '@shared/db'
import type { ExtensionTrustedSignerInfo } from '@shared/extension'
import type { ExtensionSignerTrustStore, TrustExtensionSignerInput } from './store'

export interface ExtensionSignerTrustManagerOptions {
  store: ExtensionSignerTrustStore
  runMutatingOperation?<T>(operation: () => Promise<T>): Promise<T>
  onTrustedSignersChanged?: () => void
}

export class ExtensionSignerTrustManager {
  private readonly store: ExtensionSignerTrustStore

  constructor(private readonly options: ExtensionSignerTrustManagerOptions) {
    this.store = options.store
  }

  list(): readonly ExtensionSignerTrustRow[] {
    return this.store.list()
  }

  listTrustedSigners(): readonly ExtensionTrustedSignerInfo[] {
    return this.list().map(toExtensionTrustedSignerInfo)
  }

  listByExtension(extensionId: string): readonly ExtensionSignerTrustRow[] {
    return this.store.listByExtension(extensionId)
  }

  get(id: string): ExtensionSignerTrustRow | null {
    return this.store.get(id)
  }

  getByScope(extensionId: string, fingerprint: string): ExtensionSignerTrustRow | null {
    return this.store.getByScope(extensionId, fingerprint)
  }

  isTrusted(extensionId: string, fingerprint: string): boolean {
    return this.store.isTrusted(extensionId, fingerprint)
  }

  trust(input: TrustExtensionSignerInput): ExtensionSignerTrustRow {
    return this.store.trust(input)
  }

  remove(id: string): boolean {
    return this.store.remove(id)
  }

  removeByScope(extensionId: string, fingerprint: string): boolean {
    return this.store.removeByScope(extensionId, fingerprint)
  }

  async removeTrustedSigner(trustedSignerId: string): Promise<void> {
    await this.runMutatingOperation(async () => {
      const removed = this.remove(trustedSignerId)
      if (!removed) {
        throw new Error(`Trusted signer "${trustedSignerId}" does not exist.`)
      }

      this.options.onTrustedSignersChanged?.()
    })
  }

  private runMutatingOperation<T>(operation: () => Promise<T>): Promise<T> {
    return this.options.runMutatingOperation?.(operation) ?? operation()
  }
}

function toExtensionTrustedSignerInfo(row: ExtensionSignerTrustRow): ExtensionTrustedSignerInfo {
  return {
    id: row.id,
    extensionId: row.extensionId,
    fingerprint: row.fingerprint,
    algorithm: row.algorithm,
    publicKey: row.publicKey,
    label: row.label,
    trustedFromRepositoryId: row.trustedFromRepositoryId,
    trustedFromRepositoryUrl: row.trustedFromRepositoryUrl,
    trustedAt: toIsoString(row.trustedAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt)
  }
}

function toIsoString(value: Date | number | string): string {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.valueOf()) ? new Date(0).toISOString() : date.toISOString()
}
