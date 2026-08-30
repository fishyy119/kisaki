import { setTimeout as delay } from 'node:timers/promises'
import {
  type ExtensionLogger,
  type ExtensionSecrets,
  type NetworkCapability,
  type NetworkResponse
} from '@kisaki3/extension-sdk'
import { RateLimiter } from '../utils/rate-limiter'
import type { SgdbSettingsV1 } from '../config/schema'
import { m } from '../i18n'
import {
  SGDB_API_URL,
  SGDB_ART_RESULT_LIMIT,
  SGDB_COVER_DIMENSIONS,
  SGDB_RATE_LIMIT
} from '../utils/constants'
import { SgdbExtensionError } from '../utils/errors'
import { SGDB_SECRET_KEYS } from '../utils/ids'
import type { SgdbArtwork, SgdbEntityResponse, SgdbGame, SgdbListResponse } from './types'

export type SgdbArtKind = 'grids' | 'heroes' | 'logos' | 'icons'

export interface SgdbRequestOptions {
  signal?: AbortSignal | undefined
}

/**
 * Client for the SteamGridDB API v2.
 *
 * Every call carries the personal API key as a bearer token; art listings are
 * bounded and filtered to static images, with NSFW inclusion controlled by
 * settings.
 */
export class SgdbClient {
  private readonly limiter = new RateLimiter(SGDB_RATE_LIMIT)

  constructor(
    private readonly network: NetworkCapability,
    private readonly secrets: ExtensionSecrets,
    private readonly getSettings: () => Promise<SgdbSettingsV1>,
    private readonly logger: ExtensionLogger
  ) {}

  async hasApiKey(): Promise<boolean> {
    return typeof (await this.secrets.get(SGDB_SECRET_KEYS.apiKey)) === 'string'
  }

  async setApiKey(key: string): Promise<void> {
    await this.secrets.set(SGDB_SECRET_KEYS.apiKey, key)
  }

  async clearApiKey(): Promise<void> {
    await this.secrets.delete(SGDB_SECRET_KEYS.apiKey)
  }

  async searchGames(term: string, options: SgdbRequestOptions = {}): Promise<SgdbGame[]> {
    const response = await this.request<SgdbListResponse<SgdbGame>>(
      `search/autocomplete/${encodeURIComponent(term)}`,
      options
    )
    return response.data ?? []
  }

  /** SteamGridDB entry for a Steam app id — the id bridge. */
  async getGameBySteamAppId(appId: number, options: SgdbRequestOptions = {}): Promise<SgdbGame> {
    const response = await this.request<SgdbEntityResponse<SgdbGame>>(
      `games/steam/${appId}`,
      options
    )
    if (!response.data) {
      throw new SgdbExtensionError('sgdb_not_found', m().errors.notFound)
    }
    return response.data
  }

  /** Static artwork URLs of one kind, best-voted first. */
  async listArtwork(
    kind: SgdbArtKind,
    gameId: number,
    options: SgdbRequestOptions = {}
  ): Promise<SgdbArtwork[]> {
    const settings = await this.getSettings()
    const query = new URLSearchParams({
      types: 'static',
      nsfw: settings.art.includeNsfw ? 'any' : 'false',
      limit: String(SGDB_ART_RESULT_LIMIT)
    })
    if (kind === 'grids') {
      query.set('dimensions', SGDB_COVER_DIMENSIONS)
    }

    const response = await this.request<SgdbListResponse<SgdbArtwork>>(
      `${kind}/game/${gameId}?${query.toString()}`,
      options
    )
    return response.data ?? []
  }

  private async request<T>(path: string, options: SgdbRequestOptions): Promise<T> {
    const key = await this.secrets.get(SGDB_SECRET_KEYS.apiKey)
    if (typeof key !== 'string' || !key.trim()) {
      throw new SgdbExtensionError('key_required', m().errors.keyRequired)
    }

    const settings = await this.getSettings()
    const url = `${SGDB_API_URL}/${path}`

    for (let attempt = 0; attempt <= settings.client.retryCount; attempt += 1) {
      options.signal?.throwIfAborted()

      try {
        await this.limiter.acquire(options.signal)
        const response: NetworkResponse<T> = await this.network.request<T>(
          {
            url,
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${key.trim()}`
            },
            timeoutMs: settings.client.timeoutMs,
            responseType: 'json'
          },
          options.signal ? { signal: options.signal } : {}
        )

        if (response.ok) {
          return response.data
        }

        if (shouldRetryStatus(response.status) && attempt < settings.client.retryCount) {
          await delay(resolveRetryDelayMs(attempt), undefined, { signal: options.signal })
          continue
        }

        throw this.classifyError(response.status)
      } catch (error) {
        // Must precede the retry branch: a cancelled call is not a transient
        // fault and reissuing it would outlive the cancellation.
        if (options.signal?.aborted) {
          throw error
        }

        if (error instanceof SgdbExtensionError) {
          throw error
        }

        this.logger.debug('SteamGridDB request attempt failed.', { attempt })
        if (attempt < settings.client.retryCount) {
          await delay(resolveRetryDelayMs(attempt), undefined, { signal: options.signal })
          continue
        }
      }
    }

    throw new SgdbExtensionError('network_failed', m().errors.networkFailed)
  }

  private classifyError(status: number): SgdbExtensionError {
    if (status === 401 || status === 403) {
      return new SgdbExtensionError('key_rejected', m().errors.keyRejected)
    }
    if (status === 404) {
      return new SgdbExtensionError('sgdb_not_found', m().errors.notFound)
    }
    if (status === 429) {
      return new SgdbExtensionError('sgdb_rate_limited', m().errors.rateLimited)
    }
    if (status >= 400 && status < 500) {
      return new SgdbExtensionError('sgdb_rejected', m().errors.rejected)
    }
    return new SgdbExtensionError('network_failed', m().errors.unavailable)
  }
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function resolveRetryDelayMs(attempt: number): number {
  return Math.min(10_000, 500 * 2 ** attempt)
}
