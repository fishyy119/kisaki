import {
  createCancellationError,
  isCancellationError,
  type ExtensionLogger,
  type NetworkCapability,
  type NetworkMethod,
  type NetworkResponse,
  type NetworkResponseType,
  type JsonValue
} from '@kisaki3/extension-sdk'
import { BangumiApiError, normalizeBangumiApiError, readRetryAfterMs } from './errors'
import { BangumiRateLimiter, delay, normalizeRateLimitConfig } from './limiter'
import { normalizePageQuery, toPage, type Page, type PageQuery } from './pagination'
import type {
  BangumiCharacter,
  BangumiCharacterDetail,
  BangumiCharacterPerson,
  BangumiCollectionPatch,
  BangumiCollectionQuery,
  BangumiEntityImageType,
  BangumiEpisode,
  BangumiEpisodeCollection,
  BangumiEpisodeCollectionType,
  BangumiEpisodeQuery,
  BangumiImageType,
  BangumiIndex,
  BangumiIndexSubject,
  BangumiIndexSubjectsQuery,
  BangumiMe,
  BangumiPaged,
  BangumiPerson,
  BangumiRelatedCharacter,
  BangumiRelatedPerson,
  BangumiSearchSubjectPayload,
  BangumiSubject,
  BangumiSubjectRelation,
  BangumiUserCollection,
  BangumiPersonDetail
} from './types'
import type { BangumiSettingsV1 } from '../config/schema'
import { BANGUMI_API_BASE_URL, BANGUMI_EPISODE_PAGE_LIMIT } from '../utils/constants'
import { BangumiExtensionError, throwIfAborted } from '../utils/errors'
import { m } from '../i18n'
import { omitUndefined } from '../utils/object'
import type { TokenService } from '../auth/token-service'
import type { BangumiSubjectRef } from '../identity/subject-ref'
import { getBangumiSubjectType, type BangumiMediaScope } from '../../shared/scopes'

type BangumiClientSettings = Pick<
  BangumiSettingsV1['client'],
  'rateLimit' | 'timeoutMs' | 'retryCount'
>
type AuthMode = 'none' | 'optional' | 'required'

interface BangumiClientOptions {
  userAgent: string
  logger?: ExtensionLogger | undefined
  baseUrl?: string | undefined
}

interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined> | undefined
  body?: unknown | undefined
  auth?: AuthMode | undefined
  responseType?: NetworkResponseType | undefined
  signal?: AbortSignal | undefined
}

interface SendOptions extends RequestOptions {
  forceRefresh?: boolean | undefined
}

export class BangumiClient {
  private readonly baseUrl: string
  private readonly userAgent: string
  private readonly logger?: ExtensionLogger
  private readonly limiter: BangumiRateLimiter

  constructor(
    private readonly network: NetworkCapability,
    private readonly tokenService: TokenService,
    private readonly getClientSettings: () => Promise<BangumiClientSettings>,
    options: BangumiClientOptions
  ) {
    this.baseUrl = options.baseUrl ?? BANGUMI_API_BASE_URL
    this.userAgent = options.userAgent
    if (options.logger !== undefined) {
      this.logger = options.logger
    }
    this.limiter = new BangumiRateLimiter(async () =>
      normalizeRateLimitConfig((await this.getClientSettings()).rateLimit)
    )
  }

  async getMe(options: Pick<RequestOptions, 'signal'> = {}): Promise<BangumiMe> {
    return normalizeMe(
      await this.request<BangumiMe>('GET', '/v0/me', {
        auth: 'required',
        signal: options.signal
      })
    )
  }

  async searchSubjects(
    scope: BangumiMediaScope,
    payload: BangumiSearchSubjectPayload,
    page: PageQuery = {},
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<Page<BangumiSubject>> {
    const query = normalizePageQuery(page)
    const response = await this.request<BangumiPaged<BangumiSubject>>(
      'POST',
      '/v0/search/subjects',
      {
        query,
        body: {
          ...payload,
          filter: {
            ...(payload.filter ?? {}),
            type: [getBangumiSubjectType(scope)]
          }
        },
        auth: 'optional',
        signal: options.signal
      }
    )

    return toPage(response, query)
  }

  async getSubject(
    refOrSubjectId: BangumiSubjectRef | number,
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<BangumiSubject> {
    const subjectId = readSubjectId(refOrSubjectId)
    return this.request<BangumiSubject>('GET', `/v0/subjects/${subjectId}`, {
      auth: 'optional',
      signal: options.signal
    })
  }

  /**
   * List episodes of a subject.
   *
   * The endpoint pages at 100 rows, so long-running shows need several
   * requests; callers get the flattened list in source order.
   */
  async getSubjectEpisodes(
    subjectId: number,
    query: BangumiEpisodeQuery = {},
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<BangumiEpisode[]> {
    const limit = Math.min(Math.max(query.limit ?? BANGUMI_EPISODE_PAGE_LIMIT, 1), 200)
    const episodes: BangumiEpisode[] = []
    let offset = Math.max(query.offset ?? 0, 0)

    for (;;) {
      const response = await this.request<BangumiPaged<BangumiEpisode>>('GET', '/v0/episodes', {
        query: omitUndefined({
          subject_id: subjectId,
          type: query.type,
          limit,
          offset
        }),
        auth: 'optional',
        signal: options.signal
      })

      const page = response.data ?? []
      episodes.push(...page)
      offset += page.length

      if (page.length < limit || offset >= (response.total ?? episodes.length)) {
        return episodes
      }
    }
  }

  async getSubjectPersons(
    subjectId: number,
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<BangumiRelatedPerson[]> {
    return this.request<BangumiRelatedPerson[]>('GET', `/v0/subjects/${subjectId}/persons`, {
      auth: 'optional',
      signal: options.signal
    })
  }

  async getSubjectCharacters(
    subjectId: number,
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<BangumiRelatedCharacter[]> {
    return this.request<BangumiRelatedCharacter[]>('GET', `/v0/subjects/${subjectId}/characters`, {
      auth: 'optional',
      signal: options.signal
    })
  }

  async getSubjectRelations(
    subjectId: number,
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<BangumiSubjectRelation[]> {
    return this.request<BangumiSubjectRelation[]>('GET', `/v0/subjects/${subjectId}/subjects`, {
      auth: 'optional',
      signal: options.signal
    })
  }

  /**
   * Search characters by name.
   *
   * The endpoint answers with the same character rows the subject endpoints
   * return, so a searched character and a credited one are the same entity.
   */
  async searchCharacters(
    keyword: string,
    page: PageQuery = {},
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<Page<BangumiCharacter>> {
    return this.searchEntities<BangumiCharacter>('/v0/search/characters', keyword, page, options)
  }

  /**
   * Search persons by name.
   *
   * Bangumi files companies as persons of type 2 and 3, so this answers for
   * both the person and company providers; each filters by the type it means.
   */
  async searchPersons(
    keyword: string,
    page: PageQuery = {},
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<Page<BangumiPerson>> {
    return this.searchEntities<BangumiPerson>('/v0/search/persons', keyword, page, options)
  }

  private async searchEntities<T>(
    pathname: string,
    keyword: string,
    page: PageQuery,
    options: Pick<RequestOptions, 'signal'>
  ): Promise<Page<T>> {
    const query = normalizePageQuery(page)
    const response = await this.request<BangumiPaged<T>>('POST', pathname, {
      query,
      body: { keyword },
      auth: 'optional',
      signal: options.signal
    })

    return toPage(response, query)
  }

  async getCharacterById(
    characterId: number,
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<BangumiCharacterDetail> {
    return this.request<BangumiCharacterDetail>('GET', `/v0/characters/${characterId}`, {
      auth: 'optional',
      signal: options.signal
    })
  }

  async getCharacterPersons(
    characterId: number,
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<BangumiCharacterPerson[]> {
    return this.request<BangumiCharacterPerson[]>('GET', `/v0/characters/${characterId}/persons`, {
      auth: 'optional',
      signal: options.signal
    })
  }

  async getPersonById(
    personId: number,
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<BangumiPersonDetail> {
    return this.request<BangumiPersonDetail>('GET', `/v0/persons/${personId}`, {
      auth: 'optional',
      signal: options.signal
    })
  }

  async getSubjectImageUrl(
    subjectId: number,
    type: BangumiImageType,
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<string | undefined> {
    return this.requestRedirectUrl(`/v0/subjects/${subjectId}/image`, { type }, options.signal)
  }

  async getCharacterImageUrl(
    characterId: number,
    type: BangumiEntityImageType,
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<string | undefined> {
    return this.requestRedirectUrl(`/v0/characters/${characterId}/image`, { type }, options.signal)
  }

  async getPersonImageUrl(
    personId: number,
    type: BangumiEntityImageType,
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<string | undefined> {
    return this.requestRedirectUrl(`/v0/persons/${personId}/image`, { type }, options.signal)
  }

  async getUserCollections(
    username: string,
    query: BangumiCollectionQuery = {},
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<Page<BangumiUserCollection>> {
    const pageQuery = normalizePageQuery(query)
    const response = await this.request<BangumiPaged<BangumiUserCollection>>(
      'GET',
      `/v0/users/${encodeURIComponent(username)}/collections`,
      {
        query: {
          ...pageQuery,
          subject_type: query.subject_type ?? getBangumiSubjectType(query.scope ?? 'game'),
          type: query.type
        },
        auth: 'required',
        signal: options.signal
      }
    )

    return toPage(response, pageQuery)
  }

  async getUserCollection(
    username: string,
    refOrSubjectId: BangumiSubjectRef | number,
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<BangumiUserCollection> {
    const subjectId = readSubjectId(refOrSubjectId)
    return this.request<BangumiUserCollection>(
      'GET',
      `/v0/users/${encodeURIComponent(username)}/collections/${subjectId}`,
      {
        auth: 'required',
        signal: options.signal
      }
    )
  }

  async upsertMyCollection(
    refOrSubjectId: BangumiSubjectRef | number,
    payload: BangumiCollectionPatch,
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<BangumiUserCollection> {
    const subjectId = readSubjectId(refOrSubjectId)
    return this.request<BangumiUserCollection>('POST', `/v0/users/-/collections/${subjectId}`, {
      body: payload,
      auth: 'required',
      signal: options.signal
    })
  }

  async patchMyCollection(
    refOrSubjectId: BangumiSubjectRef | number,
    payload: BangumiCollectionPatch,
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<BangumiUserCollection> {
    const subjectId = readSubjectId(refOrSubjectId)
    return this.request<BangumiUserCollection>('PATCH', `/v0/users/-/collections/${subjectId}`, {
      body: payload,
      auth: 'required',
      signal: options.signal
    })
  }

  /**
   * Read the signed-in user's per-episode collection state of one subject.
   *
   * Used to reconcile before the first push, so previously watched episodes are
   * not re-sent as new marks.
   */
  async getMyEpisodeCollections(
    refOrSubjectId: BangumiSubjectRef | number,
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<BangumiEpisodeCollection[]> {
    const subjectId = readSubjectId(refOrSubjectId)
    const collections: BangumiEpisodeCollection[] = []
    let offset = 0

    for (;;) {
      const response = await this.request<BangumiPaged<BangumiEpisodeCollection>>(
        'GET',
        `/v0/users/-/collections/${subjectId}/episodes`,
        {
          query: { limit: BANGUMI_EPISODE_PAGE_LIMIT, offset },
          auth: 'required',
          signal: options.signal
        }
      )

      const page = response.data ?? []
      collections.push(...page)
      offset += page.length

      if (
        page.length < BANGUMI_EPISODE_PAGE_LIMIT ||
        offset >= (response.total ?? collections.length)
      ) {
        return collections
      }
    }
  }

  /** Batch-updates episode collection state; one call marks a whole season. */
  async patchMyEpisodeCollections(
    refOrSubjectId: BangumiSubjectRef | number,
    episodeIds: readonly number[],
    type: BangumiEpisodeCollectionType,
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<void> {
    if (episodeIds.length === 0) {
      return
    }

    const subjectId = readSubjectId(refOrSubjectId)
    await this.request<string>('PATCH', `/v0/users/-/collections/${subjectId}/episodes`, {
      body: { episode_id: [...episodeIds], type },
      auth: 'required',
      responseType: 'text',
      signal: options.signal
    })
  }

  async getIndex(
    indexId: number,
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<BangumiIndex> {
    return this.request<BangumiIndex>('GET', `/v0/indices/${indexId}`, {
      auth: 'optional',
      signal: options.signal
    })
  }

  async getIndexSubjects(
    indexId: number,
    query: BangumiIndexSubjectsQuery = {},
    options: Pick<RequestOptions, 'signal'> = {}
  ): Promise<Page<BangumiIndexSubject>> {
    const pageQuery = normalizePageQuery(query)
    const response = await this.request<BangumiPaged<BangumiIndexSubject>>(
      'GET',
      `/v0/indices/${indexId}/subjects`,
      {
        query: {
          ...pageQuery,
          type: query.type ?? getBangumiSubjectType(query.scope ?? 'game')
        },
        auth: 'optional',
        signal: options.signal
      }
    )

    return toPage(response, pageQuery)
  }

  private async request<T>(
    method: NetworkMethod,
    pathname: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const response = await this.send<T>(method, pathname, options)
    return response.data
  }

  private async requestRedirectUrl(
    pathname: string,
    query: Record<string, string | number | boolean>,
    signal?: AbortSignal
  ): Promise<string | undefined> {
    try {
      const response = await this.send<Uint8Array>('GET', pathname, {
        query,
        auth: 'optional',
        responseType: 'arrayBuffer',
        signal
      })

      return response.url?.trim() || undefined
    } catch (error) {
      // A missing image is expected; a cancellation is not an absent image.
      if (isCancellationError(error)) {
        throw error
      }

      this.logger?.debug('Bangumi image redirect lookup failed.', toSafeErrorLog(error))
      return undefined
    }
  }

  private async send<T>(
    method: NetworkMethod,
    pathname: string,
    options: SendOptions = {}
  ): Promise<NetworkResponse<T>> {
    const settings = await this.getClientSettings()
    const retryCount = normalizeRetryCount(settings.retryCount)
    let refreshedAfter401 = false

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      throwIfAborted(options.signal)

      try {
        const response = await this.sendOnce<T>(method, pathname, {
          ...options,
          forceRefresh: refreshedAfter401
        })

        if (response.ok) {
          return response
        }

        const retryAfterMs = readRetryAfterMs(response.headers)

        if (
          response.status === 401 &&
          options.auth !== 'none' &&
          !refreshedAfter401 &&
          (await this.tryForceRefresh(options))
        ) {
          refreshedAfter401 = true
          continue
        }

        if (shouldRetryStatus(response.status) && attempt < retryCount) {
          await delay(resolveRetryDelayMs(attempt, retryAfterMs), options.signal)
          continue
        }

        throw normalizeBangumiApiError(response.status, pathname, response.data, retryAfterMs)
      } catch (error) {
        // Must precede the retry branches: a cancelled call is not a transient
        // fault and reissuing it would outlive the cancellation.
        if (isCancellationError(error)) {
          throw createCancellationError(m().errors.operationCancelled)
        }

        if (error instanceof BangumiExtensionError) {
          throw error
        }

        if (attempt < retryCount) {
          await delay(resolveRetryDelayMs(attempt), options.signal)
          continue
        }
      }
    }

    throw new BangumiApiError('network_failed', m().errors.networkFailed, { path: pathname })
  }

  private async sendOnce<T>(
    method: NetworkMethod,
    pathname: string,
    options: SendOptions
  ): Promise<NetworkResponse<T>> {
    const settings = await this.getClientSettings()
    const authMode = options.auth ?? 'optional'
    const accessToken =
      authMode === 'none'
        ? undefined
        : await this.tokenService.getAccessToken({
            optional: authMode === 'optional',
            forceRefresh: options.forceRefresh,
            signal: options.signal
          })

    await this.limiter.acquire(options.signal)

    return this.network.request<T>(
      omitUndefined({
        url: this.buildUrl(pathname, options.query),
        method,
        headers: this.buildHeaders(method, accessToken),
        body: options.body === undefined ? undefined : (options.body as JsonValue),
        timeoutMs: normalizeTimeoutMs(settings.timeoutMs),
        responseType: options.responseType ?? 'json'
      }),
      omitUndefined({ signal: options.signal })
    )
  }

  private async tryForceRefresh(options: SendOptions): Promise<boolean> {
    try {
      await this.tokenService.getAccessToken({
        forceRefresh: true,
        optional: options.auth === 'optional',
        signal: options.signal
      })
      return true
    } catch (error) {
      this.logger?.warn('Bangumi token refresh after 401 failed.', toSafeErrorLog(error))
      return false
    }
  }

  private buildUrl(
    pathname: string,
    query?: Record<string, string | number | boolean | undefined>
  ): string {
    const url = new URL(pathname, this.baseUrl)
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }
    return url.toString()
  }

  private buildHeaders(method: NetworkMethod, accessToken?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': this.userAgent
    }

    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json'
    }

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    return headers
  }
}

function normalizeMe(value: BangumiMe): BangumiMe {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof value.id !== 'number' ||
    !Number.isFinite(value.id) ||
    typeof value.username !== 'string' ||
    !value.username.trim()
  ) {
    throw new BangumiApiError('bangumi_validation', m().errors.accountResponseInvalid, {
      path: '/v0/me'
    })
  }

  return {
    ...value,
    id: Math.trunc(value.id),
    username: value.username.trim(),
    nickname:
      typeof value.nickname === 'string' && value.nickname.trim()
        ? value.nickname.trim()
        : value.username.trim()
  }
}

function readSubjectId(refOrSubjectId: BangumiSubjectRef | number): number {
  return typeof refOrSubjectId === 'number' ? refOrSubjectId : refOrSubjectId.subjectId
}

function normalizeRetryCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.min(10, Math.trunc(value))
    : 3
}

function normalizeTimeoutMs(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : 30_000
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function resolveRetryDelayMs(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs !== undefined) {
    return Math.min(60_000, Math.max(250, retryAfterMs))
  }
  return Math.min(30_000, 500 * 2 ** attempt)
}
function toSafeErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof BangumiExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}
