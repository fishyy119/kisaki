import type { ExtensionSecrets } from '@kisaki3/extension-sdk'
import { IGDB_SECRET_KEYS } from '../utils/ids'

export interface IgdbCredential {
  clientId: string
  clientSecret: string
}

/**
 * The Twitch application IGDB authenticates against.
 *
 * IGDB has no anonymous access, so a credential is a prerequisite: without
 * both halves the providers cannot answer at all, and half a credential
 * cannot authenticate.
 */
export class CredentialStore {
  constructor(private readonly secrets: ExtensionSecrets) {}

  async getCredential(): Promise<IgdbCredential | undefined> {
    const [clientId, clientSecret] = await Promise.all([
      this.readSecret(IGDB_SECRET_KEYS.clientId),
      this.readSecret(IGDB_SECRET_KEYS.clientSecret)
    ])

    return clientId && clientSecret ? { clientId, clientSecret } : undefined
  }

  async set(clientId: string, clientSecret: string): Promise<void> {
    await Promise.all([
      this.secrets.set(IGDB_SECRET_KEYS.clientId, clientId.trim()),
      this.secrets.set(IGDB_SECRET_KEYS.clientSecret, clientSecret.trim())
    ])
  }

  async clear(): Promise<void> {
    await Promise.all([
      this.secrets.delete(IGDB_SECRET_KEYS.clientId),
      this.secrets.delete(IGDB_SECRET_KEYS.clientSecret)
    ])
  }

  private async readSecret(key: string): Promise<string> {
    const raw = await this.secrets.get(key)
    return typeof raw === 'string' ? raw.trim() : ''
  }
}
