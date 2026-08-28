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
import type { TokenManager } from '../auth/token-manager'
import type { MalSettingsV1 } from '../config/schema'
import { m } from '../i18n'
import { MAL_OAUTH_CLIENT_ID, MAL_RATE_LIMIT } from '../utils/constants'
import { MalExtensionError, toSafeErrorLog } from '../utils/errors'
import { omitUndefined } from '../utils/object'
import type {
  MalAnimeDetail,
  MalListPage,
  MalListStatus,
  MalMangaDetail,
  MalSearchPage,
  MalUser
} from './types'

type AuthMode = 'public' | 'required'

export interface MalRequestOptions {
  signal?: AbortSignal | undefined
}

const ANIME_DETAIL_FIELDS =
  'id,title,main_picture,alternative_titles,start_date,synopsis,media_type,status,genres,num_episodes,source,average_episode_duration,studios,pictures,related_anime{media_type},related_manga{media_type}'
const MANGA_DETAIL_FIELDS =
  'id,title,main_picture,alternative_titles,start_date,synopsis,media_type,status,genres,num_volumes,num_chapters,authors{first_name,last_name},serialization{name},pictures,related_anime{media_type},related_manga{media_type}'
const SEARCH_FIELDS = 'id,title,main_picture,alternative_titles,start_date,media_type'
const LIST_FIELDS = 'list_status,alternative_titles,media_type,start_date'

/**
 * Client for the official MAL API v2.
 *
 * Public reads authenticate with the `X-MAL-CLIENT-ID` header; user-scoped
 * calls carry the OAuth bearer token, refreshed through the token manager
 * before it expires. `nsfw=true` is always requested: a library manager must
 * not silently drop entries the user actually tracks.
 */
export class MalOfficialClient {
  private readonly limiter = new RateLimiter(MAL_RATE_LIMIT)

  constructor(
    private readonly network: NetworkCapability,
    private readonly tokens: TokenManager,
    private readonly getSettings: () => Promise<MalSettingsV1>,
    private readonly logger: ExtensionLogger
  ) {}

  async searchAnime(
    query: string,
    limit: number,
    options: MalRequestOptions = {}
  ): Promise<MalSearchPage> {
    return this.request<MalSearchPage>(
      'anime',
      { q: query, limit: String(limit), fields: SEARCH_FIELDS, nsfw: 'true' },
      'public',
      options
    )
  }

  async searchManga(
    query: string,
    limit: number,
    options: MalRequestOptions = {}
  ): Promise<MalSearchPage> {
    return this.request<MalSearchPage>(
      'manga',
      { q: query, limit: String(limit), fields: SEARCH_FIELDS, nsfw: 'true' },
      'public',
      options
    )
  }

  async getAnime(animeId: number, options: MalRequestOptions = {}): Promise<MalAnimeDetail> {
    return this.request<MalAnimeDetail>(
      `anime/${animeId}`,
      { fields: ANIME_DETAIL_FIELDS },
      'public',
      options
    )
  }

  async getManga(mangaId: number, options: MalRequestOptions = {}): Promise<MalMangaDetail> {
    return this.request<MalMangaDetail>(
      `manga/${mangaId}`,
      { fields: MANGA_DETAIL_FIELDS },
      'public',
      options
    )
  }

  /** Identifies the signed-in account; used by verification and the flows. */
  async getOwnUser(options: MalRequestOptions = {}): Promise<MalUser> {
    return this.request<MalUser>('users/@me', { fields: 'id,name' }, 'required', options)
  }

  async getOwnListPage(
    kind: 'animelist' | 'mangalist',
    offset: number,
    limit: number,
    options: MalRequestOptions = {}
  ): Promise<MalListPage> {
    return this.request<MalListPage>(
      `users/@me/${kind}`,
      { fields: LIST_FIELDS, limit: String(limit), offset: String(offset), nsfw: 'true' },
      'required',
      options
    )
  }

  async updateListStatus(
    kind: 'anime' | 'manga',
    mediaId: number,
    patch: { status?: string; score?: number },
    options: MalRequestOptions = {}
  ): Promise<MalListStatus> {
    const body = new URLSearchParams()
    if (patch.status !== undefined) {
      body.set('status', patch.status)
    }
    if (patch.score !== undefined) {
      body.set('score', String(patch.score))
    }

    return this.request<MalListStatus>(
      `${kind}/${mediaId}/my_list_status`,
      {},
      'required',
      options,
      {
        method: 'PATCH',
        body: body.toString(),
        contentType: 'application/x-www-form-urlencoded'
      }
    )
  }

  private async request<T>(
    path: string,
    query: Record<string, string>,
    auth: AuthMode,
    options: MalRequestOptions,
    write?: { method: 'PATCH'; body: string; contentType: string }
  ): Promise<T> {
    const settings = await this.getSettings()

    const headers: Record<string, string> = { Accept: 'application/json' }
    if (auth === 'required') {
      const token = await this.tokens.getFreshAccessToken(options.signal)
      if (!token) {
        throw new MalExtensionError('auth_required', m().errors.authRequired)
      }
      headers.Authorization = `Bearer ${token}`
    } else {
      headers['X-MAL-CLIENT-ID'] = MAL_OAUTH_CLIENT_ID
    }
    if (write) {
      headers['Content-Type'] = write.contentType
    }

    const url = buildUrl(settings.endpoints.apiUrl, path, query)

    for (let attempt = 0; attempt <= settings.client.retryCount; attempt += 1) {
      throwIfAborted(options.signal)

      try {
        await this.limiter.acquire(options.signal)
        const response: NetworkResponse<T> = await this.network.request<T>(
          {
            url,
            method: write?.method ?? 'GET',
            headers,
            ...(write ? { body: write.body } : {}),
            timeoutMs: settings.client.timeoutMs,
            responseType: 'json'
          },
          omitUndefined({ signal: options.signal })
        )

        if (response.ok) {
          return response.data
        }

        if (shouldRetryStatus(response.status) && attempt < settings.client.retryCount) {
          await delay(resolveRetryDelayMs(attempt), options.signal)
          continue
        }

        throw this.classifyError(response.status)
      } catch (error) {
        // Must precede the retry branch: a cancelled call is not a transient
        // fault and reissuing it would outlive the cancellation.
        if (isCancellationError(error)) {
          throw createCancellationError(m().errors.operationCancelled)
        }

        if (error instanceof MalExtensionError) {
          throw error
        }

        this.logger.debug('MAL request attempt failed.', { attempt })
        if (attempt < settings.client.retryCount) {
          await delay(resolveRetryDelayMs(attempt), options.signal)
          continue
        }
      }
    }

    throw new MalExtensionError('network_failed', m().errors.networkFailed)
  }

  private classifyError(status: number): MalExtensionError {
    if (status === 401 || status === 403) {
      return new MalExtensionError('auth_expired', m().errors.tokenExpired)
    }
    if (status === 404) {
      return new MalExtensionError('mal_not_found', m().errors.notFound)
    }
    if (status === 429) {
      return new MalExtensionError('mal_rate_limited', m().errors.rateLimited)
    }
    if (status >= 400 && status < 500) {
      return new MalExtensionError('mal_rejected', m().errors.rejected)
    }
    return new MalExtensionError('network_failed', m().errors.unavailable)
  }
}

export function logMalFailure(logger: ExtensionLogger, message: string, error: unknown): void {
  logger.warn(message, toSafeErrorLog(error))
}

function buildUrl(base: string, path: string, query: Record<string, string>): string {
  const url = new URL(`${base}/${path}`)
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function resolveRetryDelayMs(attempt: number): number {
  return Math.min(10_000, 500 * 2 ** attempt)
}
