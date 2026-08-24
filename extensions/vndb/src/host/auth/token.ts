import type { ExtensionSecrets } from '@kisaki3/extension-sdk'
import { VNDB_SECRET_KEYS } from '../utils/ids'

/**
 * The optional VNDB API token.
 *
 * The Kana API answers anonymous requests, so a token is an upgrade rather
 * than a prerequisite: it raises the caller's rate limit.
 */
export class TokenStore {
  constructor(private readonly secrets: ExtensionSecrets) {}

  async get(): Promise<string | undefined> {
    const raw = await this.secrets.get(VNDB_SECRET_KEYS.token)
    const token = typeof raw === 'string' ? raw.trim() : ''
    return token || undefined
  }

  async has(): Promise<boolean> {
    return (await this.get()) !== undefined
  }

  async set(token: string): Promise<void> {
    await this.secrets.set(VNDB_SECRET_KEYS.token, token.trim())
  }

  async clear(): Promise<void> {
    await this.secrets.delete(VNDB_SECRET_KEYS.token)
  }
}
