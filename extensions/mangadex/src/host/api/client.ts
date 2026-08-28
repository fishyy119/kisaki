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
import type { MangadexSettingsV1 } from '../config/schema'
import { m } from '../i18n'
import {
  MANGADEX_API_URL,
  MANGADEX_COVER_PAGE_SIZE,
  MANGADEX_RATE_LIMIT,
  MANGADEX_RATING_BATCH_SIZE
} from '../utils/constants'
import { MangadexExtensionError } from '../utils/errors'
import { chunk } from '../utils/object'
import type {
  MdAuthor,
  MdCover,
  MdEntityResponse,
  MdListResponse,
  MdManga,
  MdRatingsResponse,
  MdStatusesResponse,
  MdUser
} from './types'

type AuthMode = 'public' | 'required'

export interface MangadexRequestOptions {
  signal?: AbortSignal | undefined
}

/** All four content ratings; a library manager must not silently drop entries. */
const ALL_CONTENT_RATINGS = ['safe', 'suggestive', 'erotica', 'pornographic'] as const

/**
 * Client for the MangaDex REST API.
 *
 * Requests are paced under the global five-per-second budget; user-scoped
 * calls carry the bearer token the token manager keeps fresh over the
 * password grant.
 */
export class MangadexClient {
  private readonly limiter = new RateLimiter(MANGADEX_RATE_LIMIT)

  constructor(
    private readonly network: NetworkCapability,
    private readonly tokens: TokenManager,
    private readonly getSettings: () => Promise<MangadexSettingsV1>,
    private readonly logger: ExtensionLogger
  ) {}

  async searchManga(
    title: string,
    limit: number,
    options: MangadexRequestOptions = {}
  ): Promise<MdManga[]> {
    const query = new URLSearchParams({ title, limit: String(limit) })
    for (const rating of ALL_CONTENT_RATINGS) {
      query.append('contentRating[]', rating)
    }
    query.append('includes[]', 'author')
    query.append('includes[]', 'artist')

    const page = await this.request<MdListResponse<MdManga>>(
      `manga?${query.toString()}`,
      'public',
      options
    )
    return page.data ?? []
  }

  async getManga(mangaId: string, options: MangadexRequestOptions = {}): Promise<MdManga> {
    const query = new URLSearchParams()
    query.append('includes[]', 'author')
    query.append('includes[]', 'artist')
    query.append('includes[]', 'cover_art')

    const response = await this.request<MdEntityResponse<MdManga>>(
      `manga/${mangaId}?${query.toString()}`,
      'public',
      options
    )
    if (!response.data) {
      throw new MangadexExtensionError('mangadex_not_found', m().errors.notFound)
    }
    return response.data
  }

  /** Every cover of one entry, volume-ascending, across pagination. */
  async listCovers(mangaId: string, options: MangadexRequestOptions = {}): Promise<MdCover[]> {
    const covers: MdCover[] = []

    for (let offset = 0; ; offset += MANGADEX_COVER_PAGE_SIZE) {
      const query = new URLSearchParams({
        limit: String(MANGADEX_COVER_PAGE_SIZE),
        offset: String(offset)
      })
      query.append('manga[]', mangaId)
      query.set('order[volume]', 'asc')

      const page = await this.request<MdListResponse<MdCover>>(
        `cover?${query.toString()}`,
        'public',
        options
      )
      covers.push(...(page.data ?? []))

      const total = page.total ?? covers.length
      if (covers.length >= total || (page.data ?? []).length === 0) {
        return covers
      }
    }
  }

  async searchAuthors(
    name: string,
    limit: number,
    options: MangadexRequestOptions = {}
  ): Promise<MdAuthor[]> {
    const query = new URLSearchParams({ name, limit: String(limit) })
    const page = await this.request<MdListResponse<MdAuthor>>(
      `author?${query.toString()}`,
      'public',
      options
    )
    return page.data ?? []
  }

  async getAuthor(authorId: string, options: MangadexRequestOptions = {}): Promise<MdAuthor> {
    const response = await this.request<MdEntityResponse<MdAuthor>>(
      `author/${authorId}`,
      'public',
      options
    )
    if (!response.data) {
      throw new MangadexExtensionError('mangadex_not_found', m().errors.notFound)
    }
    return response.data
  }

  /** Identifies the signed-in account; used by verification and the flows. */
  async getOwnUser(options: MangadexRequestOptions = {}): Promise<MdUser> {
    const response = await this.request<MdEntityResponse<MdUser>>('user/me', 'required', options)
    if (!response.data) {
      throw new MangadexExtensionError('mangadex_rejected', m().errors.rejected)
    }
    return response.data
  }

  /** All reading statuses of the account in one call. */
  async getAllReadingStatuses(
    options: MangadexRequestOptions = {}
  ): Promise<Record<string, string>> {
    const response = await this.request<MdStatusesResponse>('manga/status', 'required', options)
    const statuses: Record<string, string> = {}
    for (const [mangaId, status] of Object.entries(response.statuses ?? {})) {
      if (typeof status === 'string' && status) {
        statuses[mangaId] = status
      }
    }
    return statuses
  }

  /** Ratings for the given entries, read in API-sized batches. */
  async getRatings(
    mangaIds: readonly string[],
    options: MangadexRequestOptions = {}
  ): Promise<Record<string, number>> {
    const ratings: Record<string, number> = {}

    for (const batch of chunk(mangaIds, MANGADEX_RATING_BATCH_SIZE)) {
      const query = new URLSearchParams()
      for (const mangaId of batch) {
        query.append('manga[]', mangaId)
      }

      const response = await this.request<MdRatingsResponse>(
        `rating?${query.toString()}`,
        'required',
        options
      )
      // The API serializes the empty map as an array.
      if (response.ratings && !Array.isArray(response.ratings)) {
        for (const [mangaId, record] of Object.entries(response.ratings)) {
          const rating = record?.rating
          if (typeof rating === 'number' && Number.isFinite(rating) && rating > 0) {
            ratings[mangaId] = rating
          }
        }
      }
    }

    return ratings
  }

  async updateReadingStatus(
    mangaId: string,
    status: string,
    options: MangadexRequestOptions = {}
  ): Promise<void> {
    await this.request<unknown>(`manga/${mangaId}/status`, 'required', options, {
      method: 'POST',
      body: JSON.stringify({ status })
    })
  }

  async updateRating(
    mangaId: string,
    rating: number,
    options: MangadexRequestOptions = {}
  ): Promise<void> {
    await this.request<unknown>(`rating/${mangaId}`, 'required', options, {
      method: 'POST',
      body: JSON.stringify({ rating })
    })
  }

  private async request<T>(
    path: string,
    auth: AuthMode,
    options: MangadexRequestOptions,
    write?: { method: 'POST'; body: string }
  ): Promise<T> {
    const settings = await this.getSettings()

    const headers: Record<string, string> = { Accept: 'application/json' }
    if (auth === 'required') {
      headers.Authorization = `Bearer ${await this.tokens.getFreshAccessToken(options.signal)}`
    }
    if (write) {
      headers['Content-Type'] = 'application/json'
    }

    const url = `${MANGADEX_API_URL}/${path}`

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
          options.signal ? { signal: options.signal } : {}
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

        if (error instanceof MangadexExtensionError) {
          throw error
        }

        this.logger.debug('MangaDex request attempt failed.', { attempt })
        if (attempt < settings.client.retryCount) {
          await delay(resolveRetryDelayMs(attempt), options.signal)
          continue
        }
      }
    }

    throw new MangadexExtensionError('network_failed', m().errors.networkFailed)
  }

  private classifyError(status: number): MangadexExtensionError {
    if (status === 401 || status === 403) {
      return new MangadexExtensionError('auth_failed', m().errors.authFailed)
    }
    if (status === 404) {
      return new MangadexExtensionError('mangadex_not_found', m().errors.notFound)
    }
    if (status === 429) {
      return new MangadexExtensionError('mangadex_rate_limited', m().errors.rateLimited)
    }
    if (status >= 400 && status < 500) {
      return new MangadexExtensionError('mangadex_rejected', m().errors.rejected)
    }
    return new MangadexExtensionError('network_failed', m().errors.unavailable)
  }
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function resolveRetryDelayMs(attempt: number): number {
  return Math.min(10_000, 500 * 2 ** attempt)
}
