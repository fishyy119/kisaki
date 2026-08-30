import { setTimeout as delay } from 'node:timers/promises'
import {
  type ExtensionLogger,
  type NetworkCapability,
  type NetworkResponse
} from '@kisaki3/extension-sdk'
import { RateLimiter } from '../utils/rate-limiter'
import { IgdbApiError, normalizeIgdbApiError } from './errors'
import type { IgdbTokenResponse } from './types'
import type { CredentialStore } from '../auth/credentials'
import type { IgdbSettingsV1 } from '../config/schema'
import { m } from '../i18n'
import { IGDB_ID_CHUNK_SIZE, IGDB_QUERY_LIMIT, IGDB_USER_AGENT } from '../utils/constants'
import { IgdbExtensionError } from '../utils/errors'
import { chunk } from '../utils/object'

/** Official limits: 4 requests per second, at most 8 open requests. */
const RATE_LIMIT: { maxRequests: number; windowMs: number; maxConcurrent: number } = {
  maxRequests: 4,
  windowMs: 1_000,
  maxConcurrent: 8
}

/** Refresh a little before expiry so a request never races the deadline. */
const TOKEN_REFRESH_MARGIN_MS = 60_000

export interface IgdbRequestOptions {
  signal?: AbortSignal | undefined
}

export class IgdbClient {
  private readonly limiter = new RateLimiter(RATE_LIMIT)
  private accessToken: string | null = null
  private tokenExpiry = 0
  /** Client the cached token was issued for; a credential change invalidates it. */
  private tokenClientId: string | null = null

  constructor(
    private readonly network: NetworkCapability,
    private readonly credentials: CredentialStore,
    private readonly getSettings: () => Promise<IgdbSettingsV1>,
    private readonly logger: ExtensionLogger
  ) {}

  /** Whether a Twitch client is stored; IGDB has no anonymous access. */
  async isConfigured(): Promise<boolean> {
    return (await this.credentials.getCredential()) !== undefined
  }

  /** Cheapest authenticated round trip; used by the settings connection test. */
  async verifyCredential(signal?: AbortSignal): Promise<void> {
    this.invalidateToken()
    await this.requireAccessToken({ signal })
  }

  /** Drops the cached token so the next request authenticates afresh. */
  invalidateToken(): void {
    this.accessToken = null
    this.tokenExpiry = 0
    this.tokenClientId = null
  }

  /** Runs one Apicalypse query against an IGDB endpoint. */
  async query<T>(endpoint: string, body: string, options: IgdbRequestOptions = {}): Promise<T[]> {
    return this.request<T[]>(endpoint, body, options)
  }

  /** Reads rows by id, chunked so no single query exceeds the length limit. */
  async queryByIds<T>(
    endpoint: string,
    ids: readonly (number | null | undefined)[],
    fields: string,
    options: IgdbRequestOptions = {}
  ): Promise<T[]> {
    const uniqueIds = [
      ...new Set(ids.filter((id): id is number => Number.isInteger(id) && (id as number) > 0))
    ]
    if (uniqueIds.length === 0) {
      return []
    }

    const rows: T[] = []
    for (const group of chunk(uniqueIds, IGDB_ID_CHUNK_SIZE)) {
      rows.push(
        ...(await this.query<T>(
          endpoint,
          `fields ${fields}; where id = (${group.join(',')}); limit ${clampLimit(group.length)};`,
          options
        ))
      )
    }

    return rows
  }

  private async request<T>(
    endpoint: string,
    body: string,
    options: IgdbRequestOptions
  ): Promise<T> {
    const settings = await this.getSettings()
    let refreshedToken = false

    for (let attempt = 0; attempt <= settings.client.retryCount; attempt += 1) {
      options.signal?.throwIfAborted()

      try {
        const credential = await this.requireCredential()
        const token = await this.requireAccessToken(options)
        const response = await this.limiter.run(
          () =>
            this.network.request<T>(
              {
                url: `${settings.endpoints.apiBaseUrl}/${endpoint}`,
                method: 'POST',
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'text/plain',
                  'Client-ID': credential.clientId,
                  Authorization: `Bearer ${token}`,
                  'User-Agent': IGDB_USER_AGENT
                },
                body,
                timeoutMs: settings.client.timeoutMs,
                responseType: 'json'
              },
              { signal: options.signal }
            ),
          options.signal
        )

        // An expired token reads as a rejected request, so retry it once with
        // a fresh one before treating the rejection as final.
        if (response.status === 401 && !refreshedToken) {
          refreshedToken = true
          this.invalidateToken()
          continue
        }

        if (!response.ok) {
          if (shouldRetryStatus(response.status) && attempt < settings.client.retryCount) {
            await delay(resolveRetryDelayMs(attempt), undefined, { signal: options.signal })
            continue
          }

          throw normalizeIgdbApiError(response.status, endpoint)
        }

        return response.data
      } catch (error) {
        // Must precede the retry branch: a cancelled call is not a transient
        // fault and reissuing it would outlive the cancellation.
        if (options.signal?.aborted) {
          throw error
        }

        if (error instanceof IgdbExtensionError) {
          throw error
        }

        this.logger.debug('IGDB request attempt failed.', { endpoint, attempt })
        if (attempt < settings.client.retryCount) {
          await delay(resolveRetryDelayMs(attempt), undefined, { signal: options.signal })
          continue
        }
      }
    }

    throw new IgdbApiError('network_failed', m().errors.networkFailed, { path: endpoint })
  }

  /**
   * Only the token value is cached, never the in-flight request: sharing the
   * promise would let one invocation's cancellation reject another's await.
   */
  private async requireAccessToken(options: IgdbRequestOptions): Promise<string> {
    const credential = await this.requireCredential()
    const now = Date.now()
    if (
      this.accessToken &&
      this.tokenClientId === credential.clientId &&
      this.tokenExpiry > now + TOKEN_REFRESH_MARGIN_MS
    ) {
      return this.accessToken
    }

    const settings = await this.getSettings()
    const url = new URL(settings.endpoints.oauthUrl)
    url.searchParams.set('client_id', credential.clientId)
    url.searchParams.set('client_secret', credential.clientSecret)
    url.searchParams.set('grant_type', 'client_credentials')

    const response: NetworkResponse<IgdbTokenResponse> = await this.limiter.run(
      () =>
        this.network.request<IgdbTokenResponse>(
          {
            url: url.toString(),
            method: 'POST',
            headers: { Accept: 'application/json', 'User-Agent': IGDB_USER_AGENT },
            timeoutMs: settings.client.timeoutMs,
            responseType: 'json'
          },
          { signal: options.signal }
        ),
      options.signal
    )

    if (!response.ok) {
      throw normalizeIgdbApiError(response.status, 'oauth')
    }

    const accessToken = response.data?.access_token?.trim()
    if (!accessToken) {
      throw new IgdbApiError('credential_invalid', m().errors.credentialInvalid, { path: 'oauth' })
    }

    const expiresIn = Number(response.data.expires_in)
    this.accessToken = accessToken
    this.tokenExpiry =
      Date.now() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1_000 : 0)
    this.tokenClientId = credential.clientId
    return accessToken
  }

  private async requireCredential(): Promise<{ clientId: string; clientSecret: string }> {
    const credential = await this.credentials.getCredential()
    if (!credential) {
      throw new IgdbExtensionError('credential_missing', m().errors.credentialMissing)
    }
    return credential
  }
}

export function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return 1
  }
  return Math.max(1, Math.min(Math.floor(limit), IGDB_QUERY_LIMIT))
}

/** Apicalypse strings are double-quoted, so quotes and escapes must be escaped. */
export function escapeApicalypseString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function resolveRetryDelayMs(attempt: number): number {
  return Math.min(10_000, 500 * 2 ** attempt)
}
