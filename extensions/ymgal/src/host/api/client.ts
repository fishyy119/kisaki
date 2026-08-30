import { setTimeout as delay } from 'node:timers/promises'
import {
  type ExtensionLogger,
  type NetworkCapability,
  type NetworkResponse
} from '@kisaki3/extension-sdk'
import { RateLimiter } from '../utils/rate-limiter'
import {
  isYmgalNotFound,
  normalizeYmgalEnvelopeError,
  normalizeYmgalHttpError,
  YmgalApiError
} from './errors'
import type {
  YmgalCharacter,
  YmgalCharacterArchiveData,
  YmgalGameArchiveData,
  YmgalGameSearchListItem,
  YmgalOrganization,
  YmgalOrganizationArchiveData,
  YmgalOrgGameItem,
  YmgalPage,
  YmgalPerson,
  YmgalPersonArchiveData,
  YmgalTokenResponse
} from './types'
import type { CredentialStore } from '../auth/credentials'
import type { YmgalSettingsV1 } from '../config/schema'
import { m } from '../i18n'
import {
  YMGAL_ACCURATE_SEARCH_SIMILARITY,
  YMGAL_SEARCH_PAGE_SIZE,
  YMGAL_TOKEN_SCOPE
} from '../utils/constants'
import { YmgalExtensionError } from '../utils/errors'

/** The developer notes ask clients not to burst; pace well under that. */
const RATE_LIMIT: { maxRequests: number; windowMs: number } = {
  maxRequests: 3,
  windowMs: 1_000
}

/** Refresh a little before expiry so a request never races the deadline. */
const TOKEN_REFRESH_MARGIN_MS = 30_000
const TOKEN_FALLBACK_LIFETIME_MS = 3_600_000

type QueryValue = string | number | boolean | undefined

export interface YmgalRequestOptions {
  signal?: AbortSignal | undefined
}

export class YmgalClient {
  private readonly limiter = new RateLimiter(RATE_LIMIT)
  private accessToken: string | null = null
  private tokenExpiry = 0
  /** Client the cached token was issued for; a credential change invalidates it. */
  private tokenClientId: string | null = null

  constructor(
    private readonly network: NetworkCapability,
    private readonly credentials: CredentialStore,
    private readonly getSettings: () => Promise<YmgalSettingsV1>,
    private readonly logger: ExtensionLogger
  ) {}

  /** Cheapest authenticated round trip; used by the settings connection test. */
  async verifyCredential(signal?: AbortSignal): Promise<void> {
    this.invalidateToken()
    await this.requireAccessToken({ signal })
  }

  /** Drops the cached token so the next request authenticates afresh. */
  invalidateToken(): void {
    this.accessToken = null
    this.tokenExpiry = 0
    this.tokenClientId = null
  }

  async searchGameList(
    keyword: string,
    options: YmgalRequestOptions & { pageNum?: number } = {}
  ): Promise<YmgalPage<YmgalGameSearchListItem>> {
    const normalized = keyword.trim()
    if (!normalized) {
      return { result: [], total: 0, hasNext: false, pageNum: 1, pageSize: YMGAL_SEARCH_PAGE_SIZE }
    }

    return this.requestData<YmgalPage<YmgalGameSearchListItem>>(
      '/open/archive/search-game',
      {
        mode: 'list',
        keyword: normalized,
        pageNum: Math.max(1, Math.floor(options.pageNum ?? 1)),
        pageSize: YMGAL_SEARCH_PAGE_SIZE
      },
      options
    )
  }

  /**
   * Best single match for a keyword, or `null` when YMGal knows none. A
   * not-found answer is the API's way of saying the keyword matched nothing,
   * so it degrades to `null` instead of failing the surrounding search.
   */
  async searchGameAccurate(
    keyword: string,
    options: YmgalRequestOptions = {}
  ): Promise<YmgalGameArchiveData | null> {
    const normalized = keyword.trim()
    if (!normalized) {
      return null
    }

    try {
      return await this.requestData<YmgalGameArchiveData>(
        '/open/archive/search-game',
        {
          mode: 'accurate',
          keyword: normalized,
          similarity: YMGAL_ACCURATE_SEARCH_SIMILARITY
        },
        options
      )
    } catch (error) {
      if (isYmgalNotFound(error)) {
        return null
      }
      throw error
    }
  }

  async getGameArchive(
    gameId: string,
    options: YmgalRequestOptions = {}
  ): Promise<YmgalGameArchiveData> {
    return this.requestData<YmgalGameArchiveData>('/open/archive', { gid: gameId }, options)
  }

  async getOrganizationArchive(
    orgId: string,
    options: YmgalRequestOptions = {}
  ): Promise<YmgalOrganization> {
    const data = await this.requestData<YmgalOrganizationArchiveData>(
      '/open/archive',
      { orgId },
      options
    )
    if (!data.org) {
      throw new YmgalApiError('ymgal_not_found', m().errors.notFound, { path: '/open/archive' })
    }
    return data.org
  }

  async getCharacterArchive(
    characterId: string,
    options: YmgalRequestOptions = {}
  ): Promise<YmgalCharacter> {
    const data = await this.requestData<YmgalCharacterArchiveData>(
      '/open/archive',
      { cid: characterId },
      options
    )
    if (!data.character) {
      throw new YmgalApiError('ymgal_not_found', m().errors.notFound, { path: '/open/archive' })
    }
    return data.character
  }

  async getPersonArchive(
    personId: string,
    options: YmgalRequestOptions = {}
  ): Promise<YmgalPerson> {
    const data = await this.requestData<YmgalPersonArchiveData>(
      '/open/archive',
      { pid: personId },
      options
    )
    if (!data.person) {
      throw new YmgalApiError('ymgal_not_found', m().errors.notFound, { path: '/open/archive' })
    }
    return data.person
  }

  async getOrganizationGames(
    orgId: string,
    options: YmgalRequestOptions = {}
  ): Promise<YmgalOrgGameItem[]> {
    return this.requestData<YmgalOrgGameItem[]>('/open/archive/game', { orgId }, options)
  }

  /**
   * Performs one authenticated read, retrying transient faults and refreshing
   * the token once on a rejected authorization.
   */
  private async requestData<T>(
    pathname: string,
    query: Record<string, QueryValue>,
    options: YmgalRequestOptions
  ): Promise<T> {
    const settings = await this.getSettings()
    let refreshedToken = false

    for (let attempt = 0; attempt <= settings.client.retryCount; attempt += 1) {
      options.signal?.throwIfAborted()

      try {
        const token = await this.requireAccessToken(options)
        const response = await this.fetchJson<unknown>(
          this.buildUrl(settings.endpoints.apiBaseUrl, pathname, query),
          {
            Accept: 'application/json;charset=utf-8',
            Authorization: `Bearer ${token}`,
            version: '1'
          },
          settings,
          options
        )

        // An expired token reads as a rejected request, so retry it once with
        // a fresh one before treating the rejection as final.
        if (response.status === 401 && !refreshedToken) {
          refreshedToken = true
          this.invalidateToken()
          continue
        }

        if (!response.ok) {
          if (shouldRetryStatus(response.status) && attempt < settings.client.retryCount) {
            await delay(resolveRetryDelayMs(attempt), undefined, { signal: options.signal })
            continue
          }

          throw normalizeYmgalHttpError(response.status, pathname)
        }

        return this.unwrapEnvelope<T>(response.data, pathname)
      } catch (error) {
        // Must precede the retry branch: a cancelled call is not a transient
        // fault and reissuing it would outlive the cancellation.
        if (options.signal?.aborted) {
          throw error
        }

        if (error instanceof YmgalExtensionError) {
          throw error
        }

        this.logger.debug('YMGal request attempt failed.', { path: pathname, attempt })
        if (attempt < settings.client.retryCount) {
          await delay(resolveRetryDelayMs(attempt), undefined, { signal: options.signal })
          continue
        }
      }
    }

    throw new YmgalApiError('network_failed', m().errors.networkFailed, { path: pathname })
  }

  /**
   * Only the token value is cached, never the in-flight request: sharing the
   * promise would let one invocation's cancellation reject another's await.
   */
  private async requireAccessToken(options: YmgalRequestOptions): Promise<string> {
    const credential = await this.credentials.getCredential()
    const now = Date.now()
    if (
      this.accessToken &&
      this.tokenClientId === credential.clientId &&
      this.tokenExpiry > now + TOKEN_REFRESH_MARGIN_MS
    ) {
      return this.accessToken
    }

    const settings = await this.getSettings()
    const response = await this.fetchJson<YmgalTokenResponse>(
      this.buildUrl(settings.endpoints.apiBaseUrl, '/oauth/token', {
        grant_type: 'client_credentials',
        client_id: credential.clientId,
        client_secret: credential.clientSecret,
        scope: YMGAL_TOKEN_SCOPE
      }),
      { Accept: 'application/json' },
      settings,
      options
    )

    if (!response.ok) {
      throw normalizeYmgalHttpError(response.status, '/oauth/token')
    }

    const accessToken = response.data?.access_token?.trim()
    if (!accessToken) {
      throw new YmgalApiError('auth_failed', m().errors.authFailed, { path: '/oauth/token' })
    }

    const expiresIn = Number(response.data.expires_in)
    const lifetimeMs =
      Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1_000 : TOKEN_FALLBACK_LIFETIME_MS

    this.accessToken = accessToken
    this.tokenExpiry = Date.now() + lifetimeMs
    this.tokenClientId = credential.clientId
    return accessToken
  }

  private fetchJson<T>(
    url: string,
    headers: Record<string, string>,
    settings: YmgalSettingsV1,
    options: YmgalRequestOptions
  ): Promise<NetworkResponse<T>> {
    return this.limiter.acquire(options.signal).then(() =>
      this.network.request<T>(
        {
          url,
          method: 'GET',
          headers,
          timeoutMs: settings.client.timeoutMs,
          responseType: 'json'
        },
        { signal: options.signal }
      )
    )
  }

  /** YMGal wraps every payload in a success/code envelope over HTTP 200. */
  private unwrapEnvelope<T>(payload: unknown, pathname: string): T {
    const envelope = payload as { success?: boolean; code?: number; data?: T | null } | null
    const apiCode = Number(envelope?.code)

    if (!envelope?.success || apiCode !== 0) {
      throw normalizeYmgalEnvelopeError(Number.isFinite(apiCode) ? apiCode : -1, pathname)
    }

    if (envelope.data === undefined || envelope.data === null) {
      throw new YmgalApiError('ymgal_not_found', m().errors.notFound, { path: pathname })
    }

    return envelope.data
  }

  private buildUrl(baseUrl: string, pathname: string, query: Record<string, QueryValue>): string {
    const url = new URL(`${baseUrl}${pathname}`)
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }
    return url.toString()
  }
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function resolveRetryDelayMs(attempt: number): number {
  return Math.min(10_000, 500 * 2 ** attempt)
}
