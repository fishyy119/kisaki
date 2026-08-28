import {
  createCancellationError,
  delay,
  isCancellationError,
  RateLimiter,
  throwIfAborted,
  type ExtensionLogger,
  type NetworkCapability,
  type NetworkResponse
} from '@kisaki3/extension-sdk'
import type {
  AnilistMedia,
  AnilistMediaListCollection,
  AnilistMediaSearchItem,
  AnilistCharacterConnection,
  AnilistCharacterNode,
  AnilistStaffConnection,
  AnilistStaffNode,
  AnilistViewer
} from './types'
import {
  CHARACTER_QUERY,
  CHARACTER_SEARCH_QUERY,
  MEDIA_CHARACTERS_QUERY,
  MEDIA_LIST_COLLECTION_QUERY,
  MEDIA_QUERY,
  MEDIA_SEARCH_QUERY,
  MEDIA_STAFF_QUERY,
  SAVE_MEDIA_LIST_ENTRY_MUTATION,
  STAFF_QUERY,
  STAFF_SEARCH_QUERY,
  VIEWER_QUERY
} from './queries'
import type { TokenStore } from '../auth/token-store'
import type { AnilistSettingsV1 } from '../config/schema'
import { m } from '../i18n'
import { ANILIST_RATE_LIMIT } from '../utils/constants'
import { AnilistExtensionError, toSafeErrorLog } from '../utils/errors'
import { omitUndefined } from '../utils/object'

type AuthMode = 'none' | 'optional' | 'required'

export interface AnilistRequestOptions {
  signal?: AbortSignal | undefined
}

interface GraphqlErrorShape {
  message?: string
  status?: number
}

interface GraphqlResponse<T> {
  data?: T | null
  errors?: GraphqlErrorShape[] | null
}

/**
 * GraphQL client for the AniList API.
 *
 * Requests are paced under the degraded 30-per-minute budget, transient
 * faults retry with backoff, and authenticated calls attach the stored OAuth
 * token. GraphQL reports failures as an `errors` array beside HTTP status,
 * so both layers classify into the same typed reasons.
 */
export class AnilistClient {
  private readonly limiter = new RateLimiter(ANILIST_RATE_LIMIT)

  constructor(
    private readonly network: NetworkCapability,
    private readonly tokens: TokenStore,
    private readonly getSettings: () => Promise<AnilistSettingsV1>,
    private readonly logger: ExtensionLogger
  ) {}

  async getMedia(mediaId: number, options: AnilistRequestOptions = {}): Promise<AnilistMedia> {
    const data = await this.request<{ Media?: AnilistMedia | null }>(
      MEDIA_QUERY,
      { id: mediaId },
      'none',
      options
    )
    if (!data.Media) {
      throw new AnilistExtensionError('anilist_not_found', m().errors.notFound)
    }
    return data.Media
  }

  async searchMedia(
    search: string,
    filters: { type: 'ANIME' | 'MANGA'; formatIn?: string[]; formatNotIn?: string[] },
    limit: number,
    options: AnilistRequestOptions = {}
  ): Promise<AnilistMediaSearchItem[]> {
    const keyword = search.trim()
    if (!keyword) {
      return []
    }

    const data = await this.request<{ Page?: { media?: AnilistMediaSearchItem[] | null } | null }>(
      MEDIA_SEARCH_QUERY,
      omitUndefined({
        search: keyword,
        type: filters.type,
        formatIn: filters.formatIn,
        formatNotIn: filters.formatNotIn,
        perPage: limit
      }),
      'none',
      options
    )
    return data.Page?.media ?? []
  }

  async getMediaCharacters(
    mediaId: number,
    page: number,
    perPage: number,
    options: AnilistRequestOptions = {}
  ): Promise<AnilistCharacterConnection> {
    const data = await this.request<{
      Media?: { characters?: AnilistCharacterConnection | null } | null
    }>(MEDIA_CHARACTERS_QUERY, { id: mediaId, page, perPage }, 'none', options)
    return data.Media?.characters ?? {}
  }

  async getMediaStaff(
    mediaId: number,
    page: number,
    perPage: number,
    options: AnilistRequestOptions = {}
  ): Promise<AnilistStaffConnection> {
    const data = await this.request<{
      Media?: { staff?: AnilistStaffConnection | null } | null
    }>(MEDIA_STAFF_QUERY, { id: mediaId, page, perPage }, 'none', options)
    return data.Media?.staff ?? {}
  }

  async getStaff(staffId: number, options: AnilistRequestOptions = {}): Promise<AnilistStaffNode> {
    const data = await this.request<{ Staff?: AnilistStaffNode | null }>(
      STAFF_QUERY,
      { id: staffId },
      'none',
      options
    )
    if (!data.Staff) {
      throw new AnilistExtensionError('anilist_not_found', m().errors.notFound)
    }
    return data.Staff
  }

  async searchStaff(
    search: string,
    limit: number,
    options: AnilistRequestOptions = {}
  ): Promise<AnilistStaffNode[]> {
    const keyword = search.trim()
    if (!keyword) {
      return []
    }

    const data = await this.request<{ Page?: { staff?: AnilistStaffNode[] | null } | null }>(
      STAFF_SEARCH_QUERY,
      { search: keyword, perPage: limit },
      'none',
      options
    )
    return data.Page?.staff ?? []
  }

  async getCharacter(
    characterId: number,
    options: AnilistRequestOptions = {}
  ): Promise<AnilistCharacterNode> {
    const data = await this.request<{ Character?: AnilistCharacterNode | null }>(
      CHARACTER_QUERY,
      { id: characterId },
      'none',
      options
    )
    if (!data.Character) {
      throw new AnilistExtensionError('anilist_not_found', m().errors.notFound)
    }
    return data.Character
  }

  async searchCharacters(
    search: string,
    limit: number,
    options: AnilistRequestOptions = {}
  ): Promise<AnilistCharacterNode[]> {
    const keyword = search.trim()
    if (!keyword) {
      return []
    }

    const data = await this.request<{
      Page?: { characters?: AnilistCharacterNode[] | null } | null
    }>(CHARACTER_SEARCH_QUERY, { search: keyword, perPage: limit }, 'none', options)
    return data.Page?.characters ?? []
  }

  /** Identifies the signed-in account; used by verification and the flows. */
  async getViewer(options: AnilistRequestOptions = {}): Promise<AnilistViewer> {
    const data = await this.request<{ Viewer?: AnilistViewer | null }>(
      VIEWER_QUERY,
      {},
      'required',
      options
    )
    if (!data.Viewer) {
      throw new AnilistExtensionError('auth_required', m().errors.authRequired)
    }
    return data.Viewer
  }

  async getMediaListCollection(
    userId: number,
    type: 'ANIME' | 'MANGA',
    options: AnilistRequestOptions = {}
  ): Promise<AnilistMediaListCollection> {
    const data = await this.request<{
      MediaListCollection?: AnilistMediaListCollection | null
    }>(MEDIA_LIST_COLLECTION_QUERY, { userId, type }, 'required', options)
    return data.MediaListCollection ?? {}
  }

  async saveMediaListEntry(
    mediaId: number,
    patch: { status?: string; scoreRaw?: number },
    options: AnilistRequestOptions = {}
  ): Promise<void> {
    await this.request<unknown>(
      SAVE_MEDIA_LIST_ENTRY_MUTATION,
      omitUndefined({ mediaId, status: patch.status, scoreRaw: patch.scoreRaw }),
      'required',
      options
    )
  }

  private async request<T>(
    query: string,
    variables: Record<string, unknown>,
    auth: AuthMode,
    options: AnilistRequestOptions
  ): Promise<T> {
    const settings = await this.getSettings()
    const token = auth === 'none' ? undefined : await this.tokens.getValidAccessToken()
    if (auth === 'required' && !token) {
      throw new AnilistExtensionError('auth_required', m().errors.authRequired)
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    for (let attempt = 0; attempt <= settings.client.retryCount; attempt += 1) {
      throwIfAborted(options.signal)

      try {
        await this.limiter.acquire(options.signal)
        const response: NetworkResponse<GraphqlResponse<T>> = await this.network.request<
          GraphqlResponse<T>
        >(
          {
            url: settings.endpoints.graphqlUrl,
            method: 'POST',
            headers,
            body: JSON.stringify({ query, variables }),
            timeoutMs: settings.client.timeoutMs,
            responseType: 'json'
          },
          omitUndefined({ signal: options.signal })
        )

        if (shouldRetryStatus(response.status) && attempt < settings.client.retryCount) {
          await delay(resolveRetryDelayMs(attempt), options.signal)
          continue
        }

        return this.readGraphqlPayload(response)
      } catch (error) {
        // Must precede the retry branch: a cancelled call is not a transient
        // fault and reissuing it would outlive the cancellation.
        if (isCancellationError(error)) {
          throw createCancellationError(m().errors.operationCancelled)
        }

        if (error instanceof AnilistExtensionError) {
          throw error
        }

        this.logger.debug('AniList request attempt failed.', { attempt })
        if (attempt < settings.client.retryCount) {
          await delay(resolveRetryDelayMs(attempt), options.signal)
          continue
        }
      }
    }

    throw new AnilistExtensionError('network_failed', m().errors.networkFailed)
  }

  /**
   * GraphQL failures arrive as an `errors` array on any HTTP status; the
   * remote messages are never surfaced, only their status codes classify.
   */
  private readGraphqlPayload<T>(response: NetworkResponse<GraphqlResponse<T>>): T {
    const payload = response.data
    const errorStatus = payload?.errors?.[0]?.status ?? (response.ok ? undefined : response.status)

    if (errorStatus !== undefined) {
      if (payload?.errors) {
        this.logger.debug('AniList reported a GraphQL error.', {
          status: errorStatus,
          count: payload.errors.length
        })
      }
      throw this.classifyError(errorStatus)
    }

    if (!payload?.data) {
      throw new AnilistExtensionError('anilist_rejected', m().errors.rejected)
    }

    return payload.data
  }

  private classifyError(status: number): AnilistExtensionError {
    if (status === 401 || status === 403) {
      return new AnilistExtensionError('auth_expired', m().errors.tokenExpired)
    }
    if (status === 404) {
      return new AnilistExtensionError('anilist_not_found', m().errors.notFound)
    }
    if (status === 429) {
      return new AnilistExtensionError('anilist_rate_limited', m().errors.rateLimited)
    }
    if (status >= 400 && status < 500) {
      return new AnilistExtensionError('anilist_rejected', m().errors.rejected)
    }
    return new AnilistExtensionError('network_failed', m().errors.unavailable)
  }
}

export function logAnilistFailure(logger: ExtensionLogger, message: string, error: unknown): void {
  logger.warn(message, toSafeErrorLog(error))
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function resolveRetryDelayMs(attempt: number): number {
  return Math.min(10_000, 500 * 2 ** attempt)
}
