import type { ExtensionSecrets } from '@kisaki3/extension-sdk'
import type {
  OAuthRelayPendingSession,
  OAuthRelaySessionStore,
  OAuthRelayToken
} from './oauth-relay'
import { ANILIST_SECRET_KEYS } from '../utils/ids'

export interface AnilistTokenSecretV1 {
  version: 1
  accessToken: string
  /** Epoch ms; AniList tokens live about a year and cannot be refreshed. */
  expiresAt?: number
}

interface AnilistPendingSessionSecretV1 extends OAuthRelayPendingSession {
  version: 1
}

/**
 * Persisted OAuth state: the long-lived access token and, while a browser
 * sign-in is underway, the pending relay session. Implements the SDK relay
 * flow's store seam directly.
 */
export class TokenStore implements OAuthRelaySessionStore {
  constructor(private readonly secrets: ExtensionSecrets) {}

  async getToken(): Promise<AnilistTokenSecretV1 | undefined> {
    const raw = await this.secrets.get(ANILIST_SECRET_KEYS.token)
    return normalizeTokenSecret(raw)
  }

  /** Access token that has not expired yet, or `undefined`. */
  async getValidAccessToken(): Promise<string | undefined> {
    const token = await this.getToken()
    if (!token) {
      return undefined
    }
    if (token.expiresAt !== undefined && token.expiresAt <= Date.now()) {
      return undefined
    }
    return token.accessToken
  }

  async setToken(token: OAuthRelayToken): Promise<void> {
    await this.secrets.set(ANILIST_SECRET_KEYS.token, {
      version: 1,
      accessToken: token.accessToken,
      ...(token.expiresAt !== undefined ? { expiresAt: token.expiresAt } : {})
    })
  }

  async deleteToken(): Promise<void> {
    await this.secrets.delete(ANILIST_SECRET_KEYS.token)
  }

  async getPendingSession(): Promise<OAuthRelayPendingSession | undefined> {
    const raw = await this.secrets.get(ANILIST_SECRET_KEYS.pendingSession)
    return normalizePendingSession(raw)
  }

  async setPendingSession(session: OAuthRelayPendingSession): Promise<void> {
    const record: AnilistPendingSessionSecretV1 = {
      version: 1,
      sessionId: session.sessionId,
      state: session.state,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      ...(session.authorizeUrl !== undefined ? { authorizeUrl: session.authorizeUrl } : {})
    }
    await this.secrets.set(ANILIST_SECRET_KEYS.pendingSession, record)
  }

  async deletePendingSession(): Promise<void> {
    await this.secrets.delete(ANILIST_SECRET_KEYS.pendingSession)
  }

  async clearAuthSecrets(): Promise<void> {
    await Promise.all([this.deleteToken(), this.deletePendingSession()])
  }
}

function normalizeTokenSecret(value: unknown): AnilistTokenSecretV1 | undefined {
  if (!isRecord(value) || value.version !== 1 || typeof value.accessToken !== 'string') {
    return undefined
  }

  const accessToken = value.accessToken.trim()
  if (!accessToken) {
    return undefined
  }

  const expiresAt =
    typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt)
      ? Math.trunc(value.expiresAt)
      : undefined

  return { version: 1, accessToken, ...(expiresAt !== undefined ? { expiresAt } : {}) }
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
