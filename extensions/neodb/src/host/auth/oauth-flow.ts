import { randomBytes } from 'node:crypto'
import type { ExtensionLogger, NetworkCapability } from '@kisaki3/extension-sdk'
import type { NdAppRegistration, NdTokenResponse } from '../api/types'
import type { NeodbSettingsStore } from '../config/schema'
import { m } from '../i18n'
import {
  NEODB_CLIENT_NAME,
  NEODB_CLIENT_WEBSITE,
  NEODB_LOGIN_TIMEOUT_MS,
  NEODB_OAUTH_SCOPE,
  NEODB_OOB_REDIRECT_URI
} from '../utils/constants'
import { NeodbExtensionError, toSafeErrorLog } from '../utils/errors'
import type { SessionStore } from './session-store'

const AUTH_REQUEST_TIMEOUT_MS = 30_000

/** Minimal structural shape of a deeplink route event carrying the callback. */
export interface NeodbOauthCallbackEvent {
  query: Record<string, string | undefined>
}

export interface NeodbPendingLoginStatus {
  pending: boolean
  manual: boolean
  expired: boolean
  expiresAt?: number
}

/**
 * Mastodon-style sign-in for any NeoDB instance.
 *
 * Every login first registers this app on the instance (`/api/v1/apps`), so
 * no shared client secret exists anywhere; the per-user credentials live in
 * the local secret store. The browser normally bounces back through the
 * deeplink; the out-of-band variant covers instances where it cannot, with
 * the user pasting the displayed code. Access tokens do not expire.
 */
export class NeodbOauthFlow {
  constructor(
    private readonly deps: {
      network: NetworkCapability
      store: SessionStore
      settingsStore: NeodbSettingsStore
      /** Deeplink URL the browser redirects back to. */
      callbackUrl: string
      openExternal(url: string): Promise<void>
      logger: ExtensionLogger
    }
  ) {}

  async startLogin(options: { manual: boolean }, signal?: AbortSignal): Promise<void> {
    const settings = await this.deps.settingsStore.get()
    const instanceUrl = settings.endpoints.instanceUrl
    const redirectUri = options.manual ? NEODB_OOB_REDIRECT_URI : this.deps.callbackUrl

    const registration = await this.registerApp(instanceUrl, signal)
    const state = randomBytes(24).toString('base64url')
    const now = Date.now()

    await this.deps.store.setPendingLogin({
      version: 1,
      instanceUrl,
      clientId: registration.clientId,
      clientSecret: registration.clientSecret,
      state,
      redirectUri,
      manual: options.manual,
      createdAt: now,
      expiresAt: now + NEODB_LOGIN_TIMEOUT_MS
    })

    const authorizeUrl = new URL(`${instanceUrl}/oauth/authorize`)
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('client_id', registration.clientId)
    authorizeUrl.searchParams.set('redirect_uri', redirectUri)
    authorizeUrl.searchParams.set('scope', NEODB_OAUTH_SCOPE)
    // The out-of-band page shows the code; state has no way back.
    if (!options.manual) {
      authorizeUrl.searchParams.set('state', state)
    }

    await this.deps.openExternal(authorizeUrl.toString())
  }

  async completeFromDeeplink(event: NeodbOauthCallbackEvent, signal?: AbortSignal): Promise<void> {
    const code = event.query.code?.trim()
    const state = event.query.state?.trim()
    if (!code || !state) {
      throw new NeodbExtensionError('auth_cancelled', m().errors.loginStateMismatch)
    }

    const pending = await this.requirePendingLogin()
    if (pending.manual) {
      throw new NeodbExtensionError('auth_cancelled', m().errors.loginStateMismatch)
    }
    if (pending.state !== state) {
      this.deps.logger.warn('NeoDB OAuth callback state did not match the pending login.')
      throw new NeodbExtensionError('auth_cancelled', m().errors.loginStateMismatch)
    }

    await this.exchangeAndStore(pending, code, signal)
  }

  /** Completes an out-of-band sign-in with the code the user pasted. */
  async completeWithCode(code: string, signal?: AbortSignal): Promise<void> {
    const trimmed = code.trim()
    if (!trimmed) {
      throw new NeodbExtensionError('auth_cancelled', m().errors.codeEmpty)
    }

    const pending = await this.requirePendingLogin()
    await this.exchangeAndStore(pending, trimmed, signal)
  }

  async cancelPending(): Promise<void> {
    await this.deps.store.deletePendingLogin()
  }

  async getPendingStatus(): Promise<NeodbPendingLoginStatus> {
    const pending = await this.deps.store.getPendingLogin()
    if (!pending) {
      return { pending: false, manual: false, expired: false }
    }

    return {
      pending: true,
      manual: pending.manual,
      expired: pending.expiresAt <= Date.now(),
      expiresAt: pending.expiresAt
    }
  }

  private async exchangeAndStore(
    pending: Awaited<ReturnType<SessionStore['getPendingLogin']>> & object,
    code: string,
    signal?: AbortSignal
  ): Promise<void> {
    if (pending.expiresAt <= Date.now()) {
      await this.deps.store.deletePendingLogin()
      throw new NeodbExtensionError('auth_cancelled', m().errors.loginSessionExpired)
    }

    const response = await this.deps.network.request<NdTokenResponse>(
      {
        url: `${pending.instanceUrl}/oauth/token`,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: pending.clientId,
          client_secret: pending.clientSecret,
          redirect_uri: pending.redirectUri
        }).toString(),
        timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
        responseType: 'json'
      },
      signal ? { signal } : {}
    )

    if (!response.ok || !response.data.access_token?.trim()) {
      this.deps.logger.warn('NeoDB token exchange failed.', { status: response.status })
      throw new NeodbExtensionError('auth_rejected', m().errors.tokenRejected)
    }

    await this.deps.store.setSession({
      version: 1,
      instanceUrl: pending.instanceUrl,
      clientId: pending.clientId,
      clientSecret: pending.clientSecret,
      accessToken: response.data.access_token.trim()
    })
    await this.deps.store.deletePendingLogin()
  }

  /** Mastodon-compatible dynamic client registration on the instance. */
  private async registerApp(
    instanceUrl: string,
    signal?: AbortSignal
  ): Promise<{ clientId: string; clientSecret: string }> {
    let response
    try {
      response = await this.deps.network.request<NdAppRegistration>(
        {
          url: `${instanceUrl}/api/v1/apps`,
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            client_name: NEODB_CLIENT_NAME,
            redirect_uris: `${this.deps.callbackUrl}\n${NEODB_OOB_REDIRECT_URI}`,
            website: NEODB_CLIENT_WEBSITE
          }),
          timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
          responseType: 'json'
        },
        signal ? { signal } : {}
      )
    } catch (error) {
      this.deps.logger.warn('NeoDB app registration failed.', toSafeErrorLog(error))
      throw new NeodbExtensionError('registration_failed', m().errors.registrationFailed, {
        cause: error
      })
    }

    const clientId = response.ok ? response.data.client_id?.trim() : undefined
    const clientSecret = response.ok ? response.data.client_secret?.trim() : undefined
    if (!clientId || !clientSecret) {
      this.deps.logger.warn('NeoDB app registration was rejected.', { status: response.status })
      throw new NeodbExtensionError('registration_failed', m().errors.registrationFailed)
    }

    return { clientId, clientSecret }
  }

  private async requirePendingLogin() {
    const pending = await this.deps.store.getPendingLogin()
    if (!pending) {
      throw new NeodbExtensionError('auth_cancelled', m().errors.noPendingLogin)
    }
    return pending
  }
}
