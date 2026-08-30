import type { ExtensionSecrets } from '@kisaki3/extension-sdk'
import type {
  OAuthRelayPendingSession,
  OAuthRelaySessionStore,
  OAuthRelayToken
} from './oauth-relay'
import { GBOOKS_SECRET_KEYS } from '../utils/ids'

export interface GbooksTokenSecretV1 {
  version: 1
  accessToken: string
  /** Refresh happens through the relay, which holds the client secret. */
  refreshToken?: string
  /** Epoch ms of access-token expiry (Google issues one-hour tokens). */
  expiresAt?: number
}

interface GbooksPendingSessionSecretV1 extends OAuthRelayPendingSession {
  version: 1
}

/**
 * Persisted OAuth state: the token pair and, while a browser sign-in is
 * underway, the pending relay session. Implements the SDK relay flow's store
 * seam directly.
 */
export class TokenStore implements OAuthRelaySessionStore {
  constructor(private readonly secrets: ExtensionSecrets) {}

  async getToken(): Promise<GbooksTokenSecretV1 | undefined> {
    return normalizeTokenSecret(await this.secrets.get(GBOOKS_SECRET_KEYS.token))
  }

  async setToken(token: OAuthRelayToken): Promise<void> {
    const current = await this.getToken()
    await this.secrets.set(GBOOKS_SECRET_KEYS.token, {
      version: 1,
      accessToken: token.accessToken,
      // Google rotates refresh tokens rarely; keep the old one when absent.
      ...((token.refreshToken ?? current?.refreshToken)
        ? { refreshToken: token.refreshToken ?? current?.refreshToken }
        : {}),
      ...(token.expiresAt !== undefined ? { expiresAt: token.expiresAt } : {})
    })
  }

  async deleteToken(): Promise<void> {
    await this.secrets.delete(GBOOKS_SECRET_KEYS.token)
  }

  async getPendingSession(): Promise<OAuthRelayPendingSession | undefined> {
    return normalizePendingSession(await this.secrets.get(GBOOKS_SECRET_KEYS.pendingSession))
  }

  async setPendingSession(session: OAuthRelayPendingSession): Promise<void> {
    const record: GbooksPendingSessionSecretV1 = {
      version: 1,
      sessionId: session.sessionId,
      state: session.state,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      ...(session.authorizeUrl !== undefined ? { authorizeUrl: session.authorizeUrl } : {})
    }
    await this.secrets.set(GBOOKS_SECRET_KEYS.pendingSession, record)
  }

  async deletePendingSession(): Promise<void> {
    await this.secrets.delete(GBOOKS_SECRET_KEYS.pendingSession)
  }

  async getApiKey(): Promise<string | undefined> {
    const value = await this.secrets.get(GBOOKS_SECRET_KEYS.apiKey)
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }

  async setApiKey(key: string): Promise<void> {
    await this.secrets.set(GBOOKS_SECRET_KEYS.apiKey, key)
  }

  async deleteApiKey(): Promise<void> {
    await this.secrets.delete(GBOOKS_SECRET_KEYS.apiKey)
  }

  async clearAuthSecrets(): Promise<void> {
    await Promise.all([this.deleteToken(), this.deletePendingSession()])
  }
}

function normalizeTokenSecret(value: unknown): GbooksTokenSecretV1 | undefined {
  if (!isRecord(value) || value.version !== 1 || typeof value.accessToken !== 'string') {
    return undefined
  }

  const accessToken = value.accessToken.trim()
  if (!accessToken) {
    return undefined
  }

  const refreshToken =
    typeof value.refreshToken === 'string' && value.refreshToken.trim()
      ? value.refreshToken.trim()
      : undefined
  const expiresAt =
    typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt)
      ? Math.trunc(value.expiresAt)
      : undefined

  return {
    version: 1,
    accessToken,
    ...(refreshToken !== undefined ? { refreshToken } : {}),
    ...(expiresAt !== undefined ? { expiresAt } : {})
  }
}

function normalizePendingSession(value: unknown): OAuthRelayPendingSession | undefined {
  if (!isRecord(value) || value.version !== 1) {
    return undefined
  }

  const sessionId = readString(value.sessionId)
  const state = readString(value.state)
  const expiresAt = readNumber(value.expiresAt)
  const createdAt = readNumber(value.createdAt)
  if (!sessionId || !state || expiresAt === undefined || createdAt === undefined) {
    return undefined
  }

  const authorizeUrl = readString(value.authorizeUrl)
  return {
    sessionId,
    state,
    expiresAt,
    createdAt,
    ...(authorizeUrl ? { authorizeUrl } : {})
  }
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
