import type { ExtensionLogger } from '@kisaki3/extension-sdk'
import { BangumiExtensionError } from '../utils/errors'
import { omitUndefined } from '../utils/object'
import type { OAuthRelayClient, OAuthRelayTokenStatus } from './relay-client'
import type { BangumiTokenSecretV1 } from './token-store'
import { TokenStore } from './token-store'

const REFRESH_SAFETY_WINDOW_MS = 5 * 60 * 1000

export interface TokenAccessOptions {
  forceRefresh?: boolean | undefined
  optional?: boolean | undefined
  signal?: AbortSignal | undefined
}

export interface StoredTokenState {
  hasToken: boolean
  hasRefreshToken: boolean
  expiresAt?: number | null
  expired: boolean
  refreshRecommended: boolean
}

export class TokenService {
  constructor(
    private readonly tokenStore: TokenStore,
    private readonly relayClient: OAuthRelayClient,
    private readonly logger?: ExtensionLogger
  ) {}

  async getAccessToken(options: TokenAccessOptions = {}): Promise<string | undefined> {
    const token = await this.tokenStore.getToken()

    if (!token) {
      if (options.optional) {
        return undefined
      }
      throw new BangumiExtensionError('auth_required', '请先登录 Bangumi 账号。')
    }

    if (options.forceRefresh) {
      return (await this.refreshAccessToken(options)).accessToken
    }

    const now = Date.now()
    const expired = isExpired(token.expiresAt, now)
    const shouldRefresh = shouldRefreshToken(token.expiresAt, now)

    if (!shouldRefresh) {
      return token.accessToken
    }

    if (options.optional && !expired) {
      return token.accessToken
    }

    if (!token.refreshToken) {
      if (options.optional) {
        return expired ? undefined : token.accessToken
      }
      throw new BangumiExtensionError('auth_required', 'Bangumi 凭据无法刷新，请重新登录。')
    }

    try {
      return (await this.refreshAccessToken(options)).accessToken
    } catch (error) {
      this.logger?.warn('Bangumi token refresh failed.', toSafeErrorLog(error))
      if (options.optional && !expired) {
        return token.accessToken
      }
      throw error
    }
  }

  async refreshAccessToken(options: TokenAccessOptions = {}): Promise<BangumiTokenSecretV1> {
    const current = await this.tokenStore.getToken()
    if (!current?.refreshToken) {
      throw new BangumiExtensionError('auth_required', 'Bangumi refresh token 不存在，请重新登录。')
    }

    const refreshed = await this.relayClient.refresh(current.refreshToken, options.signal)
    const next: Omit<BangumiTokenSecretV1, 'version'> = omitUndefined({
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? current.refreshToken,
      tokenType: refreshed.tokenType ?? current.tokenType,
      scope: refreshed.scope ?? current.scope,
      userId: refreshed.userId ?? current.userId,
      expiresAt: refreshed.expiresAt ?? current.expiresAt
    })

    await this.tokenStore.setToken(next)
    const stored = await this.tokenStore.getToken()
    if (!stored) {
      throw new BangumiExtensionError('relay_unavailable', 'Bangumi 凭据保存失败。')
    }

    return stored
  }

  async verifyCurrentToken(signal?: AbortSignal): Promise<OAuthRelayTokenStatus> {
    const token = await this.tokenStore.getToken()
    if (!token) {
      throw new BangumiExtensionError('auth_required', '请先登录 Bangumi 账号。')
    }

    const status = await this.relayClient.tokenStatus(token.accessToken, signal)
    if (!status.active) {
      throw new BangumiExtensionError('auth_required', 'Bangumi 登录已失效，请重新登录。')
    }

    return status
  }

  async getStoredTokenState(): Promise<StoredTokenState> {
    const token = await this.tokenStore.getToken()
    const now = Date.now()

    return omitUndefined({
      hasToken: !!token,
      hasRefreshToken: !!token?.refreshToken,
      expiresAt: token?.expiresAt,
      expired: isExpired(token?.expiresAt, now),
      refreshRecommended: shouldRefreshToken(token?.expiresAt, now)
    })
  }

  async clear(): Promise<void> {
    await this.tokenStore.clearAuthSecrets()
  }
}

function shouldRefreshToken(expiresAt: number | null | undefined, now: number): boolean {
  return typeof expiresAt === 'number' && expiresAt <= now + REFRESH_SAFETY_WINDOW_MS
}

function isExpired(expiresAt: number | null | undefined, now: number): boolean {
  return typeof expiresAt === 'number' && expiresAt <= now
}

function toSafeErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof BangumiExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}
