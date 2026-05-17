import type { NetworkCapability, SerializableRecord } from '@kisaki/extension-sdk'
import { BANGUMI_OAUTH_RELAY_BASE_URL } from '../shared/constants'
import { BangumiExtensionError } from '../shared/errors'

export interface OAuthRelaySession {
  sessionId: string
  state: string
  authorizeUrl: string
  expiresAt: number
}

export interface OAuthRelayToken {
  accessToken: string
  refreshToken?: string
  tokenType?: string
  scope?: string | null
  userId?: number
  expiresAt?: number | null
}

export interface OAuthRelayTokenStatus {
  active: boolean
  userId?: number
  scope?: string | null
  expiresAt?: number | null
}

export interface OAuthRelayHealth {
  ok: boolean
  status?: number
  checkedAt: number
  message?: string
}

type RelayMethod = 'GET' | 'POST'
const ACCESS_TOKEN_KEYS = ['accessToken', 'access_token'] as const
const TOKEN_CONTAINER_KEYS = [
  'token',
  'tokens',
  'credential',
  'credentials',
  'auth',
  'data',
  'result',
  'session'
] as const
const TOKEN_STATUS_CONTAINER_KEYS = ['status', 'token', 'data', 'result'] as const

export class OAuthRelayClient {
  constructor(
    private readonly network: NetworkCapability,
    private readonly getTimeoutMs: () => Promise<number>,
    private readonly baseUrl = BANGUMI_OAUTH_RELAY_BASE_URL
  ) {}

  async createSession(desktopCallbackUrl: string, signal?: AbortSignal): Promise<OAuthRelaySession> {
    const data = await this.request<unknown>('POST', '/sessions', {
      desktopCallbackUrl
    }, signal)

    return normalizeSession(data)
  }

  async completeSession(
    sessionId: string,
    state: string,
    signal?: AbortSignal
  ): Promise<OAuthRelayToken> {
    const data = await this.request<unknown>(
      'POST',
      `/sessions/${encodeURIComponent(sessionId)}/complete`,
      { state },
      signal
    )

    return normalizeToken(data)
  }

  async refresh(refreshToken: string, signal?: AbortSignal): Promise<OAuthRelayToken> {
    const data = await this.request<unknown>('POST', '/refresh', { refreshToken }, signal)
    return normalizeToken(data)
  }

  async tokenStatus(accessToken: string, signal?: AbortSignal): Promise<OAuthRelayTokenStatus> {
    const data = await this.request<unknown>('POST', '/token-status', { accessToken }, signal)
    return normalizeTokenStatus(data)
  }

  async health(signal?: AbortSignal): Promise<OAuthRelayHealth> {
    const checkedAt = Date.now()

    try {
      const response = await this.network.request<unknown>({
        url: this.buildUrl('/healthz'),
        method: 'GET',
        headers: this.buildHeaders(),
        timeoutMs: await this.readTimeoutMs(),
        responseType: 'json'
      })

      return {
        ok: response.ok,
        status: response.status,
        checkedAt,
        message: response.ok ? 'OAuth Relay 可用。' : readRelayErrorMessage(response.data)
      }
    } catch {
      if (signal?.aborted) {
        throw createAbortError()
      }

      return {
        ok: false,
        checkedAt,
        message: '无法连接 Kisaki OAuth Relay。'
      }
    }
  }

  private async request<T>(
    method: RelayMethod,
    pathname: string,
    body?: SerializableRecord,
    signal?: AbortSignal
  ): Promise<T> {
    throwIfAborted(signal)

    try {
      const response = await this.network.request<T>({
        url: this.buildUrl(pathname),
        method,
        headers: this.buildHeaders(),
        body,
        timeoutMs: await this.readTimeoutMs(),
        responseType: 'json'
      })

      if (!response.ok) {
        throw new BangumiExtensionError(
          response.status === 404 ? 'auth_expired' : 'relay_unavailable',
          readRelayErrorMessage(response.data) || 'Kisaki OAuth Relay 暂时不可用，请稍后重试。'
        )
      }

      return response.data
    } catch (error) {
      if (signal?.aborted || isAbortLikeError(error)) {
        throw createAbortError()
      }

      if (error instanceof BangumiExtensionError) {
        throw error
      }

      throw new BangumiExtensionError('relay_unavailable', '无法连接 Kisaki OAuth Relay。')
    }
  }

  private buildUrl(pathname: string): string {
    const base = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`
    return new URL(pathname.replace(/^\/+/, ''), base).toString()
  }

  private buildHeaders(): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  }

  private async readTimeoutMs(): Promise<number> {
    const timeoutMs = await this.getTimeoutMs()
    return Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.trunc(timeoutMs) : 30_000
  }
}

function normalizeSession(value: unknown): OAuthRelaySession {
  const record = requireRecord(value, 'OAuth Relay session response is invalid.')
  const sessionId = readRequiredString(record, ['sessionId', 'session_id'])
  const state = readRequiredString(record, ['state'])
  const authorizeUrl = readRequiredString(record, ['authorizeUrl', 'authorize_url'])
  const expiresAt = readEpochMs(record, ['expiresAt', 'expires_at', 'expires'])

  if (!sessionId || !state || !authorizeUrl || expiresAt === undefined) {
    throw new BangumiExtensionError('relay_unavailable', 'OAuth Relay 返回了无法识别的登录会话。')
  }

  return {
    sessionId,
    state,
    authorizeUrl,
    expiresAt
  }
}

function normalizeToken(value: unknown): OAuthRelayToken {
  const record = findRecordWithString(value, ACCESS_TOKEN_KEYS, TOKEN_CONTAINER_KEYS)
    ?? requireRecord(value, 'OAuth Relay token response is invalid.')
  const accessToken = readRequiredString(record, ACCESS_TOKEN_KEYS)

  if (!accessToken) {
    throw new BangumiExtensionError('relay_unavailable', 'OAuth Relay 没有返回访问凭据。')
  }

  const refreshToken = readOptionalString(record, ['refreshToken', 'refresh_token'])
  const tokenType = readOptionalString(record, ['tokenType', 'token_type'])
  const scope = readOptionalNullableString(record, ['scope'])
  const userId = readOptionalInteger(record, ['userId', 'user_id'])
  const expiresAt =
    readEpochMs(record, ['expiresAt', 'expires_at', 'expires']) ??
    readExpiresInMs(record, ['expiresIn', 'expires_in'])

  return {
    accessToken,
    ...(refreshToken ? { refreshToken } : {}),
    ...(tokenType ? { tokenType } : {}),
    ...(scope !== undefined ? { scope } : {}),
    ...(userId !== undefined ? { userId } : {}),
    ...(expiresAt !== undefined ? { expiresAt } : {})
  }
}

function normalizeTokenStatus(value: unknown): OAuthRelayTokenStatus {
  const record =
    findRecordWithAnyKey(
      value,
      ['active', 'valid', 'expires', 'expiresAt', 'expires_at'],
      TOKEN_STATUS_CONTAINER_KEYS
    ) ?? requireRecord(value, 'OAuth Relay token status response is invalid.')
  const activeValue = readFirst(record, ['active', 'valid'])
  const active =
    typeof activeValue === 'boolean'
      ? activeValue
      : readOptionalInteger(record, ['expires', 'expiresIn', 'expires_in']) !== 0
  const userId = readOptionalInteger(record, ['userId', 'user_id'])
  const scope = readOptionalNullableString(record, ['scope'])
  const expiresAt =
    readEpochMs(record, ['expiresAt', 'expires_at']) ?? readExpiresInMs(record, ['expires'])

  return {
    active,
    ...(userId !== undefined ? { userId } : {}),
    ...(scope !== undefined ? { scope } : {}),
    ...(expiresAt !== undefined ? { expiresAt } : {})
  }
}

function requireRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BangumiExtensionError('relay_unavailable', message)
  }
  return value as Record<string, unknown>
}

function findRecordWithString(
  value: unknown,
  keys: readonly string[],
  containerKeys: readonly string[],
  depth = 0
): Record<string, unknown> | undefined {
  const record = asRecord(value)
  if (!record || depth > 4) {
    return undefined
  }

  if (readOptionalString(record, keys)) {
    return record
  }

  for (const key of containerKeys) {
    const found = findRecordWithString(record[key], keys, containerKeys, depth + 1)
    if (found) {
      return found
    }
  }

  return undefined
}

function findRecordWithAnyKey(
  value: unknown,
  keys: readonly string[],
  containerKeys: readonly string[],
  depth = 0
): Record<string, unknown> | undefined {
  const record = asRecord(value)
  if (!record || depth > 4) {
    return undefined
  }

  if (keys.some((key) => key in record)) {
    return record
  }

  for (const key of containerKeys) {
    const found = findRecordWithAnyKey(record[key], keys, containerKeys, depth + 1)
    if (found) {
      return found
    }
  }

  return undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function readRequiredString(record: Record<string, unknown>, keys: readonly string[]): string {
  return readOptionalString(record, keys) ?? ''
}

function readOptionalString(
  record: Record<string, unknown>,
  keys: readonly string[]
): string | undefined {
  const value = readFirst(record, keys)
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readOptionalNullableString(
  record: Record<string, unknown>,
  keys: readonly string[]
): string | null | undefined {
  const value = readFirst(record, keys)
  if (value === null) {
    return null
  }
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readOptionalInteger(
  record: Record<string, unknown>,
  keys: readonly string[]
): number | undefined {
  const value = readFirst(record, keys)
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : undefined
}

function readEpochMs(record: Record<string, unknown>, keys: readonly string[]): number | undefined {
  const value = readFirst(record, keys)
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value < 10_000_000_000 ? Math.trunc(value * 1000) : Math.trunc(value)
  }

  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value)
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric < 10_000_000_000 ? Math.trunc(numeric * 1000) : Math.trunc(numeric)
    }

    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

function readExpiresInMs(
  record: Record<string, unknown>,
  keys: readonly string[]
): number | undefined {
  const value = readFirst(record, keys)
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined
  }
  return Date.now() + Math.trunc(value * 1000)
}

function readFirst(record: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (key in record) {
      return record[key]
    }
  }
  return undefined
}

function readRelayErrorMessage(data: unknown): string | undefined {
  if (typeof data === 'string') {
    return data.trim() || undefined
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return undefined
  }

  const record = data as Record<string, unknown>
  for (const key of ['message', 'error_description', 'error']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return undefined
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError()
  }
}

function isAbortLikeError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function createAbortError(): Error {
  const error = new Error('Operation was cancelled.')
  error.name = 'AbortError'
  return error
}
