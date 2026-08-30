import { setTimeout as delay } from 'node:timers/promises'
import {
  type ExtensionLogger,
  type ExtensionSecrets,
  type NetworkCapability,
  type NetworkResponse
} from '@kisaki3/extension-sdk'
import { RateLimiter } from '../utils/rate-limiter'
import type { SteamSettingsV1 } from '../config/schema'
import { m } from '../i18n'
import { STEAM_RATE_LIMIT, STEAM_STORE_API_URL, STEAM_WEB_API_URL } from '../utils/constants'
import { SteamExtensionError } from '../utils/errors'
import { STEAM_SECRET_KEYS } from '../utils/ids'
import type { AppDetailsCache } from './cache'
import type {
  SteamAppDetails,
  SteamAppDetailsResponse,
  SteamOwnedGame,
  SteamOwnedGamesResponse,
  SteamSearchItem,
  SteamSearchResponse
} from './types'

export interface SteamRequestOptions {
  signal?: AbortSignal | undefined
}

/**
 * Client for the Steam store API and the personal Web API.
 *
 * Store reads are paced hard and cached, because Steam's undocumented budget
 * (about 200 requests per five minutes) throttles by IP. The Web API key
 * lives in the secret store and is only attached to `GetOwnedGames`.
 */
export class SteamClient {
  private readonly limiter = new RateLimiter(STEAM_RATE_LIMIT)

  constructor(
    private readonly network: NetworkCapability,
    private readonly secrets: ExtensionSecrets,
    private readonly cache: AppDetailsCache,
    private readonly getSettings: () => Promise<SteamSettingsV1>,
    private readonly logger: ExtensionLogger
  ) {}

  async hasWebApiKey(): Promise<boolean> {
    return typeof (await this.secrets.get(STEAM_SECRET_KEYS.webApiKey)) === 'string'
  }

  async setWebApiKey(key: string): Promise<void> {
    await this.secrets.set(STEAM_SECRET_KEYS.webApiKey, key)
  }

  async clearWebApiKey(): Promise<void> {
    await this.secrets.delete(STEAM_SECRET_KEYS.webApiKey)
  }

  async searchStore(
    term: string,
    language: string,
    options: SteamRequestOptions = {}
  ): Promise<SteamSearchItem[]> {
    const query = new URLSearchParams({ term, l: language, cc: 'US' })
    const response = await this.request<SteamSearchResponse>(
      `${STEAM_STORE_API_URL}/storesearch?${query.toString()}`,
      options
    )
    return response.items ?? []
  }

  /** App details in the given store language; cached within the TTL. */
  async getAppDetails(
    appId: number,
    language: string,
    options: SteamRequestOptions = {}
  ): Promise<SteamAppDetails> {
    const cached = await this.cache.get(appId, language)
    if (cached) {
      return cached
    }

    const query = new URLSearchParams({ appids: String(appId), l: language })
    const response = await this.request<SteamAppDetailsResponse>(
      `${STEAM_STORE_API_URL}/appdetails?${query.toString()}`,
      options
    )

    const envelope = response[String(appId)]
    if (!envelope?.success || !envelope.data) {
      throw new SteamExtensionError('steam_not_found', m().errors.notFound)
    }

    await this.cache.set(appId, language, envelope.data)
    return envelope.data
  }

  /** Owned games of the configured account, via the personal Web API key. */
  async getOwnedGames(options: SteamRequestOptions = {}): Promise<SteamOwnedGame[]> {
    const key = await this.secrets.get(STEAM_SECRET_KEYS.webApiKey)
    if (typeof key !== 'string' || !key.trim()) {
      throw new SteamExtensionError('key_required', m().errors.keyRequired)
    }

    const settings = await this.getSettings()
    if (!settings.account.steamId) {
      throw new SteamExtensionError('steam_id_invalid', m().errors.steamIdInvalid)
    }

    const query = new URLSearchParams({
      key: key.trim(),
      steamid: settings.account.steamId,
      include_appinfo: '1',
      include_played_free_games: '1',
      format: 'json'
    })
    const response = await this.request<SteamOwnedGamesResponse>(
      `${STEAM_WEB_API_URL}/IPlayerService/GetOwnedGames/v1/?${query.toString()}`,
      options,
      { keyBearing: true }
    )

    const games = response.response?.games
    if (!games || games.length === 0) {
      // An empty object response is how Steam reports a private profile.
      throw new SteamExtensionError('profile_not_visible', m().errors.profileNotVisible)
    }
    return games
  }

  private async request<T>(
    url: string,
    options: SteamRequestOptions,
    flags: { keyBearing?: boolean } = {}
  ): Promise<T> {
    const settings = await this.getSettings()

    for (let attempt = 0; attempt <= settings.client.retryCount; attempt += 1) {
      options.signal?.throwIfAborted()

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
          options.signal ? { signal: options.signal } : {}
        )

        if (response.ok) {
          return response.data
        }

        if (shouldRetryStatus(response.status) && attempt < settings.client.retryCount) {
          await delay(resolveRetryDelayMs(attempt), undefined, { signal: options.signal })
          continue
        }

        throw this.classifyError(response.status, flags.keyBearing === true)
      } catch (error) {
        // Must precede the retry branch: a cancelled call is not a transient
        // fault and reissuing it would outlive the cancellation.
        if (options.signal?.aborted) {
          throw error
        }

        if (error instanceof SteamExtensionError) {
          throw error
        }

        this.logger.debug('Steam request attempt failed.', { attempt })
        if (attempt < settings.client.retryCount) {
          await delay(resolveRetryDelayMs(attempt), undefined, { signal: options.signal })
          continue
        }
      }
    }

    throw new SteamExtensionError('network_failed', m().errors.networkFailed)
  }

  private classifyError(status: number, keyBearing: boolean): SteamExtensionError {
    if (keyBearing && (status === 401 || status === 403)) {
      return new SteamExtensionError('key_rejected', m().errors.keyRejected)
    }
    if (status === 404) {
      return new SteamExtensionError('steam_not_found', m().errors.notFound)
    }
    if (status === 429) {
      return new SteamExtensionError('steam_rate_limited', m().errors.rateLimited)
    }
    if (status >= 400 && status < 500) {
      return new SteamExtensionError('steam_rejected', m().errors.rejected)
    }
    return new SteamExtensionError('network_failed', m().errors.unavailable)
  }
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function resolveRetryDelayMs(attempt: number): number {
  return Math.min(10_000, 500 * 2 ** attempt)
}
