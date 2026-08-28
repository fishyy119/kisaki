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
import type { SessionStore } from '../auth/session-store'
import type { NeodbSettingsV1 } from '../config/schema'
import { m } from '../i18n'
import { NEODB_RATE_LIMIT } from '../utils/constants'
import { NeodbExtensionError } from '../utils/errors'
import type { NdBook, NdItem, NdMark, NdPagedResponse, NdShelfType, NdUser } from './types'

type AuthMode = 'public' | 'required'

export interface NeodbRequestOptions {
  signal?: AbortSignal | undefined
}

/**
 * Client for the NeoDB API.
 *
 * Catalog reads hit the instance the settings state; account reads and shelf
 * writes hit the instance the stored sign-in is bound to, so changing the
 * settings instance never sends a token to the wrong host.
 */
export class NeodbClient {
  private readonly limiter = new RateLimiter(NEODB_RATE_LIMIT)

  constructor(
    private readonly network: NetworkCapability,
    private readonly sessions: SessionStore,
    private readonly getSettings: () => Promise<NeodbSettingsV1>,
    private readonly logger: ExtensionLogger
  ) {}

  async searchBooks(
    query: string,
    page: number,
    options: NeodbRequestOptions = {}
  ): Promise<NdPagedResponse<NdItem>> {
    const settings = await this.getSettings()
    const url = new URL(`${settings.endpoints.instanceUrl}/api/catalog/search`)
    url.searchParams.set('query', query)
    url.searchParams.set('category', 'book')
    url.searchParams.set('page', String(page))

    return this.request<NdPagedResponse<NdItem>>(url.toString(), 'public', options)
  }

  async getBook(uuid: string, options: NeodbRequestOptions = {}): Promise<NdBook> {
    const settings = await this.getSettings()
    return this.request<NdBook>(
      `${settings.endpoints.instanceUrl}/api/book/${uuid}`,
      'public',
      options
    )
  }

  /** Identifies the signed-in account; used by verification and the flows. */
  async getOwnUser(options: NeodbRequestOptions = {}): Promise<NdUser> {
    const instanceUrl = await this.requireSessionInstance()
    return this.request<NdUser>(`${instanceUrl}/api/me`, 'required', options)
  }

  async getShelfPage(
    type: NdShelfType,
    page: number,
    options: NeodbRequestOptions = {}
  ): Promise<NdPagedResponse<NdMark>> {
    const instanceUrl = await this.requireSessionInstance()
    const url = new URL(`${instanceUrl}/api/me/shelf/${type}`)
    url.searchParams.set('category', 'book')
    url.searchParams.set('page', String(page))

    return this.request<NdPagedResponse<NdMark>>(url.toString(), 'required', options)
  }

  async markItem(
    itemUuid: string,
    mark: { shelfType: NdShelfType; visibility: number; ratingGrade?: number },
    options: NeodbRequestOptions = {}
  ): Promise<void> {
    const instanceUrl = await this.requireSessionInstance()
    await this.request<unknown>(
      `${instanceUrl}/api/me/shelf/item/${itemUuid}`,
      'required',
      options,
      {
        method: 'POST',
        body: JSON.stringify({
          shelf_type: mark.shelfType,
          visibility: mark.visibility,
          ...(mark.ratingGrade !== undefined ? { rating_grade: mark.ratingGrade } : {})
        })
      }
    )
  }

  private async requireSessionInstance(): Promise<string> {
    const session = await this.sessions.getSession()
    if (!session) {
      throw new NeodbExtensionError('auth_required', m().errors.authRequired)
    }
    return session.instanceUrl
  }

  private async request<T>(
    url: string,
    auth: AuthMode,
    options: NeodbRequestOptions,
    write?: { method: 'POST'; body: string }
  ): Promise<T> {
    const settings = await this.getSettings()

    const headers: Record<string, string> = { Accept: 'application/json' }
    if (auth === 'required') {
      const session = await this.sessions.getSession()
      if (!session) {
        throw new NeodbExtensionError('auth_required', m().errors.authRequired)
      }
      headers.Authorization = `Bearer ${session.accessToken}`
    }
    if (write) {
      headers['Content-Type'] = 'application/json'
    }

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

        if (error instanceof NeodbExtensionError) {
          throw error
        }

        this.logger.debug('NeoDB request attempt failed.', { attempt })
        if (attempt < settings.client.retryCount) {
          await delay(resolveRetryDelayMs(attempt), options.signal)
          continue
        }
      }
    }

    throw new NeodbExtensionError('network_failed', m().errors.networkFailed)
  }

  private classifyError(status: number): NeodbExtensionError {
    if (status === 401 || status === 403) {
      return new NeodbExtensionError('auth_rejected', m().errors.tokenRejected)
    }
    if (status === 404) {
      return new NeodbExtensionError('neodb_not_found', m().errors.notFound)
    }
    if (status === 429) {
      return new NeodbExtensionError('neodb_rate_limited', m().errors.rateLimited)
    }
    if (status >= 400 && status < 500) {
      return new NeodbExtensionError('neodb_rejected', m().errors.rejected)
    }
    return new NeodbExtensionError('network_failed', m().errors.unavailable)
  }
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function resolveRetryDelayMs(attempt: number): number {
  return Math.min(10_000, 500 * 2 ** attempt)
}
