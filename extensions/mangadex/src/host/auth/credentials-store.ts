import type { ExtensionSecrets } from '@kisaki3/extension-sdk'
import { MANGADEX_SECRET_KEYS } from '../utils/ids'

/**
 * MangaDex personal-client credential set — the official channel for
 * personal tools. All four values live only in the local secret store.
 */
export interface MangadexCredentialsV1 {
  version: 1
  clientId: string
  clientSecret: string
  username: string
  password: string
}

export interface MangadexTokenSecretV1 {
  version: 1
  accessToken: string
  refreshToken: string
  /** Epoch ms of access-token expiry (MangaDex issues 15-minute tokens). */
  expiresAt: number
}

export class CredentialsStore {
  constructor(private readonly secrets: ExtensionSecrets) {}

  async getCredentials(): Promise<MangadexCredentialsV1 | undefined> {
    return normalizeCredentials(await this.secrets.get(MANGADEX_SECRET_KEYS.credentials))
  }

  async setCredentials(credentials: MangadexCredentialsV1): Promise<void> {
    await this.secrets.set(MANGADEX_SECRET_KEYS.credentials, credentials)
  }

  async getToken(): Promise<MangadexTokenSecretV1 | undefined> {
    return normalizeToken(await this.secrets.get(MANGADEX_SECRET_KEYS.token))
  }

  async setToken(token: MangadexTokenSecretV1): Promise<void> {
    await this.secrets.set(MANGADEX_SECRET_KEYS.token, token)
  }

  async deleteToken(): Promise<void> {
    await this.secrets.delete(MANGADEX_SECRET_KEYS.token)
  }

  async clearAll(): Promise<void> {
    await Promise.all([this.secrets.delete(MANGADEX_SECRET_KEYS.credentials), this.deleteToken()])
  }
}

function normalizeCredentials(value: unknown): MangadexCredentialsV1 | undefined {
  if (!isRecord(value) || value.version !== 1) {
    return undefined
  }

  const clientId = readString(value.clientId)
  const clientSecret = readString(value.clientSecret)
  const username = readString(value.username)
  const password = typeof value.password === 'string' ? value.password : ''
  if (!clientId || !clientSecret || !username || !password) {
    return undefined
  }

  return { version: 1, clientId, clientSecret, username, password }
}

function normalizeToken(value: unknown): MangadexTokenSecretV1 | undefined {
  if (!isRecord(value) || value.version !== 1) {
    return undefined
  }

  const accessToken = readString(value.accessToken)
  const refreshToken = readString(value.refreshToken)
  const expiresAt =
    typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt)
      ? value.expiresAt
      : undefined
  if (!accessToken || !refreshToken || expiresAt === undefined) {
    return undefined
  }

  return { version: 1, accessToken, refreshToken, expiresAt }
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
