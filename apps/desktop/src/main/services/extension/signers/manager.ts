import type { ExtensionSignerTrustRow } from '@shared/db'
import type { ExtensionSignerTrustStore, TrustExtensionSignerInput } from './store'

export class ExtensionSignerTrustManager {
  constructor(private readonly store: ExtensionSignerTrustStore) {}

  list(): readonly ExtensionSignerTrustRow[] {
    return this.store.list()
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
}
