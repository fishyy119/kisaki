/**
 * Invocation-scoped caches for scraper resolve/session/payload execution.
 */

import {
  normalizeExternalIds,
  normalizeKeyText,
  toExternalIdKey,
  type ExternalId
} from '@shared/identity'
import type { Locale } from '@shared/locale'
import type { ScrapedEntityIdentity, ScraperLookup } from '@shared/scraper'
import type { BaseResolvedTarget, BaseScraperSession } from '../../types'

export interface ScraperInvocationState<
  TTarget extends BaseResolvedTarget,
  TSession extends BaseScraperSession<TSlot, TResultMap>,
  TSlot extends string,
  TResultMap extends Partial<Record<TSlot, unknown>>,
  TResult
> {
  getOrCreateResolvedTarget(
    providerId: string,
    lookup: ScraperLookup,
    locale: Locale,
    resolver: () => Promise<TTarget | null>
  ): Promise<TTarget | null>
  getOrCreateSession(
    providerId: string,
    target: TTarget,
    locale: Locale,
    opener: () => Promise<TSession>
  ): Promise<TSession>
  getPayloadTask<TValue>(
    providerId: string,
    target: TTarget,
    slot: TSlot,
    locale: Locale
  ): Promise<TValue | null> | undefined
  setPayloadTask<TValue>(
    providerId: string,
    target: TTarget,
    slot: TSlot,
    locale: Locale,
    task: Promise<TValue | null>
  ): Promise<TValue | null>
  collectIdentity(identity: ScrapedEntityIdentity): void
  getCollectedIdentities(): readonly ScrapedEntityIdentity[]
  collect(result: TResult): void
  getCollectedResults(): readonly TResult[]
  dispose(): Promise<void>
}

function buildKnownIdsCacheKey(knownIds: ExternalId[] | undefined): string {
  return normalizeExternalIds(knownIds)
    .map((externalId) => toExternalIdKey(externalId))
    .sort()
    .join('|')
}

function buildResolveCacheKey(providerId: string, lookup: ScraperLookup, locale: Locale): string {
  return [
    providerId,
    normalizeKeyText(lookup.name),
    buildKnownIdsCacheKey(lookup.knownIds),
    locale
  ].join('::')
}

function buildSessionCacheKey(
  providerId: string,
  target: BaseResolvedTarget,
  locale: Locale
): string {
  return [providerId, target.cacheKey, locale].join('::')
}

function buildPayloadCacheKey(
  providerId: string,
  target: BaseResolvedTarget,
  slot: string,
  locale: Locale
): string {
  return [providerId, target.cacheKey, slot, locale].join('::')
}

/**
 * Create invocation-scoped scraper caches and collected-result storage.
 */
export function createScraperInvocationState<
  TTarget extends BaseResolvedTarget,
  TSession extends BaseScraperSession<TSlot, TResultMap>,
  TSlot extends string,
  TResultMap extends Partial<Record<TSlot, unknown>>,
  TResult
>(): ScraperInvocationState<TTarget, TSession, TSlot, TResultMap, TResult> {
  const resolveCache = new Map<string, Promise<TTarget | null>>()
  const sessionCache = new Map<string, Promise<TSession>>()
  const payloadCache = new Map<string, Promise<unknown | null>>()
  const collectedIdentities: ScrapedEntityIdentity[] = []
  const collectedResults: TResult[] = []

  return {
    getOrCreateResolvedTarget(providerId, lookup, locale, resolver) {
      const cacheKey = buildResolveCacheKey(providerId, lookup, locale)
      const cached = resolveCache.get(cacheKey)
      if (cached) {
        return cached
      }

      const task = resolver()
      resolveCache.set(cacheKey, task)
      return task
    },

    getOrCreateSession(providerId, target, locale, opener) {
      const cacheKey = buildSessionCacheKey(providerId, target, locale)
      const cached = sessionCache.get(cacheKey)
      if (cached) {
        return cached
      }

      const task = opener()
      sessionCache.set(cacheKey, task)
      return task
    },

    getPayloadTask<TValue>(providerId: string, target: TTarget, slot: TSlot, locale: Locale) {
      const cacheKey = buildPayloadCacheKey(providerId, target, slot, locale)
      return payloadCache.get(cacheKey) as Promise<TValue | null> | undefined
    },

    setPayloadTask<TValue>(
      providerId: string,
      target: TTarget,
      slot: TSlot,
      locale: Locale,
      task: Promise<TValue | null>
    ) {
      const cacheKey = buildPayloadCacheKey(providerId, target, slot, locale)
      const existing = payloadCache.get(cacheKey)
      if (existing) {
        return existing as Promise<TValue | null>
      }

      payloadCache.set(cacheKey, task as Promise<unknown | null>)
      return task
    },

    collectIdentity(identity) {
      collectedIdentities.push(identity)
    },

    getCollectedIdentities() {
      return [...collectedIdentities]
    },

    collect(result) {
      collectedResults.push(result)
    },

    getCollectedResults() {
      return [...collectedResults]
    },

    async dispose() {
      const sessionResults = await Promise.allSettled(Array.from(sessionCache.values()))
      const disposeTasks = sessionResults.flatMap((result) => {
        if (result.status !== 'fulfilled') {
          return []
        }

        return result.value.dispose ? [result.value.dispose()] : []
      })

      await Promise.allSettled(disposeTasks)
    }
  }
}
