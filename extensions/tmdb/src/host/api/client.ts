import {
  createCancellationError,
  isCancellationError,
  type ExtensionLogger,
  type NetworkCapability,
  type NetworkResponse
} from '@kisaki3/extension-sdk'
import { normalizeTmdbApiError, readRetryAfterMs, TmdbApiError } from './errors'
import { delay, TmdbRateLimiter } from './limiter'
import type {
  TmdbCollectionDetail,
  TmdbCompanyDetail,
  TmdbCredits,
  TmdbEpisodeGroupDetail,
  TmdbEpisodeGroupsResponse,
  TmdbExternalIds,
  TmdbImages,
  TmdbMovieDetail,
  TmdbMovieKeywords,
  TmdbPaged,
  TmdbPersonDetail,
  TmdbSearchCompany,
  TmdbSearchMovie,
  TmdbSearchPerson,
  TmdbSearchSeries,
  TmdbSeasonDetail,
  TmdbSeriesDetail,
  TmdbSeriesKeywords
} from './types'
import type { ApiKeyStore } from '../auth/api-key'
import type { TmdbSettingsV1 } from '../config/schema'
import { m } from '../i18n'
import { TmdbExtensionError, throwIfAborted } from '../utils/errors'
import { omitUndefined } from '../utils/object'

/** Paced well below the burst rate TMDB tolerates for a single client. */
const RATE_LIMIT_MAX_REQUESTS = 30
const RATE_LIMIT_WINDOW_MS = 1_000

type QueryValue = string | number | boolean | undefined

export interface TmdbRequestOptions {
  /** TMDB language tag, e.g. `zh-CN`. Omitted requests fall back to English. */
  language?: string | undefined
  signal?: AbortSignal | undefined
}

export interface TmdbSearchOptions extends TmdbRequestOptions {
  page?: number | undefined
  includeAdult?: boolean | undefined
}

export interface TmdbImageOptions extends TmdbRequestOptions {
  /** ISO-639-1 codes accepted for image variants; `null` means "no language". */
  imageLanguages?: readonly string[] | undefined
}

export class TmdbClient {
  private readonly limiter = new TmdbRateLimiter(RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS)

  constructor(
    private readonly network: NetworkCapability,
    private readonly apiKeys: ApiKeyStore,
    private readonly getSettings: () => Promise<TmdbSettingsV1>,
    private readonly logger: ExtensionLogger
  ) {}

  /** Cheapest authenticated read; used by the settings connection test. */
  async verifyCredential(signal?: AbortSignal): Promise<void> {
    await this.request('/configuration', {}, { signal })
  }

  async searchMovies(
    query: string,
    options: TmdbSearchOptions = {}
  ): Promise<TmdbPaged<TmdbSearchMovie>> {
    return this.request('/search/movie', toSearchQuery(query, options), options)
  }

  async searchSeries(
    query: string,
    options: TmdbSearchOptions = {}
  ): Promise<TmdbPaged<TmdbSearchSeries>> {
    return this.request('/search/tv', toSearchQuery(query, options), options)
  }

  async searchPeople(
    query: string,
    options: TmdbSearchOptions = {}
  ): Promise<TmdbPaged<TmdbSearchPerson>> {
    return this.request('/search/person', toSearchQuery(query, options), options)
  }

  async searchCompanies(
    query: string,
    options: TmdbSearchOptions = {}
  ): Promise<TmdbPaged<TmdbSearchCompany>> {
    return this.request('/search/company', { query: query.trim(), page: options.page }, options)
  }

  async getMovie(movieId: number, options: TmdbRequestOptions = {}): Promise<TmdbMovieDetail> {
    return this.request(`/movie/${movieId}`, {}, options)
  }

  async getMovieImages(movieId: number, options: TmdbImageOptions = {}): Promise<TmdbImages> {
    return this.request(`/movie/${movieId}/images`, toImageQuery(options), {
      signal: options.signal
    })
  }

  async getMovieCredits(movieId: number, options: TmdbRequestOptions = {}): Promise<TmdbCredits> {
    return this.request(`/movie/${movieId}/credits`, {}, options)
  }

  async getMovieKeywords(
    movieId: number,
    options: TmdbRequestOptions = {}
  ): Promise<TmdbMovieKeywords> {
    return this.request(`/movie/${movieId}/keywords`, {}, { signal: options.signal })
  }

  async getCollection(
    collectionId: number,
    options: TmdbRequestOptions = {}
  ): Promise<TmdbCollectionDetail> {
    return this.request(`/collection/${collectionId}`, {}, options)
  }

  async getSeries(seriesId: number, options: TmdbRequestOptions = {}): Promise<TmdbSeriesDetail> {
    return this.request(`/tv/${seriesId}`, {}, options)
  }

  async getSeriesImages(seriesId: number, options: TmdbImageOptions = {}): Promise<TmdbImages> {
    return this.request(`/tv/${seriesId}/images`, toImageQuery(options), { signal: options.signal })
  }

  async getSeriesAggregateCredits(
    seriesId: number,
    options: TmdbRequestOptions = {}
  ): Promise<TmdbCredits> {
    return this.request(`/tv/${seriesId}/aggregate_credits`, {}, options)
  }

  async getSeriesKeywords(
    seriesId: number,
    options: TmdbRequestOptions = {}
  ): Promise<TmdbSeriesKeywords> {
    return this.request(`/tv/${seriesId}/keywords`, {}, { signal: options.signal })
  }

  async getSeriesExternalIds(
    seriesId: number,
    options: TmdbRequestOptions = {}
  ): Promise<TmdbExternalIds> {
    return this.request(`/tv/${seriesId}/external_ids`, {}, { signal: options.signal })
  }

  async getSeason(
    seriesId: number,
    seasonNumber: number,
    options: TmdbRequestOptions = {}
  ): Promise<TmdbSeasonDetail> {
    return this.request(`/tv/${seriesId}/season/${seasonNumber}`, {}, options)
  }

  async getSeasonImages(
    seriesId: number,
    seasonNumber: number,
    options: TmdbImageOptions = {}
  ): Promise<TmdbImages> {
    return this.request(`/tv/${seriesId}/season/${seasonNumber}/images`, toImageQuery(options), {
      signal: options.signal
    })
  }

  async getEpisodeGroups(
    seriesId: number,
    options: TmdbRequestOptions = {}
  ): Promise<TmdbEpisodeGroupsResponse> {
    return this.request(`/tv/${seriesId}/episode_groups`, {}, options)
  }

  async getEpisodeGroup(
    setId: string,
    options: TmdbRequestOptions = {}
  ): Promise<TmdbEpisodeGroupDetail> {
    return this.request(`/tv/episode_group/${encodeURIComponent(setId)}`, {}, options)
  }

  async getPerson(personId: number, options: TmdbRequestOptions = {}): Promise<TmdbPersonDetail> {
    return this.request(`/person/${personId}`, {}, options)
  }

  async getPersonImages(personId: number, options: TmdbRequestOptions = {}): Promise<TmdbImages> {
    return this.request(`/person/${personId}/images`, {}, { signal: options.signal })
  }

  async getCompany(
    companyId: number,
    options: TmdbRequestOptions = {}
  ): Promise<TmdbCompanyDetail> {
    return this.request(`/company/${companyId}`, {}, { signal: options.signal })
  }

  async getCompanyImages(companyId: number, options: TmdbRequestOptions = {}): Promise<TmdbImages> {
    return this.request(`/company/${companyId}/images`, {}, { signal: options.signal })
  }

  private async request<T>(
    pathname: string,
    query: Record<string, QueryValue>,
    options: TmdbRequestOptions
  ): Promise<T> {
    const settings = await this.getSettings()
    const credential = await this.apiKeys.getCredential()
    if (!credential) {
      throw new TmdbApiError('api_key_missing', m().errors.apiKeyMissing, { path: pathname })
    }

    const url = this.buildUrl(settings.endpoints.apiBaseUrl, pathname, {
      ...query,
      language: options.language,
      api_key: credential.mode === 'apiKey' ? credential.value : undefined
    })
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (credential.mode === 'bearer') {
      headers.Authorization = `Bearer ${credential.value}`
    }

    for (let attempt = 0; attempt <= settings.client.retryCount; attempt += 1) {
      throwIfAborted(options.signal)

      try {
        await this.limiter.acquire(options.signal)
        const response: NetworkResponse<T> = await this.network.request<T>(
          {
            url,
            method: 'GET',
            headers,
            timeoutMs: settings.client.timeoutMs,
            responseType: 'json'
          },
          omitUndefined({ signal: options.signal })
        )

        if (response.ok) {
          return response.data
        }

        const retryAfterMs = readRetryAfterMs(response.headers)
        if (shouldRetryStatus(response.status) && attempt < settings.client.retryCount) {
          await delay(resolveRetryDelayMs(attempt, retryAfterMs), options.signal)
          continue
        }

        throw normalizeTmdbApiError(response.status, pathname, retryAfterMs)
      } catch (error) {
        // Must precede the retry branch: a cancelled call is not a transient
        // fault and reissuing it would outlive the cancellation.
        if (isCancellationError(error)) {
          throw createCancellationError(m().errors.operationCancelled)
        }

        if (error instanceof TmdbExtensionError) {
          throw error
        }

        this.logger.debug('TMDB request attempt failed.', { path: pathname, attempt })
        if (attempt < settings.client.retryCount) {
          await delay(resolveRetryDelayMs(attempt), options.signal)
          continue
        }
      }
    }

    throw new TmdbApiError('network_failed', m().errors.networkFailed, { path: pathname })
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

function toSearchQuery(query: string, options: TmdbSearchOptions): Record<string, QueryValue> {
  return {
    query: query.trim(),
    page: options.page,
    include_adult: options.includeAdult ?? false
  }
}

function toImageQuery(options: TmdbImageOptions): Record<string, QueryValue> {
  const languages = options.imageLanguages
  return languages && languages.length > 0 ? { include_image_language: languages.join(',') } : {}
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function resolveRetryDelayMs(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs !== undefined) {
    return Math.min(60_000, Math.max(250, retryAfterMs))
  }
  return Math.min(10_000, 500 * 2 ** attempt)
}
