import type { ExtensionLogger } from '@kisaki3/extension-sdk'
import { m } from '../i18n'
import {
  MAL_LOGIN_TIMEOUT_MS,
  MAL_OAUTH_AUTHORIZE_URL,
  MAL_OAUTH_CLIENT_ID
} from '../utils/constants'
import { MalExtensionError } from '../utils/errors'
import { buildAuthorizeUrl, createPkceLogin } from './pkce'
import type { TokenManager } from './token-manager'
import type { TokenStore } from './token-store'

/** Minimal structural shape of a deeplink route event carrying the callback. */
export interface MalOauthCallbackEvent {
  query: Record<string, string | undefined>
}

export interface MalPendingLoginStatus {
  pending: boolean
  expired: boolean
  expiresAt?: number
}

/**
 * Direct PKCE sign-in against MAL (RFC 8252 native-app flow).
 *
 * `startLogin` opens the authorize page in the system browser and persists
 * the PKCE material; the deeplink handler validates `state` and trades the
 * code for tokens straight at MAL — no intermediary is involved. A missed
 * callback has nothing to resume: the user simply starts the login again.
 */
export class MalOauthFlow {
  constructor(
    private readonly deps: {
      tokens: TokenManager
      store: TokenStore
      /** Deeplink URL the browser redirects back to; registered with MAL. */
      callbackUrl: string
      openExternal(url: string): Promise<void>
      logger: ExtensionLogger
    }
  ) {}

  async startLogin(): Promise<void> {
    const login = createPkceLogin()
    const now = Date.now()

    await this.deps.store.setPendingLogin({
      version: 1,
      state: login.state,
      codeVerifier: login.codeVerifier,
      createdAt: now,
      expiresAt: now + MAL_LOGIN_TIMEOUT_MS
    })

    const authorizeUrl = buildAuthorizeUrl({
      authorizeUrl: MAL_OAUTH_AUTHORIZE_URL,
      clientId: MAL_OAUTH_CLIENT_ID,
      redirectUri: this.deps.callbackUrl,
      state: login.state,
      codeVerifier: login.codeVerifier
    })

    await this.deps.openExternal(authorizeUrl)
  }

  async completeFromDeeplink(event: MalOauthCallbackEvent, signal?: AbortSignal): Promise<void> {
    const code = event.query.code?.trim()
    const state = event.query.state?.trim()
    if (!code || !state) {
      throw new MalExtensionError('auth_cancelled', m().errors.loginStateMismatch)
    }

    const pending = await this.deps.store.getPendingLogin()
    if (!pending) {
      throw new MalExtensionError('auth_cancelled', m().errors.noPendingLogin)
    }

    if (pending.expiresAt <= Date.now()) {
      await this.deps.store.deletePendingLogin()
      throw new MalExtensionError('auth_expired', m().errors.loginSessionExpired)
    }

    if (pending.state !== state) {
      this.deps.logger.warn('MAL OAuth callback state did not match the pending login.')
      throw new MalExtensionError('auth_cancelled', m().errors.loginStateMismatch)
    }

    await this.deps.tokens.exchangeCode({
      code,
      codeVerifier: pending.codeVerifier,
      redirectUri: this.deps.callbackUrl,
      ...(signal ? { signal } : {})
    })
    await this.deps.store.deletePendingLogin()
  }

  async cancelPending(): Promise<void> {
    await this.deps.store.deletePendingLogin()
  }

  async getPendingStatus(): Promise<MalPendingLoginStatus> {
    const pending = await this.deps.store.getPendingLogin()
    if (!pending) {
      return { pending: false, expired: false }
    }

    return {
      pending: true,
      expired: pending.expiresAt <= Date.now(),
      expiresAt: pending.expiresAt
    }
  }
}
