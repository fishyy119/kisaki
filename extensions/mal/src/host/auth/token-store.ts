import type { ExtensionSecrets } from '@kisaki3/extension-sdk'
import { MAL_SECRET_KEYS } from '../utils/ids'

export interface MalTokenSecretV1 {
  version: 1
  accessToken: string
  refreshToken: string
  /** Epoch ms of access-token expiry. */
  expiresAt: number
}

export interface MalPendingLoginV1 {
  version: 1
  state: string
  codeVerifier: string
  createdAt: number
  /** Epoch ms after which the pending login is stale. */
  expiresAt: number
}

/** Persisted OAuth state: the token pair and, during sign-in, the PKCE material. */
export class TokenStore {
  constructor(private readonly secrets: ExtensionSecrets) {}

  async getToken(): Promise<MalTokenSecretV1 | undefined> {
    return normalizeToken(await this.secrets.get(MAL_SECRET_KEYS.token))
  }

  async setToken(token: MalTokenSecretV1): Promise<void> {
    await this.secrets.set(MAL_SECRET_KEYS.token, token)
  }

  async deleteToken(): Promise<void> {
    await this.secrets.delete(MAL_SECRET_KEYS.token)
  }

  async getPendingLogin(): Promise<MalPendingLoginV1 | undefined> {
    return normalizePendingLogin(await this.secrets.get(MAL_SECRET_KEYS.pendingLogin))
  }

  async setPendingLogin(pending: MalPendingLoginV1): Promise<void> {
    await this.secrets.set(MAL_SECRET_KEYS.pendingLogin, pending)
  }

  async deletePendingLogin(): Promise<void> {
    await this.secrets.delete(MAL_SECRET_KEYS.pendingLogin)
  }

  async clearAuthSecrets(): Promise<void> {
    await Promise.all([this.deleteToken(), this.deletePendingLogin()])
  }
}

function normalizeToken(value: unknown): MalTokenSecretV1 | undefined {
  if (!isRecord(value) || value.version !== 1) {
    return undefined
  }

  const accessToken = readString(value.accessToken)
  const refreshToken = readString(value.refreshToken)
  const expiresAt = readNumber(value.expiresAt)
  if (!accessToken || !refreshToken || expiresAt === undefined) {
    return undefined
  }

  return { version: 1, accessToken, refreshToken, expiresAt }
}

function normalizePendingLogin(value: unknown): MalPendingLoginV1 | undefined {
  if (!isRecord(value) || value.version !== 1) {
    return undefined
  }

  const state = readString(value.state)
  const codeVerifier = readString(value.codeVerifier)
  const createdAt = readNumber(value.createdAt)
  const expiresAt = readNumber(value.expiresAt)
  if (!state || !codeVerifier || createdAt === undefined || expiresAt === undefined) {
    return undefined
  }

  return { version: 1, state, codeVerifier, createdAt, expiresAt }
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
