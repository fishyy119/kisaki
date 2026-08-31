import type { ExtensionLogger, NetworkCapability } from '@kisaki3/extension-sdk'
import { isCancellationError } from '@kisaki3/extension-sdk'

/**
 * Client and session flow for the Kisaki OAuth relay.
 *
 * The relay holds upstream client secrets for providers that mandate a
 * confidential client; extensions talk to it over the wire contract defined
 * in `docs/oauth-relay-server.md` (canonical camelCase, epoch milliseconds).
 * Extensions inject persistence and error mapping, so this module carries no
 * domain error types and never touches storage directly.
 */

export interface OAuthRelaySession {
  sessionId: string
  state: string
  authorizeUrl: string
  /** Epoch milliseconds. */
  expiresAt: number
}

export interface OAuthRelayToken {
  accessToken: string
  refreshToken?: string
  tokenType?: string
  scope?: string | null
  userId?: number
  /** Epoch milliseconds. */
  expiresAt?: number
}

export interface OAuthRelayTokenStatus {
  active: boolean
  userId?: number
  scope?: string | null
  /** Epoch milliseconds. */
  expiresAt?: number
}

export interface OAuthRelayHealth {
  ok: boolean
  status?: number
  checkedAt: number
  /** Relay-provided error text, when the relay answered with one. */
  detail?: string
}

/**
 * Failure classes the relay machinery can hit. Extensions map these onto
 * their own coded error types and localized messages through the factory.
 */
export type OAuthRelayFailure =
  | 'relay_unavailable'
  | 'session_expired'
  | 'callback_invalid'
  | 'authorize_denied'
  | 'authorize_failed'
  | 'no_pending_login'

export type OAuthRelayErrorFactory = (failure: OAuthRelayFailure, detail?: string) => Error

export interface OAuthRelayClientOptions {
  network: NetworkCapability
  /** Provider-scoped base URL, e.g. `https://oauth-relay.ximu.dev/kisaki/bangumi`. */
  getBaseUrl(): Promise<string>
  getTimeoutMs(): Promise<number>
  createError: OAuthRelayErrorFactory
}

export class OAuthRelayClient {
  constructor(private readonly options: OAuthRelayClientOptions) {}

  async createSession(
    desktopCallbackUrl: string,
    signal?: AbortSignal
  ): Promise<OAuthRelaySession> {
    const data = await this.request('/sessions', { desktopCallbackUrl }, signal)
    return this.parseSession(data)
  }

  async completeSession(
    sessionId: string,
    state: string,
    signal?: AbortSignal
  ): Promise<OAuthRelayToken> {
    const data = await this.request(
      `/sessions/${encodeURIComponent(sessionId)}/complete`,
      { state },
      signal,
      'session_expired'
    )
    return this.parseToken(data)
  }

  async refresh(refreshToken: string, signal?: AbortSignal): Promise<OAuthRelayToken> {
    const data = await this.request('/refresh', { refreshToken }, signal, 'session_expired')
    return this.parseToken(data)
  }

  async tokenStatus(accessToken: string, signal?: AbortSignal): Promise<OAuthRelayTokenStatus> {
    const data = await this.request('/token-status', { accessToken }, signal)
    if (typeof data.active !== 'boolean') {
      throw this.options.createError('relay_unavailable', 'Token status response is malformed.')
    }

    const userId = readNumber(data.userId)
    const scope = readNullableString(data.scope)
    const expiresAt = readNumber(data.expiresAt)

    return {
      active: data.active,
      ...(userId !== undefined ? { userId } : {}),
      ...(scope !== undefined ? { scope } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {})
    }
  }

  async health(signal?: AbortSignal): Promise<OAuthRelayHealth> {
    const checkedAt = Date.now()

    try {
      const response = await this.options.network.request<unknown>(
        {
          url: await this.buildUrl('/healthz'),
          method: 'GET',
          headers: { Accept: 'application/json' },
          timeoutMs: await this.readTimeoutMs(),
          responseType: 'json'
        },
        signal ? { signal } : {}
      )

      const detail = response.ok ? undefined : readRelayErrorDetail(response.data)
      return {
        ok: response.ok,
        status: response.status,
        checkedAt,
        ...(detail !== undefined ? { detail } : {})
      }
    } catch (error) {
      if (isCancellationError(error)) {
        throw error
      }
      return { ok: false, checkedAt }
    }
  }

  private async request(
    pathname: string,
    body: Record<string, string>,
    signal: AbortSignal | undefined,
    notFoundFailure: OAuthRelayFailure = 'relay_unavailable'
  ): Promise<Record<string, unknown>> {
    signal?.throwIfAborted()

    let response
    try {
      response = await this.options.network.request<unknown>(
        {
          url: await this.buildUrl(pathname),
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body,
          timeoutMs: await this.readTimeoutMs(),
          responseType: 'json'
        },
        signal ? { signal } : {}
      )
    } catch (error) {
      if (isCancellationError(error)) {
        throw error
      }
      throw this.options.createError('relay_unavailable')
    }

    if (!response.ok) {
      // Wire contract: 401 means the upstream rejected the grant (e.g. a
      // revoked refresh token) — the user must sign in again, not retry the
      // relay. 404 carries per-endpoint semantics supplied by the caller.
      const failure: OAuthRelayFailure =
        response.status === 401
          ? 'session_expired'
          : response.status === 404
            ? notFoundFailure
            : 'relay_unavailable'
      throw this.options.createError(failure, readRelayErrorDetail(response.data))
    }

    if (!isRecord(response.data)) {
      throw this.options.createError('relay_unavailable', 'Relay response is malformed.')
    }

    return response.data
  }

  private parseSession(data: Record<string, unknown>): OAuthRelaySession {
    const sessionId = readString(data.sessionId)
    const state = readString(data.state)
    const authorizeUrl = readString(data.authorizeUrl)
    const expiresAt = readNumber(data.expiresAt)

    if (!sessionId || !state || !authorizeUrl || expiresAt === undefined) {
      throw this.options.createError('relay_unavailable', 'Relay session response is malformed.')
    }

    return { sessionId, state, authorizeUrl, expiresAt }
  }

  private parseToken(data: Record<string, unknown>): OAuthRelayToken {
    const accessToken = readString(data.accessToken)
    if (!accessToken) {
      throw this.options.createError('relay_unavailable', 'Relay token response is malformed.')
    }

    const refreshToken = readString(data.refreshToken)
    const tokenType = readString(data.tokenType)
    const scope = readNullableString(data.scope)
    const userId = readNumber(data.userId)
    const expiresAt = readNumber(data.expiresAt)

    return {
      accessToken,
      ...(refreshToken !== undefined ? { refreshToken } : {}),
      ...(tokenType !== undefined ? { tokenType } : {}),
      ...(scope !== undefined ? { scope } : {}),
      ...(userId !== undefined ? { userId } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {})
    }
  }

  private async buildUrl(pathname: string): Promise<string> {
    const base = (await this.options.getBaseUrl()).replace(/\/+$/, '')
    return `${base}${pathname}`
  }

  private async readTimeoutMs(): Promise<number> {
    const timeoutMs = await this.options.getTimeoutMs()
    return Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.trunc(timeoutMs) : 30_000
  }
}

export interface OAuthRelayPendingSession {
  sessionId: string
  state: string
  authorizeUrl?: string
  /** Epoch milliseconds. */
  expiresAt: number
  createdAt: number
}

/** Persistence the flow works against; extensions back it with `context.secrets`. */
export interface OAuthRelaySessionStore {
  getPendingSession(): Promise<OAuthRelayPendingSession | undefined>
  setPendingSession(session: OAuthRelayPendingSession): Promise<void>
  deletePendingSession(): Promise<void>
  setToken(token: OAuthRelayToken): Promise<void>
}

/** Minimal structural shape of a deeplink route event carrying the callback. */
export interface OAuthRelayCallbackEvent {
  query: Record<string, string | undefined>
}

export interface OAuthRelayPendingStatus {
  pending: boolean
  sessionId?: string
  authorizeUrl?: string
  expiresAt?: number
  expired: boolean
}

export interface OAuthRelayFlowOptions {
  client: OAuthRelayClient
  store: OAuthRelaySessionStore
  /** Deeplink URL the relay redirects the browser back to. */
  callbackUrl: string
  openExternal(url: string): Promise<void>
  getLoginTimeoutMs(): Promise<number>
  createError: OAuthRelayErrorFactory
  logger?: ExtensionLogger
}

/**
 * Browser-bounce login state machine on top of the relay client.
 *
 * `startLogin` opens the authorize page and persists the pending session;
 * the deeplink handler validates `(sessionId, state)` against it and trades
 * the session for tokens exactly once.
 */
export class OAuthRelayFlow {
  constructor(private readonly options: OAuthRelayFlowOptions) {}

  async startLogin(signal?: AbortSignal): Promise<OAuthRelayPendingStatus> {
    const [session, loginTimeoutMs] = await Promise.all([
      this.options.client.createSession(this.options.callbackUrl, signal),
      this.options.getLoginTimeoutMs()
    ])
    const now = Date.now()
    const expiresAt = Math.min(session.expiresAt, now + loginTimeoutMs)

    await this.options.store.setPendingSession({
      sessionId: session.sessionId,
      state: session.state,
      authorizeUrl: session.authorizeUrl,
      expiresAt,
      createdAt: now
    })

    await this.options.openExternal(session.authorizeUrl)

    return {
      pending: true,
      sessionId: session.sessionId,
      authorizeUrl: session.authorizeUrl,
      expiresAt,
      expired: false
    }
  }

  async completeFromDeeplink(event: OAuthRelayCallbackEvent): Promise<OAuthRelayToken> {
    const callbackError = event.query.error?.trim()
    if (callbackError) {
      // The relay destroys its session before redirecting with `error`, so
      // the local pending session can neither be completed nor reopened.
      await this.options.store.deletePendingSession()
      this.options.logger?.warn('OAuth callback reported an authorize error.', {
        error: callbackError.slice(0, 64)
      })
      throw this.options.createError(
        callbackError === 'access_denied' ? 'authorize_denied' : 'authorize_failed',
        callbackError
      )
    }

    const sessionId = event.query.sessionId?.trim()
    const state = event.query.state?.trim()

    if (!sessionId || !state) {
      throw this.options.createError('callback_invalid', 'Callback is missing sessionId or state.')
    }

    return this.completeSession(sessionId, state)
  }

  async completePending(signal?: AbortSignal): Promise<OAuthRelayToken> {
    const pending = await this.requirePendingSession()
    return this.completeSession(pending.sessionId, pending.state, signal)
  }

  /**
   * Reopens the authorize page of the still-pending session, so a login that
   * broke inside the browser (for example the provider lost the flow around
   * its own sign-in page) can be retried without discarding the session.
   */
  async reopenPendingAuthorize(): Promise<void> {
    const pending = await this.requirePendingSession()

    if (pending.expiresAt <= Date.now()) {
      await this.options.store.deletePendingSession()
      throw this.options.createError('session_expired')
    }

    if (!pending.authorizeUrl) {
      throw this.options.createError('no_pending_login')
    }

    await this.options.openExternal(pending.authorizeUrl)
  }

  async cancelPending(): Promise<void> {
    await this.options.store.deletePendingSession()
  }

  async getPendingSessionStatus(): Promise<OAuthRelayPendingStatus> {
    const pending = await this.options.store.getPendingSession()
    if (!pending) {
      return { pending: false, expired: false }
    }

    return {
      pending: true,
      sessionId: pending.sessionId,
      expiresAt: pending.expiresAt,
      expired: pending.expiresAt <= Date.now(),
      ...(pending.authorizeUrl !== undefined ? { authorizeUrl: pending.authorizeUrl } : {})
    }
  }

  private async completeSession(
    sessionId: string,
    state: string,
    signal?: AbortSignal
  ): Promise<OAuthRelayToken> {
    const pending = await this.requirePendingSession()

    if (pending.expiresAt <= Date.now()) {
      await this.options.store.deletePendingSession()
      throw this.options.createError('session_expired')
    }

    if (pending.sessionId !== sessionId || pending.state !== state) {
      this.options.logger?.warn('OAuth callback state did not match the pending session.')
      throw this.options.createError('callback_invalid')
    }

    const token = await this.options.client.completeSession(sessionId, state, signal)
    await this.options.store.setToken(token)
    await this.options.store.deletePendingSession()
    return token
  }

  private async requirePendingSession(): Promise<OAuthRelayPendingSession> {
    const pending = await this.options.store.getPendingSession()
    if (!pending) {
      throw this.options.createError('no_pending_login')
    }
    return pending
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function readNullableString(value: unknown): string | null | undefined {
  return value === null ? null : readString(value)
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readRelayErrorDetail(data: unknown): string | undefined {
  if (typeof data === 'string') {
    return data.trim() || undefined
  }
  if (!isRecord(data)) {
    return undefined
  }
  const value = data.error
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
