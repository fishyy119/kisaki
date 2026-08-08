/**
 * IGDB API Client
 *
 * Base URL: https://api.igdb.com/v4
 * Auth: Twitch OAuth Client Credentials + Client-ID header
 *
 * Docs:
 * - https://api-docs.igdb.com/
 * - https://igdb-openapi.s-crypt.co/IGDB-OpenAPI.yaml
 */

import { Semaphore } from '@main/utils/async'
import type { NetworkService } from '@main/services/network'
import { createProviderHttpError } from '../../../../shared'
import { clampLimit } from './format'
import type { IgdbTokenResponse } from './types'

const RATE_LIMIT_KEY = 'igdb'
// Official docs: 4 requests per second.
const RATE_LIMIT_CONFIG = { maxRequests: 4, windowMs: 1000 }
// Official docs: at most 8 open requests.
const MAX_CONCURRENT_REQUESTS = 8

const BASE_URL = 'https://api.igdb.com/v4'
const OAUTH_URL = 'https://id.twitch.tv/oauth2/token'
const USER_AGENT = 'kisaki/1.0'

/** Credentials, auth token, and request slots shared by every bound client view. */
interface IgdbClientState {
  network: NetworkService
  clientId?: string
  clientSecret?: string
  requestSlots: Semaphore
  accessToken: string | null
  tokenExpiry: number
  rateLimitRegistered: boolean
}

export class IgdbClient {
  private constructor(
    private readonly state: IgdbClientState,
    private readonly signal?: AbortSignal
  ) {}

  static create(network: NetworkService, clientId?: string, clientSecret?: string): IgdbClient {
    return new IgdbClient({
      network,
      clientId,
      clientSecret,
      requestSlots: new Semaphore(MAX_CONCURRENT_REQUESTS),
      accessToken: null,
      tokenExpiry: 0,
      rateLimitRegistered: false
    })
  }

  /**
   * View bound to one invocation's cancellation scope. Auth token and request
   * slots stay shared, so every request a provider makes for that invocation is
   * cancellable without the call sites carrying a signal.
   */
  withSignal(signal: AbortSignal | undefined): IgdbClient {
    return new IgdbClient(this.state, signal)
  }

  isConfigured(): boolean {
    return !!this.state.clientId?.trim() && !!this.state.clientSecret?.trim()
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error(
        'IGDB credentials are missing. Set VITE_IGDB_API_CLIENT_ID and VITE_IGDB_API_CLIENT_SECRET.'
      )
    }
  }

  private ensureRateLimitRegistered(): void {
    if (!this.state.rateLimitRegistered) {
      this.state.network.rateLimits.register(RATE_LIMIT_KEY, RATE_LIMIT_CONFIG)
      this.state.rateLimitRegistered = true
    }
  }

  private async getAccessToken(): Promise<string> {
    this.ensureConfigured()
    const now = Date.now()

    if (this.state.accessToken && this.state.tokenExpiry > now + 60_000) {
      return this.state.accessToken
    }

    this.ensureRateLimitRegistered()

    const clientId = encodeURIComponent(this.state.clientId!.trim())
    const clientSecret = encodeURIComponent(this.state.clientSecret!.trim())
    const url = `${OAUTH_URL}?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`

    const response = await this.state.requestSlots.run(
      () =>
        this.state.network.request.fetch(url, {
          method: 'POST',
          rateLimitKey: RATE_LIMIT_KEY,
          signal: this.signal
        }),
      this.signal
    )

    if (!response.ok) {
      throw createProviderHttpError('IGDB', 'OAuth', response)
    }

    const data = (await response.json()) as IgdbTokenResponse
    this.state.accessToken = data.access_token
    this.state.tokenExpiry = now + data.expires_in * 1000
    return data.access_token
  }

  private async request<T>(endpoint: string, body: string): Promise<T[]> {
    this.ensureConfigured()
    this.ensureRateLimitRegistered()

    const execute = async (retryOnUnauthorized: boolean): Promise<T[]> => {
      const token = await this.getAccessToken()
      const response = await this.state.requestSlots.run(
        () =>
          this.state.network.request.fetch(`${BASE_URL}/${endpoint}`, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'text/plain',
              'Client-ID': this.state.clientId!.trim(),
              Authorization: `Bearer ${token}`,
              'User-Agent': USER_AGENT
            },
            body,
            rateLimitKey: RATE_LIMIT_KEY,
            signal: this.signal
          }),
        this.signal
      )

      if (response.status === 401 && retryOnUnauthorized) {
        this.state.accessToken = null
        this.state.tokenExpiry = 0
        return execute(false)
      }

      if (!response.ok) {
        throw createProviderHttpError('IGDB', 'API request', response)
      }

      return response.json() as Promise<T[]>
    }

    return execute(true)
  }

  async query<T>(endpoint: string, body: string): Promise<T[]> {
    return this.request<T>(endpoint, body)
  }

  async queryByIds<T>(endpoint: string, ids: number[], fields: string): Promise<T[]> {
    const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))]
    if (uniqueIds.length === 0) return []

    const chunkSize = 200
    const all: T[] = []

    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
      const chunk = uniqueIds.slice(i, i + chunkSize)
      const body = `fields ${fields}; where id = (${chunk.join(',')}); limit ${clampLimit(chunk.length)};`
      const data = await this.request<T>(endpoint, body)
      all.push(...data)
    }

    return all
  }
}
