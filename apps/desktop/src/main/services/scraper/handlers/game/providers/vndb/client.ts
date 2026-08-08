/**
 * VNDB Kana API Client
 *
 * Base URL: https://api.vndb.org/kana
 *
 * References:
 * - https://api.vndb.org/kana
 * - https://api.vndb.org/kana/schema
 */

import type { NetworkService } from '@main/services/network'
import { createProviderHttpError } from '../../../../shared'
import { buildIdOrFilter, chunkArray } from './format'
import type {
  VndbKanaSchema,
  VndbQueryRequest,
  VndbQueryResponse,
  VndbVn,
  VndbCharacter,
  VndbStaff,
  VndbProducer,
  VndbTag,
  VndbTrait,
  VndbRelease
} from './types'

const RATE_LIMIT_KEY = 'vndb'
// Official docs: 200 requests per 5 minutes (unauthenticated).
const RATE_LIMIT_CONFIG = { maxRequests: 200, windowMs: 300_000 }

const BASE_URL = 'https://api.vndb.org/kana'
const USER_AGENT = 'kisaki/1.0 (+https://github.com/ximu3/kisaki)'

type VndbEndpoint = 'vn' | 'release' | 'producer' | 'character' | 'staff' | 'tag' | 'trait'

/** Token and cached enum schema shared by every bound client view. */
interface VndbClientState {
  network: NetworkService
  token?: string
  rateLimitRegistered: boolean
  schema: VndbKanaSchema | null
}

export class VndbClient {
  private constructor(
    private readonly state: VndbClientState,
    private readonly signal?: AbortSignal
  ) {}

  static create(network: NetworkService, token?: string): VndbClient {
    return new VndbClient({
      network,
      token: token?.trim() || undefined,
      rateLimitRegistered: false,
      schema: null
    })
  }

  /**
   * View bound to one invocation's cancellation scope. Shared state stays
   * shared, so every request a provider makes for that invocation is
   * cancellable without the call sites carrying a signal.
   */
  withSignal(signal: AbortSignal | undefined): VndbClient {
    return new VndbClient(this.state, signal)
  }

  private ensureRateLimitRegistered(): void {
    if (!this.state.rateLimitRegistered) {
      this.state.network.rateLimits.register(RATE_LIMIT_KEY, RATE_LIMIT_CONFIG)
      this.state.rateLimitRegistered = true
    }
  }

  private buildHeaders(method: 'GET' | 'POST'): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': USER_AGENT
    }

    if (method === 'POST') {
      headers['Content-Type'] = 'application/json'
    }

    if (this.state.token) {
      headers.Authorization = `token ${this.state.token}`
    }

    return headers
  }

  private async request<T>(method: 'GET' | 'POST', pathname: string, body?: unknown): Promise<T> {
    this.ensureRateLimitRegistered()

    const response = await this.state.network.request.fetch(`${BASE_URL}${pathname}`, {
      method,
      headers: this.buildHeaders(method),
      body: body ? JSON.stringify(body) : undefined,
      rateLimitKey: RATE_LIMIT_KEY,
      signal: this.signal
    })

    if (!response.ok) {
      throw createProviderHttpError('VNDB', 'API request', response)
    }

    return response.json() as Promise<T>
  }

  private async query<T>(
    endpoint: VndbEndpoint,
    body: VndbQueryRequest
  ): Promise<VndbQueryResponse<T>> {
    return this.request<VndbQueryResponse<T>>('POST', `/${endpoint}`, body)
  }

  private async queryAll<T>(
    endpoint: VndbEndpoint,
    body: VndbQueryRequest,
    maxPages = 10
  ): Promise<T[]> {
    const all: T[] = []
    const pageSize = Math.max(1, Math.min(Math.floor(body.results ?? 100), 100))
    let page = Math.max(1, Math.floor(body.page ?? 1))

    for (let i = 0; i < maxPages; i += 1) {
      const response = await this.query<T>(endpoint, {
        ...body,
        results: pageSize,
        page
      })

      all.push(...(response.results ?? []))
      if (!response.more) {
        break
      }

      page += 1
    }

    return all
  }

  private async queryByIds<T>(
    endpoint: VndbEndpoint,
    ids: string[],
    fields: string,
    chunkSize = 80
  ): Promise<T[]> {
    const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
    if (uniqueIds.length === 0) {
      return []
    }

    const all: T[] = []
    const chunks = chunkArray(uniqueIds, chunkSize)

    for (const chunk of chunks) {
      const rows = await this.queryAll<T>(
        endpoint,
        {
          filters: buildIdOrFilter(chunk),
          fields,
          sort: 'id',
          results: 100
        },
        5
      )
      all.push(...rows)
    }

    return all
  }

  /**
   * The enum schema is immutable, so the resolved value is cached across
   * invocations. Only the value is cached, never the in-flight request: sharing
   * the promise would let one invocation's cancellation reject another's await.
   */
  async getSchema(): Promise<VndbKanaSchema> {
    if (this.state.schema) {
      return this.state.schema
    }

    const schema = await this.request<VndbKanaSchema>('GET', '/schema')
    this.state.schema = schema
    return schema
  }

  async searchVn(query: string, fields: string, limit = 25): Promise<VndbVn[]> {
    const keyword = query.trim()
    if (!keyword) return []

    const response = await this.query<VndbVn>('vn', {
      filters: ['search', '=', keyword],
      fields,
      sort: 'searchrank',
      results: Math.max(1, Math.min(Math.floor(limit), 100))
    })

    return response.results ?? []
  }

  async getVnById(vnId: string, fields: string): Promise<VndbVn | null> {
    const response = await this.query<VndbVn>('vn', {
      filters: ['id', '=', vnId],
      fields,
      results: 1
    })
    return response.results?.[0] ?? null
  }

  async getCharactersByVn(vnId: string, fields: string): Promise<VndbCharacter[]> {
    return this.queryAll<VndbCharacter>(
      'character',
      {
        filters: ['vn', '=', ['id', '=', vnId]],
        fields,
        sort: 'id',
        results: 100
      },
      10
    )
  }

  async getReleasesByVn(vnId: string, fields: string): Promise<VndbRelease[]> {
    return this.queryAll<VndbRelease>(
      'release',
      {
        filters: ['vn', '=', ['id', '=', vnId]],
        fields,
        sort: 'id',
        results: 100
      },
      10
    )
  }

  async getStaffByIds(ids: string[], fields: string): Promise<VndbStaff[]> {
    return this.queryByIds<VndbStaff>('staff', ids, fields)
  }

  async getProducersByIds(ids: string[], fields: string): Promise<VndbProducer[]> {
    return this.queryByIds<VndbProducer>('producer', ids, fields)
  }

  async getTagsByIds(ids: string[], fields: string): Promise<VndbTag[]> {
    return this.queryByIds<VndbTag>('tag', ids, fields)
  }

  async getTraitsByIds(ids: string[], fields: string): Promise<VndbTrait[]> {
    return this.queryByIds<VndbTrait>('trait', ids, fields)
  }
}
