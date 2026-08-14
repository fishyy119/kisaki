import type { ExtensionSecrets } from '@kisaki3/extension-sdk'
import type { TmdbAuthMode } from '../../shared/settings'
import { TMDB_SECRET_KEYS } from '../utils/ids'

export interface TmdbCredential {
  mode: TmdbAuthMode
  value: string
}

export function detectTmdbAuthMode(key: string): TmdbAuthMode {
  return key.includes('.') ? 'bearer' : 'apiKey'
}

export class ApiKeyStore {
  constructor(private readonly secrets: ExtensionSecrets) {}

  async getCredential(): Promise<TmdbCredential | undefined> {
    const raw = await this.secrets.get(TMDB_SECRET_KEYS.apiKey)
    const value = typeof raw === 'string' ? raw.trim() : ''
    return value ? { mode: detectTmdbAuthMode(value), value } : undefined
  }

  async has(): Promise<boolean> {
    return (await this.getCredential()) !== undefined
  }

  async set(key: string): Promise<void> {
    await this.secrets.set(TMDB_SECRET_KEYS.apiKey, key.trim())
  }

  async clear(): Promise<void> {
    await this.secrets.delete(TMDB_SECRET_KEYS.apiKey)
  }
}
