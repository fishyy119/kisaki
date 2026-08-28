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
import type { TokenService } from '../auth/token-service'
import type { TokenStore } from '../auth/token-store'
import type { GbooksSettingsV1 } from '../config/schema'
import { m } from '../i18n'
import { GBOOKS_API_URL, GBOOKS_RATE_LIMIT, GBOOKS_SHELF_PAGE_SIZE } from '../utils/constants'
import { GbooksExtensionError } from '../utils/errors'
import type { GbVolume, GbVolumesResponse } from './types'

type AuthMode = 'public' | 'required'

export interface GbooksRequestOptions {
  signal?: AbortSignal | undefined
}

/**
 * Client for the Google Books API v1.
 *
 * Public volume reads work without any credential on a low shared quota; a
 * stored personal API key rides along to raise it. Library reads carry the
 * OAuth bearer token the token service keeps fresh through the relay.
 */
export class GbooksClient {
  private readonly limiter = new RateLimiter(GBOOKS_RATE_LIMIT)

  constructor(
    private readonly network: NetworkCapability,
    private readonly tokens: TokenService,
    private readonly tokenStore: TokenStore,
    private readonly getSettings: () => Promise<GbooksSettingsV1>,
    private readonly logger: ExtensionLogger
  ) {}

  /** Volume search with the given `q` expression (`intitle:`, `isbn:`, ...). */
  async searchVolumes(
    q: string,
    limit: number,
    options: GbooksRequestOptions = {}
  ): Promise<GbVolume[]> {
    const query = new URLSearchParams({
      q,
      maxResults: String(limit),
      printType: 'books'
    })

    const response = await this.request<GbVolumesResponse>(
      `volumes?${query.toString()}`,
      'public',
      options
    )
    return response.items ?? []
  }

  async getVolume(volumeId: string, options: GbooksRequestOptions = {}): Promise<GbVolume> {
    return this.request<GbVolume>(`volumes/${encodeURIComponent(volumeId)}`, 'public', options)
  }

  /** One page of an own bookshelf; needs the signed-in account. */
  async getShelfVolumesPage(
    shelfId: number,
    startIndex: number,
    options: GbooksRequestOptions = {}
  ): Promise<GbVolumesResponse> {
    const query = new URLSearchParams({
      maxResults: String(GBOOKS_SHELF_PAGE_SIZE),
      startIndex: String(startIndex)
    })

    return this.request<GbVolumesResponse>(
      `mylibrary/bookshelves/${shelfId}/volumes?${query.toString()}`,
      'required',
      options
    )
  }

  private async request<T>(
    path: string,
    auth: AuthMode,
    options: GbooksRequestOptions
  ): Promise<T> {
    const settings = await this.getSettings()

    const headers: Record<string, string> = { Accept: 'application/json' }
    let url = `${GBOOKS_API_URL}/${path}`

    if (auth === 'required') {
      headers.Authorization = `Bearer ${await this.tokens.getFreshAccessToken(options.signal)}`
    } else {
      const apiKey = await this.tokenStore.getApiKey()
      if (apiKey) {
        url += `${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`
      }
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
          options.signal ? { signal: options.signal } : {}
        )

        if (response.ok) {
          return response.data
        }

        // The shared keyless pool reports exhaustion as 429; retrying within
        // one run cannot help, so it classifies immediately.
        if (response.status >= 500 && attempt < settings.client.retryCount) {
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

        if (error instanceof GbooksExtensionError) {
          throw error
        }

        this.logger.debug('Google Books request attempt failed.', { attempt })
        if (attempt < settings.client.retryCount) {
          await delay(resolveRetryDelayMs(attempt), options.signal)
          continue
        }
      }
    }

    throw new GbooksExtensionError('network_failed', m().errors.networkFailed)
  }

  private classifyError(status: number): GbooksExtensionError {
    if (status === 401 || status === 403) {
      return new GbooksExtensionError('auth_expired', m().errors.tokenExpired)
    }
    if (status === 404) {
      return new GbooksExtensionError('gbooks_not_found', m().errors.notFound)
    }
    if (status === 429) {
      return new GbooksExtensionError('gbooks_rate_limited', m().errors.rateLimited)
    }
    if (status >= 400 && status < 500) {
      return new GbooksExtensionError('gbooks_rejected', m().errors.rejected)
    }
    return new GbooksExtensionError('network_failed', m().errors.unavailable)
  }
}

function resolveRetryDelayMs(attempt: number): number {
  return Math.min(10_000, 500 * 2 ** attempt)
}
