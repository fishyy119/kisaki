/**
 * Shared runtime helpers for scraper handlers.
 *
 * These utilities are main-process only and are intentionally scoped to the
 * handler layer rather than the generic scraper utils directory.
 */

import log from 'electron-log/main'
import type { ScraperProfile, ScraperProviderEntry, ScraperSlot, SlotStrategy } from '@shared/db'
import {
  getScraperSlotsForMediaType,
  normalizeSlotConfigs,
  type ProfileCleanupAction,
  type ScraperCapability,
  type ScraperMediaType,
  type SlotConfigsForMediaType
} from '@shared/scraper'
import {
  normalizeExternalIds,
  normalizeKeyText,
  toExternalIdKey,
  type ExternalId
} from '@shared/identity'
import type { Locale } from '@shared/locale'

export type { ProfileCleanupAction }

export interface ResolveResult {
  id: string
  originalName?: string
}

export interface SearchResultLike {
  id: string
  originalName?: string
}

export interface RegisteredScraperProvider {
  readonly id: string
  readonly name: string
  readonly capabilities: readonly ScraperCapability[]
}

type SearchableScraperProvider<TSearchResult extends SearchResultLike> =
  RegisteredScraperProvider & {
    search(query: string, locale?: Locale): Promise<TSearchResult[]>
  }

type CapabilityMethodTuple<TProvider> = readonly [ScraperCapability, keyof TProvider]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function compareProviderEntries(
  a: { priority: number; index: number },
  b: { priority: number; index: number }
): number {
  return a.priority - b.priority || a.index - b.index
}

function sortProviderEntries(entries: readonly ScraperProviderEntry[]): ScraperProviderEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) =>
      compareProviderEntries(
        { priority: a.entry.priority, index: a.index },
        { priority: b.entry.priority, index: b.index }
      )
    )
    .map(({ entry }) => ({ ...entry }))
}

function buildKnownIdsCacheKey(knownIds: ExternalId[] | undefined): string {
  return normalizeExternalIds(knownIds)
    .map((externalId) => toExternalIdKey(externalId))
    .sort()
    .join('|')
}

function buildResolveCacheKey(
  providerId: string,
  name: string,
  knownIds: ExternalId[] | undefined,
  locale: Locale
): string {
  return [providerId, normalizeKeyText(name), buildKnownIdsCacheKey(knownIds), locale].join('::')
}

/**
 * Validate that a provider's declared capabilities match its implemented methods.
 */
export function assertProviderContract<TProvider extends RegisteredScraperProvider>(
  provider: TProvider,
  allowedCapabilities: ReadonlySet<ScraperCapability>,
  capabilityMethods: ReadonlyArray<CapabilityMethodTuple<TProvider>>
): void {
  if (typeof provider.id !== 'string' || !provider.id.trim()) {
    throw new Error('[Scraper] Provider id is required')
  }

  if (typeof provider.name !== 'string' || !provider.name.trim()) {
    throw new Error(`[Scraper] Provider name is required (${provider.id})`)
  }

  if (!Array.isArray(provider.capabilities) || provider.capabilities.length === 0) {
    throw new Error(`[Scraper] Provider '${provider.id}' capabilities must be a non-empty array`)
  }

  const declared = new Set<ScraperCapability>()
  for (const capability of provider.capabilities) {
    if (!allowedCapabilities.has(capability)) {
      throw new Error(
        `[Scraper] Provider '${provider.id}' declares invalid capability: ${capability}`
      )
    }

    if (declared.has(capability)) {
      throw new Error(
        `[Scraper] Provider '${provider.id}' declares duplicate capability: ${capability}`
      )
    }

    declared.add(capability)
  }

  if (!declared.has('search')) {
    throw new Error(`[Scraper] Provider '${provider.id}' must declare 'search' capability`)
  }

  for (const [capability, method] of capabilityMethods) {
    const fn = (provider as Record<string, unknown>)[method as string]
    const hasMethod = typeof fn === 'function'
    const hasCapability = declared.has(capability)

    if (hasCapability && !hasMethod) {
      throw new Error(
        `[Scraper] Provider '${provider.id}' declares '${capability}' but does not implement '${String(method)}'`
      )
    }

    if (hasMethod && !hasCapability) {
      throw new Error(
        `[Scraper] Provider '${provider.id}' implements '${String(method)}' but does not declare '${capability}'`
      )
    }
  }
}

/**
 * Return enabled provider entries in the same order the runtime should execute them.
 */
export function getOrderedEnabledProviderEntries(
  entries: readonly ScraperProviderEntry[]
): ScraperProviderEntry[] {
  return sortProviderEntries(entries).filter((entry) => entry.enabled)
}

function isUsableSlotProvider(
  provider: RegisteredScraperProvider | undefined,
  slot: ScraperSlot
): boolean {
  return Boolean(
    provider && provider.capabilities.includes('search') && provider.capabilities.includes(slot)
  )
}

function sanitizeProviderEntries(
  slot: ScraperSlot,
  entries: readonly ScraperProviderEntry[],
  providers: Map<string, RegisteredScraperProvider>
): ScraperProviderEntry[] {
  return sortProviderEntries(entries)
    .filter((entry) => isUsableSlotProvider(providers.get(entry.providerId), slot))
    .map((entry, priority) => ({
      ...entry,
      priority
    }))
}

function serializeSlotConfigs(value: ScraperProfile['slotConfigs']): string {
  return JSON.stringify(value ?? null) ?? 'null'
}

/**
 * Canonicalize a profile's slot configs and drop providers that cannot legally serve a slot.
 */
export function sanitizeSlotConfigs<T extends ScraperMediaType>(
  mediaType: T,
  slotConfigs: ScraperProfile['slotConfigs'],
  providers: Map<string, RegisteredScraperProvider>
): {
  slotConfigs: SlotConfigsForMediaType<T>
  changed: boolean
} {
  const cleaned = normalizeSlotConfigs(mediaType, slotConfigs)
  const slots = getScraperSlotsForMediaType(
    mediaType
  ) as readonly (keyof SlotConfigsForMediaType<T> & ScraperSlot)[]

  for (const slot of slots) {
    const config = cleaned[slot] as { providers: ScraperProviderEntry[] }
    config.providers = sanitizeProviderEntries(slot, config.providers, providers)
  }

  return {
    slotConfigs: cleaned,
    changed: serializeSlotConfigs(cleaned) !== serializeSlotConfigs(slotConfigs)
  }
}

/**
 * Check whether a provider exists in the registry.
 */
export function hasRegisteredProvider(
  providers: Map<string, RegisteredScraperProvider>,
  providerId: string
): boolean {
  return providers.has(providerId)
}

/**
 * Determine whether a slot fetch returned data that should count as a successful result.
 */
function hasValidInfoData(data: unknown, strategy: SlotStrategy): boolean {
  if (!isPlainObject(data)) {
    return false
  }

  if (strategy !== 'first') {
    return true
  }

  return typeof data.name === 'string' && data.name.trim().length > 0
}

export function hasValidSlotData(
  slot: ScraperSlot,
  data: unknown,
  strategy: SlotStrategy
): boolean {
  if (slot === 'info') {
    return hasValidInfoData(data, strategy)
  }

  return Array.isArray(data) && data.length > 0
}

/**
 * Build a promise-based resolve cache so repeated slot execution can share provider searches.
 */
export function createResolveCache<TSearchResult extends SearchResultLike>(
  providers: Map<string, SearchableScraperProvider<TSearchResult>>
): (
  providerId: string,
  name: string,
  knownIds: ExternalId[] | undefined,
  locale: Locale
) => Promise<ResolveResult | null> {
  const cache = new Map<string, Promise<ResolveResult | null>>()

  return async (
    providerId: string,
    name: string,
    knownIds: ExternalId[] | undefined,
    locale: Locale
  ): Promise<ResolveResult | null> => {
    const cacheKey = buildResolveCacheKey(providerId, name, knownIds, locale)
    const cached = cache.get(cacheKey)
    if (cached) {
      return cached
    }

    const task = (async () => {
      const known = knownIds?.find((externalId) => externalId.source === providerId)
      if (known) {
        return { id: known.id }
      }

      const provider = providers.get(providerId)
      if (!provider || !provider.capabilities.includes('search')) {
        log.warn(`[Scraper] Provider '${providerId}' does not support search`)
        return null
      }

      try {
        const results = await provider.search(name, locale)
        const first = results[0]

        if (!first) {
          log.warn(`[Scraper] No results for '${name}' via ${providerId}`)
          return null
        }

        log.info(`[Scraper] Resolved '${name}' to ${first.id} via ${providerId}`)
        return {
          id: first.id,
          originalName: first.originalName
        }
      } catch (error) {
        log.warn(`[Scraper] Search failed for '${name}' via ${providerId}:`, error)
        return null
      }
    })()

    cache.set(cacheKey, task)
    return task
  }
}
