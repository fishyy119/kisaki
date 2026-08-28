import type { ExtensionLogger, OAuthRelayClient } from '@kisaki3/extension-sdk'
import { m } from '../i18n'
import { GbooksExtensionError, toSafeErrorLog } from '../utils/errors'
import type { TokenStore } from './token-store'

/** Refresh this early before the stored access token expires. */
const REFRESH_SAFETY_WINDOW_MS = 5 * 60 * 1000

/**
 * Keeps the Google access token fresh through the relay's refresh route
 * (the relay holds the client secret; this machine never sees it). Refreshes
 * are single-flight.
 */
export class TokenService {
  private refreshing: Promise<string> | undefined

  constructor(
    private readonly store: TokenStore,
    private readonly relayClient: OAuthRelayClient,
    private readonly logger: ExtensionLogger
  ) {}

  /** Valid access token, refreshing first when it is about to expire. */
  async getFreshAccessToken(signal?: AbortSignal): Promise<string> {
    const token = await this.store.getToken()
    if (!token) {
      throw new GbooksExtensionError('auth_required', m().errors.authRequired)
    }

    const now = Date.now()
    if (token.expiresAt === undefined || token.expiresAt - REFRESH_SAFETY_WINDOW_MS > now) {
      return token.accessToken
    }

    if (!token.refreshToken) {
      if (token.expiresAt > now) {
        return token.accessToken
      }
      throw new GbooksExtensionError('auth_expired', m().errors.tokenExpired)
    }

    this.refreshing ??= this.refresh(token.refreshToken, signal).finally(() => {
      this.refreshing = undefined
    })
    return this.refreshing
  }

  private async refresh(refreshToken: string, signal?: AbortSignal): Promise<string> {
    try {
      const refreshed = await this.relayClient.refresh(refreshToken, signal)
      await this.store.setToken(refreshed)
      return refreshed.accessToken
    } catch (error) {
      this.logger.warn('Google Books token refresh failed.', toSafeErrorLog(error))
      throw error
    }
  }
}
