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
import type { MalSettingsV1 } from '../config/schema'
import { m } from '../i18n'
import { MAL_MIRROR_MAX_PAGES, MAL_MIRROR_RATE_LIMIT } from '../utils/constants'
import { MalExtensionError } from '../utils/errors'
import { omitUndefined } from '../utils/object'
import type { MirrorCharacterEdge, MirrorEpisode, MirrorPage, MirrorStaffEdge } from './types'

export interface MirrorRequestOptions {
  signal?: AbortSignal | undefined
}

/**
 * Client for the Jikan v4-compatible mirror (Tenrai by default) that serves
 * the slots the official API does not: characters, staff, and episodes.
 *
 * The mirror is an enrichment source, so `isEnabled` gates every consumer;
 * sessions skip these slots entirely when it is off.
 */
export class MalMirrorClient {
  private readonly limiter = new RateLimiter(MAL_MIRROR_RATE_LIMIT)

  constructor(
    private readonly network: NetworkCapability,
    private readonly getSettings: () => Promise<MalSettingsV1>,
    private readonly logger: ExtensionLogger
  ) {}

  async isEnabled(): Promise<boolean> {
    return (await this.getSettings()).endpoints.mirrorEnabled
  }

  async getAnimeCharacters(
    animeId: number,
    options: MirrorRequestOptions = {}
  ): Promise<MirrorCharacterEdge[]> {
    // Characters and staff arrive unpaginated on this endpoint family.
    const page = await this.request<MirrorPage<MirrorCharacterEdge>>(
      `anime/${animeId}/characters`,
      options
    )
    return page.data ?? []
  }

  async getAnimeStaff(
    animeId: number,
    options: MirrorRequestOptions = {}
  ): Promise<MirrorStaffEdge[]> {
    const page = await this.request<MirrorPage<MirrorStaffEdge>>(`anime/${animeId}/staff`, options)
    return page.data ?? []
  }

  async getAnimeEpisodes(
    animeId: number,
    options: MirrorRequestOptions = {}
  ): Promise<MirrorEpisode[]> {
    const episodes: MirrorEpisode[] = []

    for (let pageNumber = 1; pageNumber <= MAL_MIRROR_MAX_PAGES; pageNumber += 1) {
      const page = await this.request<MirrorPage<MirrorEpisode>>(
        `anime/${animeId}/episodes?page=${pageNumber}`,
        options
      )
      episodes.push(...(page.data ?? []))
      if (!page.pagination?.has_next_page) {
        break
      }
    }

    return episodes
  }

  async getMangaCharacters(
    mangaId: number,
    options: MirrorRequestOptions = {}
  ): Promise<MirrorCharacterEdge[]> {
    const page = await this.request<MirrorPage<MirrorCharacterEdge>>(
      `manga/${mangaId}/characters`,
      options
    )
    return page.data ?? []
  }

  private async request<T>(path: string, options: MirrorRequestOptions): Promise<T> {
    const settings = await this.getSettings()
    const url = `${settings.endpoints.mirrorUrl}/${path}`

    for (let attempt = 0; attempt <= settings.client.retryCount; attempt += 1) {
      throwIfAborted(options.signal)

      try {
        await this.limiter.acquire(options.signal)
        const response: NetworkResponse<T> = await this.network.request<T>(
          {
            url,
            method: 'GET',
            headers: { Accept: 'application/json' },
            timeoutMs: settings.client.timeoutMs,
            responseType: 'json'
          },
          omitUndefined({ signal: options.signal })
        )

        if (response.ok) {
          return response.data
        }

        if (response.status === 404) {
          throw new MalExtensionError('mal_not_found', m().errors.notFound)
        }

        if (
          attempt < settings.client.retryCount &&
          (response.status === 429 || response.status >= 500)
        ) {
          await delay(resolveRetryDelayMs(attempt), options.signal)
          continue
        }

        throw new MalExtensionError('mirror_unavailable', m().errors.mirrorUnavailable)
      } catch (error) {
        if (isCancellationError(error)) {
          throw createCancellationError(m().errors.operationCancelled)
        }

        if (error instanceof MalExtensionError) {
          throw error
        }

        this.logger.debug('MAL mirror request attempt failed.', { attempt })
        if (attempt < settings.client.retryCount) {
          await delay(resolveRetryDelayMs(attempt), options.signal)
          continue
        }
      }
    }

    throw new MalExtensionError('mirror_unavailable', m().errors.mirrorUnavailable)
  }
}

function resolveRetryDelayMs(attempt: number): number {
  return Math.min(10_000, 500 * 2 ** attempt)
}
