import type { ExtensionLogger, NetworkCapability } from '@kisaki3/extension-sdk'
import type { MdTokenResponse } from '../api/types'
import { m } from '../i18n'
import { MANGADEX_AUTH_TOKEN_URL, MANGADEX_TOKEN_REFRESH_LEEWAY_MS } from '../utils/constants'
import { MangadexExtensionError, toSafeErrorLog } from '../utils/errors'
import type {
  CredentialsStore,
  MangadexCredentialsV1,
  MangadexTokenSecretV1
} from './credentials-store'

const TOKEN_REQUEST_TIMEOUT_MS = 30_000

/**
 * Owns the MangaDex token lifecycle over the password grant.
 *
 * Access tokens live 15 minutes; refresh tokens 90 days. Refresh is
 * single-flight; when the refresh token itself has gone stale the stored
 * credentials sign in again, so the account keeps working without any user
 * interaction until the credentials are revoked.
 */
export class TokenManager {
  private acquiring: Promise<string> | undefined

  constructor(
    private readonly network: NetworkCapability,
    private readonly store: CredentialsStore,
    private readonly logger: ExtensionLogger
  ) {}

  async hasCredentials(): Promise<boolean> {
    return (await this.store.getCredentials()) !== undefined
  }

  /** Valid access token, refreshing or re-signing-in first when needed. */
  async getFreshAccessToken(signal?: AbortSignal): Promise<string> {
    const token = await this.store.getToken()
    if (token && token.expiresAt - MANGADEX_TOKEN_REFRESH_LEEWAY_MS > Date.now()) {
      return token.accessToken
    }

    this.acquiring ??= this.acquire(token, signal).finally(() => {
      this.acquiring = undefined
    })
    return this.acquiring
  }

  /** Signs in with explicit credentials and stores both on success. */
  async signIn(credentials: MangadexCredentialsV1, signal?: AbortSignal): Promise<void> {
    const token = await this.requestToken(
      credentials,
      {
        grant_type: 'password',
        username: credentials.username,
        password: credentials.password
      },
      signal
    )
    await this.store.setCredentials(credentials)
    await this.store.setToken(token)
  }

  private async acquire(
    current: MangadexTokenSecretV1 | undefined,
    signal?: AbortSignal
  ): Promise<string> {
    const credentials = await this.store.getCredentials()
    if (!credentials) {
      throw new MangadexExtensionError('auth_required', m().errors.authRequired)
    }

    if (current) {
      try {
        const refreshed = await this.requestToken(
          credentials,
          { grant_type: 'refresh_token', refresh_token: current.refreshToken },
          signal
        )
        await this.store.setToken(refreshed)
        return refreshed.accessToken
      } catch (error) {
        this.logger.debug('MangaDex token refresh failed; signing in again.', toSafeErrorLog(error))
      }
    }

    const token = await this.requestToken(
      credentials,
      {
        grant_type: 'password',
        username: credentials.username,
        password: credentials.password
      },
      signal
    )
    await this.store.setToken(token)
    return token.accessToken
  }

  private async requestToken(
    credentials: MangadexCredentialsV1,
    grant: Record<string, string>,
    signal?: AbortSignal
  ): Promise<MangadexTokenSecretV1> {
    const response = await this.network.request<MdTokenResponse>(
      {
        url: MANGADEX_AUTH_TOKEN_URL,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          ...grant,
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret
        }).toString(),
        timeoutMs: TOKEN_REQUEST_TIMEOUT_MS,
        responseType: 'json'
      },
      signal ? { signal } : {}
    )

    if (!response.ok) {
      this.logger.warn('MangaDex token endpoint rejected the request.', {
        status: response.status
      })
      throw new MangadexExtensionError(
        response.status === 400 || response.status === 401 ? 'auth_failed' : 'network_failed',
        response.status === 400 || response.status === 401
          ? m().errors.authFailed
          : m().errors.networkFailed
      )
    }

    const payload = response.data
    const accessToken = payload.access_token?.trim()
    const refreshToken = payload.refresh_token?.trim()
    const expiresIn = payload.expires_in

    if (!accessToken || !refreshToken || typeof expiresIn !== 'number' || expiresIn <= 0) {
      throw new MangadexExtensionError('mangadex_rejected', m().errors.rejected)
    }

    return {
      version: 1,
      accessToken,
      refreshToken,
      expiresAt: Date.now() + Math.trunc(expiresIn * 1000)
    }
  }
}
