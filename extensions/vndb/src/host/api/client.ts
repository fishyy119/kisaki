import {
  createCancellationError,
  isCancellationError,
  type ExtensionLogger,
  type NetworkCapability,
  type NetworkResponse
} from '@kisaki3/extension-sdk'
import { normalizeVndbApiError, VndbApiError } from './errors'
import { delay, VndbRateLimiter } from './limiter'
import type {
  VndbCharacter,
  VndbKanaSchema,
  VndbProducer,
  VndbQueryRequest,
  VndbQueryResponse,
  VndbRelease,
  VndbStaff,
  VndbTag,
  VndbTrait,
  VndbVn
} from './types'
import type { TokenStore } from '../auth/token'
import type { VndbSettingsV1 } from '../config/schema'
import { m } from '../i18n'
import {
  VNDB_ID_CHUNK_SIZE,
  VNDB_MAX_QUERY_PAGES,
  VNDB_QUERY_PAGE_SIZE,
  VNDB_USER_AGENT
} from '../utils/constants'
import { VndbExtensionError, throwIfAborted } from '../utils/errors'
import { chunk, omitUndefined } from '../utils/object'

/** Official limit is 200 requests per 5 minutes; stay under it. */
const RATE_LIMIT_MAX_REQUESTS = 180
const RATE_LIMIT_WINDOW_MS = 300_000

export type VndbEndpoint = 'vn' | 'release' | 'producer' | 'character' | 'staff' | 'tag' | 'trait'

export interface VndbRequestOptions {
  signal?: AbortSignal | undefined
}

export class VndbClient {
  private readonly limiter = new VndbRateLimiter(RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS)
  /** The enum schema is immutable, so it is resolved once per app run. */
  private schema: VndbKanaSchema | null = null

  constructor(
    private readonly network: NetworkCapability,
    private readonly tokens: TokenStore,
    private readonly getSettings: () => Promise<VndbSettingsV1>,
    private readonly logger: ExtensionLogger
  ) {}

  /** Cheapest read; used by the settings connection test. */
  async verifyConnection(signal?: AbortSignal): Promise<void> {
    await this.request<VndbKanaSchema>('GET', '/schema', undefined, { signal })
  }

  /**
   * Only the resolved value is cached, never the in-flight request: sharing
   * the promise would let one invocation's cancellation reject another's await.
   */
  async getSchema(options: VndbRequestOptions = {}): Promise<VndbKanaSchema> {
    if (this.schema) {
      return this.schema
    }

    const schema = await this.request<VndbKanaSchema>('GET', '/schema', undefined, options)
    this.schema = schema
    return schema
  }

  async searchVns(
    query: string,
    fields: string,
    limit: number,
    options: VndbRequestOptions = {}
  ): Promise<VndbVn[]> {
    return this.searchEntity<VndbVn>('vn', query, fields, limit, options)
  }

  async searchCharacters(
    query: string,
    fields: string,
    limit: number,
    options: VndbRequestOptions = {}
  ): Promise<VndbCharacter[]> {
    return this.searchEntity<VndbCharacter>('character', query, fields, limit, options)
  }

  async searchStaff(
    query: string,
    fields: string,
    limit: number,
    options: VndbRequestOptions = {}
  ): Promise<VndbStaff[]> {
    return this.searchEntity<VndbStaff>('staff', query, fields, limit, options)
  }

  async searchProducers(
    query: string,
    fields: string,
    limit: number,
    options: VndbRequestOptions = {}
  ): Promise<VndbProducer[]> {
    return this.searchEntity<VndbProducer>('producer', query, fields, limit, options)
  }

  async getVnById(
    vnId: string,
    fields: string,
    options: VndbRequestOptions = {}
  ): Promise<VndbVn | null> {
    return this.getById<VndbVn>('vn', vnId, fields, options)
  }

  async getCharacterById(
    characterId: string,
    fields: string,
    options: VndbRequestOptions = {}
  ): Promise<VndbCharacter | null> {
    return this.getById<VndbCharacter>('character', characterId, fields, options)
  }

  async getStaffById(
    staffId: string,
    fields: string,
    options: VndbRequestOptions = {}
  ): Promise<VndbStaff | null> {
    return this.getById<VndbStaff>('staff', staffId, fields, options)
  }

  async getProducerById(
    producerId: string,
    fields: string,
    options: VndbRequestOptions = {}
  ): Promise<VndbProducer | null> {
    return this.getById<VndbProducer>('producer', producerId, fields, options)
  }

  async getCharactersByVn(
    vnId: string,
    fields: string,
    options: VndbRequestOptions = {}
  ): Promise<VndbCharacter[]> {
    return this.queryAll<VndbCharacter>(
      'character',
      { filters: ['vn', '=', ['id', '=', vnId]], fields, sort: 'id' },
      options
    )
  }

  async getReleasesByVn(
    vnId: string,
    fields: string,
    options: VndbRequestOptions = {}
  ): Promise<VndbRelease[]> {
    return this.queryAll<VndbRelease>(
      'release',
      { filters: ['vn', '=', ['id', '=', vnId]], fields, sort: 'id' },
      options
    )
  }

  async getStaffByIds(
    ids: readonly string[],
    fields: string,
    options: VndbRequestOptions = {}
  ): Promise<VndbStaff[]> {
    return this.queryByIds<VndbStaff>('staff', ids, fields, options)
  }

  async getProducersByIds(
    ids: readonly string[],
    fields: string,
    options: VndbRequestOptions = {}
  ): Promise<VndbProducer[]> {
    return this.queryByIds<VndbProducer>('producer', ids, fields, options)
  }

  async getTagsByIds(
    ids: readonly string[],
    fields: string,
    options: VndbRequestOptions = {}
  ): Promise<VndbTag[]> {
    return this.queryByIds<VndbTag>('tag', ids, fields, options)
  }

  async getTraitsByIds(
    ids: readonly string[],
    fields: string,
    options: VndbRequestOptions = {}
  ): Promise<VndbTrait[]> {
    return this.queryByIds<VndbTrait>('trait', ids, fields, options)
  }

  private async searchEntity<T>(
    endpoint: VndbEndpoint,
    query: string,
    fields: string,
    limit: number,
    options: VndbRequestOptions
  ): Promise<T[]> {
    const keyword = query.trim()
    if (!keyword) {
      return []
    }

    const response = await this.query<T>(
      endpoint,
      {
        filters: ['search', '=', keyword],
        fields,
        sort: 'searchrank',
        results: Math.max(1, Math.min(Math.floor(limit), VNDB_QUERY_PAGE_SIZE))
      },
      options
    )

    return response.results ?? []
  }

  private async getById<T>(
    endpoint: VndbEndpoint,
    id: string,
    fields: string,
    options: VndbRequestOptions
  ): Promise<T | null> {
    const response = await this.query<T>(
      endpoint,
      { filters: ['id', '=', id], fields, results: 1 },
      options
    )
    return response.results?.[0] ?? null
  }

  private async queryAll<T>(
    endpoint: VndbEndpoint,
    body: VndbQueryRequest,
    options: VndbRequestOptions
  ): Promise<T[]> {
    const rows: T[] = []
    let page = 1

    for (let visited = 0; visited < VNDB_MAX_QUERY_PAGES; visited += 1) {
      const response = await this.query<T>(
        endpoint,
        { ...body, results: VNDB_QUERY_PAGE_SIZE, page },
        options
      )
      rows.push(...(response.results ?? []))

      if (!response.more) {
        break
      }
      page += 1
    }

    return rows
  }

  private async queryByIds<T>(
    endpoint: VndbEndpoint,
    ids: readonly string[],
    fields: string,
    options: VndbRequestOptions
  ): Promise<T[]> {
    const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
    if (uniqueIds.length === 0) {
      return []
    }

    const rows: T[] = []
    for (const group of chunk(uniqueIds, VNDB_ID_CHUNK_SIZE)) {
      rows.push(
        ...(await this.queryAll<T>(
          endpoint,
          { filters: buildIdFilter(group), fields, sort: 'id' },
          options
        ))
      )
    }

    return rows
  }

  private query<T>(
    endpoint: VndbEndpoint,
    body: VndbQueryRequest,
    options: VndbRequestOptions
  ): Promise<VndbQueryResponse<T>> {
    return this.request<VndbQueryResponse<T>>('POST', `/${endpoint}`, body, options)
  }

  private async request<T>(
    method: 'GET' | 'POST',
    pathname: string,
    body: unknown,
    options: VndbRequestOptions
  ): Promise<T> {
    const settings = await this.getSettings()
    const token = await this.tokens.get()
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': VNDB_USER_AGENT
    }
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json'
    }
    if (token) {
      headers.Authorization = `token ${token}`
    }

    for (let attempt = 0; attempt <= settings.client.retryCount; attempt += 1) {
      throwIfAborted(options.signal)

      try {
        await this.limiter.acquire(options.signal)
        const response: NetworkResponse<T> = await this.network.request<T>(
          omitUndefined({
            url: `${settings.endpoints.apiBaseUrl}${pathname}`,
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            timeoutMs: settings.client.timeoutMs,
            responseType: 'json' as const
          }),
          omitUndefined({ signal: options.signal })
        )

        if (response.ok) {
          return response.data
        }

        if (shouldRetryStatus(response.status) && attempt < settings.client.retryCount) {
          await delay(resolveRetryDelayMs(attempt), options.signal)
          continue
        }

        throw normalizeVndbApiError(response.status, pathname)
      } catch (error) {
        // Must precede the retry branch: a cancelled call is not a transient
        // fault and reissuing it would outlive the cancellation.
        if (isCancellationError(error)) {
          throw createCancellationError(m().errors.operationCancelled)
        }

        if (error instanceof VndbExtensionError) {
          throw error
        }

        this.logger.debug('VNDB request attempt failed.', { path: pathname, attempt })
        if (attempt < settings.client.retryCount) {
          await delay(resolveRetryDelayMs(attempt), options.signal)
          continue
        }
      }
    }

    throw new VndbApiError('network_failed', m().errors.networkFailed, { path: pathname })
  }
}

function buildIdFilter(ids: readonly string[]): unknown {
  return ids.length === 1 ? ['id', '=', ids[0]] : ['or', ...ids.map((id) => ['id', '=', id])]
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function resolveRetryDelayMs(attempt: number): number {
  return Math.min(10_000, 500 * 2 ** attempt)
}
