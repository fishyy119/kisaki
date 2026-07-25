import type { DeeplinkRouteHandleEvent, ExtensionLogger } from '@kisaki3/extension-sdk'
import { BangumiExtensionError } from '../utils/errors'
import { m } from '../i18n'
import { omitUndefined } from '../utils/object'
import type { OAuthRelayClient, OAuthRelayToken } from './relay-client'
import type { BangumiPendingSessionSecretV1 } from './token-store'
import { TokenStore } from './token-store'

export interface OAuthFlowOptions {
  callbackUrl: string
  relayClient: OAuthRelayClient
  tokenStore: TokenStore
  openExternal(url: string): Promise<void>
  getLoginTimeoutMs(): Promise<number>
  logger?: ExtensionLogger
}

export interface PendingSessionStatus {
  pending: boolean
  sessionId?: string
  authorizeUrl?: string
  expiresAt?: number
  expired: boolean
}

export class OAuthFlow {
  constructor(private readonly options: OAuthFlowOptions) {}

  async startLogin(signal?: AbortSignal): Promise<PendingSessionStatus> {
    const [session, loginTimeoutMs] = await Promise.all([
      this.options.relayClient.createSession(this.options.callbackUrl, signal),
      this.options.getLoginTimeoutMs()
    ])
    const now = Date.now()
    const expiresAt = Math.min(session.expiresAt, now + loginTimeoutMs)

    await this.options.tokenStore.setPendingSession({
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

  async completeFromDeeplink<TPattern extends string>(
    event: DeeplinkRouteHandleEvent<TPattern>
  ): Promise<OAuthRelayToken> {
    const sessionId = event.query.sessionId?.trim()
    const state = event.query.state?.trim()

    if (!sessionId || !state) {
      throw new BangumiExtensionError('auth_cancelled', m().errors.loginCallbackMissingParams)
    }

    return this.completeSession(sessionId, state)
  }

  async completePending(signal?: AbortSignal): Promise<OAuthRelayToken> {
    const pending = await this.requirePendingSession()
    return this.completeSession(pending.sessionId, pending.state, signal)
  }

  async cancelPending(): Promise<void> {
    await this.options.tokenStore.deletePendingSession()
  }

  async getPendingSessionStatus(): Promise<PendingSessionStatus> {
    const pending = await this.options.tokenStore.getPendingSession()
    if (!pending) {
      return { pending: false, expired: false }
    }

    return omitUndefined({
      pending: true,
      sessionId: pending.sessionId,
      authorizeUrl: pending.authorizeUrl,
      expiresAt: pending.expiresAt,
      expired: pending.expiresAt <= Date.now()
    })
  }

  private async completeSession(
    sessionId: string,
    state: string,
    signal?: AbortSignal
  ): Promise<OAuthRelayToken> {
    const pending = await this.requirePendingSession()

    if (pending.expiresAt <= Date.now()) {
      await this.options.tokenStore.deletePendingSession()
      throw new BangumiExtensionError('auth_expired', m().errors.loginSessionExpired)
    }

    if (pending.sessionId !== sessionId || pending.state !== state) {
      this.options.logger?.warn('Bangumi OAuth callback state did not match pending session.')
      throw new BangumiExtensionError('auth_cancelled', m().errors.loginCallbackInvalid)
    }

    const token = await this.options.relayClient.completeSession(sessionId, state, signal)
    await this.options.tokenStore.setToken(token)
    await this.options.tokenStore.deletePendingSession()
    return token
  }

  private async requirePendingSession(): Promise<BangumiPendingSessionSecretV1> {
    const pending = await this.options.tokenStore.getPendingSession()
    if (!pending) {
      throw new BangumiExtensionError('auth_cancelled', m().errors.noPendingLogin)
    }
    return pending
  }
}
