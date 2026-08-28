import type { ExtensionLogger, NetworkCapability } from '@kisaki3/extension-sdk'
import { m } from '../i18n'
import {
  MAL_OAUTH_CLIENT_ID,
  MAL_OAUTH_TOKEN_URL,
  MAL_TOKEN_REFRESH_LEEWAY_MS
} from '../utils/constants'
import { MalExtensionError, toSafeErrorLog } from '../utils/errors'
import type { MalTokenResponse } from '../api/types'
import type { MalTokenSecretV1, TokenStore } from './token-store'

const TOKEN_REQUEST_TIMEOUT_MS = 30_000

/**
 * Owns the MAL token lifecycle: code and refresh exchanges against the token
 * endpoint, and transparent refresh before the access token expires.
 *
 * MAL is a public client here, so exchanges carry only the public client id
 * and PKCE material — no secret ever exists on this machine. Refreshes are
 * single-flight; MAL rotates the refresh token on every use.
 */
export class TokenManager {
  private refreshing: Promise<MalTokenSecretV1 | undefined> | undefined

  constructor(
    private readonly network: NetworkCapability,
    private readonly store: TokenStore,
    private readonly logger: ExtensionLogger
  ) {}

  /** Valid access token, refreshing first when it is about to expire. */
  async getFreshAccessToken(signal?: AbortSignal): Promise<string | undefined> {
    const token = await this.store.getToken()
    if (!token) {
      return undefined
    }

    if (token.expiresAt - MAL_TOKEN_REFRESH_LEEWAY_MS > Date.now()) {
      return token.accessToken
    }

    const refreshed = await this.refreshSingleFlight(token, signal)
    return refreshed?.accessToken
  }

  async exchangeCode(input: {
    code: string
    codeVerifier: string
    redirectUri: string
    signal?: AbortSignal
  }): Promise<MalTokenSecretV1> {
    const token = await this.requestToken(
      {
        client_id: MAL_OAUTH_CLIENT_ID,
        grant_type: 'authorization_code',
        code: input.code,
        code_verifier: input.codeVerifier,
        redirect_uri: input.redirectUri
      },
      input.signal
    )

    await this.store.setToken(token)
    return token
  }

  private async refreshSingleFlight(
    current: MalTokenSecretV1,
    signal?: AbortSignal
  ): Promise<MalTokenSecretV1 | undefined> {
    this.refreshing ??= this.refresh(current, signal).finally(() => {
      this.refreshing = undefined
    })
    return this.refreshing
  }

  private async refresh(
    current: MalTokenSecretV1,
    signal?: AbortSignal
  ): Promise<MalTokenSecretV1 | undefined> {
    try {
      const token = await this.requestToken(
        {
          client_id: MAL_OAUTH_CLIENT_ID,
          grant_type: 'refresh_token',
          refresh_token: current.refreshToken
        },
        signal
      )
      await this.store.setToken(token)
      return token
    } catch (error) {
      this.logger.warn('MAL token refresh failed.', toSafeErrorLog(error))
      throw new MalExtensionError('auth_expired', m().errors.tokenExpired, { cause: error })
    }
  }

  private async requestToken(
    form: Record<string, string>,
    signal?: AbortSignal
  ): Promise<MalTokenSecretV1> {
    const response = await this.network.request<MalTokenResponse>(
      {
        url: MAL_OAUTH_TOKEN_URL,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(form).toString(),
        timeoutMs: TOKEN_REQUEST_TIMEOUT_MS,
        responseType: 'json'
      },
      signal ? { signal } : {}
    )

    if (!response.ok) {
      this.logger.warn('MAL token endpoint rejected the request.', { status: response.status })
      throw new MalExtensionError(
        response.status === 400 || response.status === 401 ? 'auth_expired' : 'network_failed',
        response.status === 400 || response.status === 401
          ? m().errors.tokenExpired
          : m().errors.networkFailed
      )
    }

    const payload = response.data
    const accessToken = payload.access_token?.trim()
    const refreshToken = payload.refresh_token?.trim()
    const expiresIn = payload.expires_in

    if (!accessToken || !refreshToken || typeof expiresIn !== 'number' || expiresIn <= 0) {
      throw new MalExtensionError('mal_rejected', m().errors.rejected)
    }

    return {
      version: 1,
      accessToken,
      refreshToken,
      expiresAt: Date.now() + Math.trunc(expiresIn * 1000)
    }
  }
}
