/**
 * Bangumi API Client
 *
 * HTTP client for Bangumi v0 API.
 *
 * References:
 * - https://bangumi.github.io/api/
 * - https://bangumi.github.io/api/dist.json
 * - https://github.com/bangumi/api/
 */

import type { NetworkCapability, SerializableValue } from '@kisaki/extension-sdk'
import type {
  BangumiCharacterDetail,
  BangumiCharacterPerson,
  BangumiEntityImageType,
  BangumiImageType,
  BangumiPaged,
  BangumiRelatedCharacter,
  BangumiRelatedPerson,
  BangumiSearchSubjectPayload,
  BangumiSubject,
  BangumiSubjectRelation,
  BangumiPersonDetail
} from './types'
import type { BangumiSettingsV1 } from '../config/schema'

// No official public rate limit in docs. Keep a conservative limit.
const DEFAULT_RATE_LIMIT_CONFIG = { maxRequests: 120, windowMs: 60_000 }

type BangumiRateLimitConfig = BangumiSettingsV1['client']['rateLimit']

export class BangumiClient {
  private readonly baseUrl = 'https://api.bgm.tv'
  private readonly userAgent = 'ximu3/Kisaki/0.0.1 (https://github.com/ximu3/kisaki)'
  private readonly requestTimestamps: number[] = []
  private rateLimitQueue = Promise.resolve()

  constructor(
    private readonly network: NetworkCapability,
    private readonly getAccessToken?: () => Promise<string | undefined>,
    private readonly getRateLimitConfig?: () => Promise<BangumiRateLimitConfig>
  ) {}

  private buildUrl(pathname: string, query?: Record<string, string | number | boolean>): string {
    const url = new URL(pathname, this.baseUrl)
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue
        url.searchParams.set(key, String(value))
      }
    }
    return url.toString()
  }

  private async buildHeaders(method: 'GET' | 'POST'): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': this.userAgent
    }

    if (method === 'POST') {
      headers['Content-Type'] = 'application/json'
    }

    const accessToken = (await this.getAccessToken?.())?.trim()
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    return headers
  }

  private async acquireRateLimit(): Promise<void> {
    const previous = this.rateLimitQueue
    let release!: () => void
    this.rateLimitQueue = new Promise<void>((resolve) => {
      release = resolve
    })

    await previous

    try {
      const config = await this.readRateLimitConfig()
      while (true) {
        const now = Date.now()
        this.pruneRequestTimestamps(now, config.windowMs)

        if (this.requestTimestamps.length < config.maxRequests) {
          this.requestTimestamps.push(now)
          return
        }

        const waitMs = config.windowMs - (now - this.requestTimestamps[0]!)
        await delay(Math.max(1, waitMs))
      }
    } finally {
      release()
    }
  }

  private async readRateLimitConfig(): Promise<BangumiRateLimitConfig> {
    const config = await this.getRateLimitConfig?.()
    if (
      !config ||
      !Number.isFinite(config.maxRequests) ||
      !Number.isFinite(config.windowMs) ||
      config.maxRequests < 1 ||
      config.windowMs < 1
    ) {
      return DEFAULT_RATE_LIMIT_CONFIG
    }

    return {
      maxRequests: Math.max(1, Math.trunc(config.maxRequests)),
      windowMs: Math.max(1, Math.trunc(config.windowMs))
    }
  }

  private pruneRequestTimestamps(now: number, windowMs: number): void {
    while (this.requestTimestamps.length > 0 && now - this.requestTimestamps[0]! >= windowMs) {
      this.requestTimestamps.shift()
    }
  }

  private async request<T>(
    method: 'GET' | 'POST',
    pathname: string,
    query?: Record<string, string | number | boolean>,
    body?: unknown
  ): Promise<T> {
    await this.acquireRateLimit()

    const response = await this.network.request<T>({
      url: this.buildUrl(pathname, query),
      method,
      headers: await this.buildHeaders(method),
      body: body as SerializableValue | undefined,
      responseType: 'json'
    })

    if (!response.ok) {
      const detail = stringifyResponseData(response.data)
      throw new Error(
        `Bangumi API request failed: ${response.status}${detail ? ` - ${detail}` : ''}`
      )
    }

    return response.data
  }

  private async requestRedirectUrl(
    pathname: string,
    query: Record<string, string | number | boolean>
  ): Promise<string | undefined> {
    await this.acquireRateLimit()

    const response = await this.network.request<Uint8Array>({
      url: this.buildUrl(pathname, query),
      method: 'GET',
      headers: await this.buildHeaders('GET'),
      responseType: 'arrayBuffer'
    })

    if (!response.ok) {
      return undefined
    }

    return response.url?.trim() || undefined
  }

  async searchSubjects(
    payload: BangumiSearchSubjectPayload,
    limit = 25,
    offset = 0
  ): Promise<BangumiPaged<BangumiSubject>> {
    return this.request<BangumiPaged<BangumiSubject>>(
      'POST',
      '/v0/search/subjects',
      { limit, offset },
      payload
    )
  }

  async getSubjectById(subjectId: number): Promise<BangumiSubject> {
    return this.request<BangumiSubject>('GET', `/v0/subjects/${subjectId}`)
  }

  async getSubjectPersons(subjectId: number): Promise<BangumiRelatedPerson[]> {
    return this.request<BangumiRelatedPerson[]>('GET', `/v0/subjects/${subjectId}/persons`)
  }

  async getSubjectCharacters(subjectId: number): Promise<BangumiRelatedCharacter[]> {
    return this.request<BangumiRelatedCharacter[]>('GET', `/v0/subjects/${subjectId}/characters`)
  }

  async getSubjectRelations(subjectId: number): Promise<BangumiSubjectRelation[]> {
    return this.request<BangumiSubjectRelation[]>('GET', `/v0/subjects/${subjectId}/subjects`)
  }

  async getCharacterById(characterId: number): Promise<BangumiCharacterDetail> {
    return this.request<BangumiCharacterDetail>('GET', `/v0/characters/${characterId}`)
  }

  async getCharacterPersons(characterId: number): Promise<BangumiCharacterPerson[]> {
    return this.request<BangumiCharacterPerson[]>('GET', `/v0/characters/${characterId}/persons`)
  }

  async getPersonById(personId: number): Promise<BangumiPersonDetail> {
    return this.request<BangumiPersonDetail>('GET', `/v0/persons/${personId}`)
  }

  async getSubjectImageUrl(subjectId: number, type: BangumiImageType): Promise<string | undefined> {
    return this.requestRedirectUrl(`/v0/subjects/${subjectId}/image`, { type })
  }

  async getCharacterImageUrl(
    characterId: number,
    type: BangumiEntityImageType
  ): Promise<string | undefined> {
    return this.requestRedirectUrl(`/v0/characters/${characterId}/image`, { type })
  }

  async getPersonImageUrl(
    personId: number,
    type: BangumiEntityImageType
  ): Promise<string | undefined> {
    return this.requestRedirectUrl(`/v0/persons/${personId}/image`, { type })
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function stringifyResponseData(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
