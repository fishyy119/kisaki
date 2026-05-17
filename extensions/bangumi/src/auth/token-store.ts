import type { ExtensionSecrets } from '@kisaki/extension-sdk'
import { BANGUMI_SECRET_KEYS } from '../shared/ids'

export interface BangumiTokenSecretV1 {
  version: 1
  accessToken: string
  refreshToken?: string
  tokenType?: string
  scope?: string | null
  userId?: number
  expiresAt?: number | null
}

export interface BangumiPendingSessionSecretV1 {
  version: 1
  sessionId: string
  state: string
  authorizeUrl?: string
  expiresAt: number
  createdAt: number
}

export class TokenStore {
  constructor(private readonly secrets: ExtensionSecrets) {}

  async getToken(): Promise<BangumiTokenSecretV1 | undefined> {
    const raw = await this.secrets.get(BANGUMI_SECRET_KEYS.token)
    return normalizeTokenSecret(raw)
  }

  async setToken(token: Omit<BangumiTokenSecretV1, 'version'>): Promise<void> {
    await this.secrets.set(BANGUMI_SECRET_KEYS.token, {
      version: 1,
      ...token
    })
  }

  async getAccessToken(): Promise<string | undefined> {
    return (await this.getToken())?.accessToken
  }

  async hasToken(): Promise<boolean> {
    return !!(await this.getToken())
  }

  async deleteToken(): Promise<void> {
    await this.secrets.delete(BANGUMI_SECRET_KEYS.token)
  }

  async getPendingSession(): Promise<BangumiPendingSessionSecretV1 | undefined> {
    const raw = await this.secrets.get(BANGUMI_SECRET_KEYS.pendingSession)
    return normalizePendingSessionSecret(raw)
  }

  async setPendingSession(
    session: Omit<BangumiPendingSessionSecretV1, 'version'>
  ): Promise<void> {
    await this.secrets.set(BANGUMI_SECRET_KEYS.pendingSession, {
      version: 1,
      ...session
    })
  }

  async deletePendingSession(): Promise<void> {
    await this.secrets.delete(BANGUMI_SECRET_KEYS.pendingSession)
  }

  async clearAuthSecrets(): Promise<void> {
    await Promise.all([this.deleteToken(), this.deletePendingSession()])
  }
}

function normalizeTokenSecret(value: unknown): BangumiTokenSecretV1 | undefined {
  if (!isRecord(value) || value.version !== 1 || !normalizeRequiredString(value.accessToken)) {
    return undefined
  }

  return {
    version: 1,
    accessToken: normalizeRequiredString(value.accessToken),
    ...optionalStringProperty('refreshToken', value.refreshToken),
    ...optionalStringProperty('tokenType', value.tokenType),
    ...optionalNullableStringProperty('scope', value.scope),
    ...optionalNumberProperty('userId', value.userId, true),
    ...optionalNullableNumberProperty('expiresAt', value.expiresAt)
  }
}

function normalizePendingSessionSecret(
  value: unknown
): BangumiPendingSessionSecretV1 | undefined {
  if (!isRecord(value) || value.version !== 1) {
    return undefined
  }

  const sessionId = normalizeRequiredString(value.sessionId)
  const state = normalizeRequiredString(value.state)
  const expiresAt = normalizeRequiredNumber(value.expiresAt)
  const createdAt = normalizeRequiredNumber(value.createdAt)

  if (!sessionId || !state || expiresAt === undefined || createdAt === undefined) {
    return undefined
  }

  return {
    version: 1,
    sessionId,
    state,
    expiresAt,
    createdAt,
    ...optionalStringProperty('authorizeUrl', value.authorizeUrl)
  }
}

function optionalStringProperty<TKey extends string>(
  key: TKey,
  value: unknown
): Partial<Record<TKey, string>> {
  const normalized = typeof value === 'string' && value.trim() ? value.trim() : undefined
  return normalized ? ({ [key]: normalized } as Partial<Record<TKey, string>>) : {}
}

function optionalNullableStringProperty<TKey extends string>(
  key: TKey,
  value: unknown
): Partial<Record<TKey, string | null>> {
  if (value === null) {
    return { [key]: null } as Partial<Record<TKey, string | null>>
  }

  return optionalStringProperty(key, value)
}

function optionalNumberProperty<TKey extends string>(
  key: TKey,
  value: unknown,
  integer = false
): Partial<Record<TKey, number>> {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return {}
  }

  return { [key]: integer ? Math.trunc(value) : value } as Partial<Record<TKey, number>>
}

function optionalNullableNumberProperty<TKey extends string>(
  key: TKey,
  value: unknown
): Partial<Record<TKey, number | null>> {
  if (value === null) {
    return { [key]: null } as Partial<Record<TKey, number | null>>
  }

  return optionalNumberProperty(key, value)
}

function normalizeRequiredString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeRequiredNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
