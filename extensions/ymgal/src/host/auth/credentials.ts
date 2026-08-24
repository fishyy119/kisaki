import type { ExtensionSecrets } from '@kisaki3/extension-sdk'
import { YMGAL_PUBLIC_CLIENT_ID, YMGAL_PUBLIC_CLIENT_SECRET } from '../utils/constants'
import { YMGAL_SECRET_KEYS } from '../utils/ids'

export interface YmgalCredential {
  clientId: string
  clientSecret: string
  /** False for the shared public client YMGal documents for open API access. */
  isCustom: boolean
}

/**
 * The OAuth client the extension authenticates with.
 *
 * YMGal publishes a shared public client, so a credential always exists and
 * the extension needs no setup. A stored client only replaces it when both
 * halves are present: half a credential cannot authenticate, and silently
 * mixing it with the public one would authenticate as neither.
 */
export class CredentialStore {
  constructor(private readonly secrets: ExtensionSecrets) {}

  async getCredential(): Promise<YmgalCredential> {
    const [clientId, clientSecret] = await Promise.all([
      this.readSecret(YMGAL_SECRET_KEYS.clientId),
      this.readSecret(YMGAL_SECRET_KEYS.clientSecret)
    ])

    if (clientId && clientSecret) {
      return { clientId, clientSecret, isCustom: true }
    }

    return {
      clientId: YMGAL_PUBLIC_CLIENT_ID,
      clientSecret: YMGAL_PUBLIC_CLIENT_SECRET,
      isCustom: false
    }
  }

  async set(clientId: string, clientSecret: string): Promise<void> {
    await Promise.all([
      this.secrets.set(YMGAL_SECRET_KEYS.clientId, clientId.trim()),
      this.secrets.set(YMGAL_SECRET_KEYS.clientSecret, clientSecret.trim())
    ])
  }

  async clear(): Promise<void> {
    await Promise.all([
      this.secrets.delete(YMGAL_SECRET_KEYS.clientId),
      this.secrets.delete(YMGAL_SECRET_KEYS.clientSecret)
    ])
  }

  private async readSecret(key: string): Promise<string> {
    const raw = await this.secrets.get(key)
    return typeof raw === 'string' ? raw.trim() : ''
  }
}
