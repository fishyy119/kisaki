/**
 * YMGal API Client
 *
 * Base URL: https://www.ymgal.games
 * Auth: OAuth2 client_credentials (public scope).
 *
 * References:
 * - https://www.ymgal.games/developer
 */

import type { NetworkService } from '@main/services/network'
import { createProviderHttpError } from '../../../../shared'
import { normalizeYmgalId } from './format'
import type {
  YmgalApiResponse,
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

const RATE_LIMIT_KEY = 'ymgal'
// Docs explicitly ask developers to avoid concurrent bursts.
const RATE_LIMIT_CONFIG = { maxRequests: 3, windowMs: 1000 }

const BASE_URL = 'https://www.ymgal.games'
const PUBLIC_CLIENT_ID = 'ymgal'
const PUBLIC_CLIENT_SECRET = 'luna0327'
const TOKEN_SCOPE = 'public'

type QueryValue = string | number | boolean | null | undefined

export class YmgalApiError extends Error {
  constructor(
    public readonly code: number,
    message: string
  ) {
    super(message)
    this.name = 'YmgalApiError'
  }
}

export function isYmgalApiError(error: unknown): error is YmgalApiError {
  return error instanceof YmgalApiError
}

/** Credentials and access token shared by every bound client view. */
interface YmgalClientState {
  network: NetworkService
  clientId?: string
  clientSecret?: string
  rateLimitRegistered: boolean
  accessToken: string | null
  tokenExpiry: number
}

export class YmgalClient {
  private constructor(
    private readonly state: YmgalClientState,
    private readonly signal?: AbortSignal
  ) {}

  static create(network: NetworkService, clientId?: string, clientSecret?: string): YmgalClient {
    return new YmgalClient({
      network,
      clientId,
      clientSecret,
      rateLimitRegistered: false,
      accessToken: null,
      tokenExpiry: 0
    })
  }

  /**
   * View bound to one invocation's cancellation scope. Shared state stays
   * shared, so every request a provider makes for that invocation is
   * cancellable without the call sites carrying a signal.
   */
  withSignal(signal: AbortSignal | undefined): YmgalClient {
    return new YmgalClient(this.state, signal)
  }

  private ensureRateLimitRegistered(): void {
    if (!this.state.rateLimitRegistered) {
      this.state.network.rateLimits.register(RATE_LIMIT_KEY, RATE_LIMIT_CONFIG)
      this.state.rateLimitRegistered = true
    }
  }

  private resolveClientId(): string {
    return this.state.clientId?.trim() || PUBLIC_CLIENT_ID
  }

  private resolveClientSecret(): string {
    return this.state.clientSecret?.trim() || PUBLIC_CLIENT_SECRET
  }

  private buildUrl(pathname: string, query?: Record<string, QueryValue>): string {
    const url = new URL(pathname, BASE_URL)

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue
        url.searchParams.set(key, String(value))
      }
    }

    return url.toString()
  }

  private buildApiHeaders(accessToken: string): Record<string, string> {
    return {
      Accept: 'application/json;charset=utf-8',
      Authorization: `Bearer ${accessToken}`,
      version: '1'
    }
  }

  /**
   * Only the token value is cached, never the in-flight request: sharing the
   * promise would let one invocation's cancellation reject another's await.
   */
  private async getAccessToken(forceRefresh = false): Promise<string> {
    this.ensureRateLimitRegistered()

    const now = Date.now()
    if (!forceRefresh && this.state.accessToken && this.state.tokenExpiry > now + 30_000) {
      return this.state.accessToken
    }

    const response = await this.state.network.request.fetch(
      this.buildUrl('/oauth/token', {
        grant_type: 'client_credentials',
        client_id: this.resolveClientId(),
        client_secret: this.resolveClientSecret(),
        scope: TOKEN_SCOPE
      }),
      {
        method: 'GET',
        rateLimitKey: RATE_LIMIT_KEY,
        signal: this.signal
      }
    )

    if (!response.ok) {
      throw createProviderHttpError('YMGal', 'OAuth', response)
    }

    const tokenResponse = (await response.json()) as YmgalTokenResponse
    const accessToken = tokenResponse.access_token?.trim()
    if (!accessToken) {
      throw new Error('YMGal OAuth failed: missing access_token.')
    }

    const expiresIn = Number(tokenResponse.expires_in)
    const expiresMs = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1000 : 3_600_000

    this.state.accessToken = accessToken
    this.state.tokenExpiry = Date.now() + expiresMs
    return accessToken
  }

  private async requestData<T>(
    pathname: string,
    query?: Record<string, QueryValue>,
    retryOnUnauthorized = true
  ): Promise<T> {
    this.ensureRateLimitRegistered()
    const token = await this.getAccessToken()

    const response = await this.state.network.request.fetch(this.buildUrl(pathname, query), {
      method: 'GET',
      headers: this.buildApiHeaders(token),
      rateLimitKey: RATE_LIMIT_KEY,
      signal: this.signal
    })

    if (response.status === 401 && retryOnUnauthorized) {
      this.state.accessToken = null
      this.state.tokenExpiry = 0
      await this.getAccessToken(true)
      return this.requestData<T>(pathname, query, false)
    }

    if (!response.ok) {
      throw createProviderHttpError('YMGal', 'API request', response)
    }

    const payload = (await response.json()) as YmgalApiResponse<T>
    const code = Number(payload.code)

    if (!payload.success || code !== 0) {
      throw new YmgalApiError(code, payload.msg?.trim() || `YMGal API error: code ${code}`)
    }

    if (payload.data === undefined || payload.data === null) {
      throw new YmgalApiError(code, 'YMGal API returned empty data.')
    }

    return payload.data
  }

  async searchGameList(
    keyword: string,
    pageNum = 1,
    pageSize = 20
  ): Promise<YmgalPage<YmgalGameSearchListItem>> {
    const normalizedKeyword = keyword.trim()
    if (!normalizedKeyword) {
      return { result: [], total: 0, hasNext: false, pageNum: 1, pageSize: 20 }
    }

    return this.requestData<YmgalPage<YmgalGameSearchListItem>>('/open/archive/search-game', {
      mode: 'list',
      keyword: normalizedKeyword,
      pageNum: Math.max(1, Math.floor(pageNum)),
      pageSize: Math.max(1, Math.min(Math.floor(pageSize), 20))
    })
  }

  async searchGameAccurate(keyword: string, similarity = 70): Promise<YmgalGameArchiveData | null> {
    const normalizedKeyword = keyword.trim()
    if (!normalizedKeyword) return null

    try {
      return await this.requestData<YmgalGameArchiveData>('/open/archive/search-game', {
        mode: 'accurate',
        keyword: normalizedKeyword,
        similarity: Math.max(50, Math.min(Math.floor(similarity), 99))
      })
    } catch (error) {
      if (isYmgalApiError(error) && (error.code === 404 || error.code === 614)) {
        return null
      }
      throw error
    }
  }

  async getGameArchive(gameId: string): Promise<YmgalGameArchiveData> {
    return this.requestData<YmgalGameArchiveData>('/open/archive', {
      gid: normalizeYmgalId(gameId, 'YMGal game id')
    })
  }

  async getOrganizationArchive(orgId: string): Promise<YmgalOrganization> {
    const data = await this.requestData<YmgalOrganizationArchiveData>('/open/archive', {
      orgId: normalizeYmgalId(orgId, 'YMGal organization id')
    })
    if (!data.org) {
      throw new Error(`YMGal organization not found: ${orgId}`)
    }
    return data.org
  }

  async getCharacterArchive(characterId: string): Promise<YmgalCharacter> {
    const data = await this.requestData<YmgalCharacterArchiveData>('/open/archive', {
      cid: normalizeYmgalId(characterId, 'YMGal character id')
    })
    if (!data.character) {
      throw new Error(`YMGal character not found: ${characterId}`)
    }
    return data.character
  }

  async getPersonArchive(personId: string): Promise<YmgalPerson> {
    const data = await this.requestData<YmgalPersonArchiveData>('/open/archive', {
      pid: normalizeYmgalId(personId, 'YMGal person id')
    })
    if (!data.person) {
      throw new Error(`YMGal person not found: ${personId}`)
    }
    return data.person
  }

  async getOrganizationGames(orgId: string): Promise<YmgalOrgGameItem[]> {
    return this.requestData<YmgalOrgGameItem[]>('/open/archive/game', {
      orgId: normalizeYmgalId(orgId, 'YMGal organization id')
    })
  }
}
