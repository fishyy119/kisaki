/**
 * Slot utilities shared by scraper handlers, renderer forms, and extension-facing types.
 */

import type {
  BasicSlotConfig,
  CharacterScraperSlot,
  CharacterScraperSlotConfigs,
  CompanyScraperSlot,
  CompanyScraperSlotConfigs,
  GameScraperSlot,
  GameScraperSlotConfigs,
  PersonScraperSlot,
  PersonScraperSlotConfigs,
  RelationCollectionSlotConfig,
  ScraperProviderEntry,
  ScraperSlot,
  ScraperSlotConfigs,
  SlotConfig,
  SlotStrategy,
  UnmatchedEntityPolicy
} from '@shared/db'
import type { ContentEntityType } from '@shared/common'
import type { ExternalId } from '@shared/identity'
import type { Locale } from '@shared/locale'
import {
  CHARACTER_SCRAPER_SLOTS,
  COMPANY_SCRAPER_SLOTS,
  GAME_SCRAPER_SLOTS,
  PERSON_SCRAPER_SLOTS
} from '@shared/db'

export type ScraperMediaType = ContentEntityType

export type RelationCollectionScraperSlot = 'characters' | 'persons' | 'companies'

export type SlotConfigForSlot<S extends ScraperSlot> = S extends RelationCollectionScraperSlot
  ? RelationCollectionSlotConfig
  : BasicSlotConfig

export interface ScraperSlotConfigsByMediaType {
  game: GameScraperSlotConfigs
  person: PersonScraperSlotConfigs
  company: CompanyScraperSlotConfigs
  character: CharacterScraperSlotConfigs
}

export type SlotConfigsForMediaType<T extends ScraperMediaType> = ScraperSlotConfigsByMediaType[T]

export const SLOT_STRATEGIES = ['first', 'enrich'] as const satisfies readonly SlotStrategy[]
export const UNMATCHED_ENTITY_POLICIES = [
  'ignore',
  'append'
] as const satisfies readonly UnmatchedEntityPolicy[]

/** Image slot type - union of all image-related slots across all media types. */
export type ScraperImageSlot = 'covers' | 'backdrops' | 'logos' | 'icons' | 'photos'

/** Game image slot types. */
export type GameImageSlot = 'covers' | 'backdrops' | 'logos' | 'icons'

/** Game image slot list. */
export const GAME_IMAGE_SLOTS: GameImageSlot[] = ['covers', 'backdrops', 'logos', 'icons']

/** Image slot types. */
export const SCRAPER_IMAGE_SLOTS: ScraperImageSlot[] = [...GAME_IMAGE_SLOTS, 'photos']

const RELATION_COLLECTION_SCRAPER_SLOTS: readonly RelationCollectionScraperSlot[] = [
  'characters',
  'persons',
  'companies'
]

const SIMPLE_COLLECTION_SLOTS: readonly ScraperSlot[] = [
  'tags',
  'covers',
  'backdrops',
  'logos',
  'icons',
  'photos'
]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isSlotStrategy(value: unknown): value is SlotStrategy {
  return typeof value === 'string' && SLOT_STRATEGIES.includes(value as SlotStrategy)
}

function isUnmatchedEntityPolicy(value: unknown): value is UnmatchedEntityPolicy {
  return (
    typeof value === 'string' && UNMATCHED_ENTITY_POLICIES.includes(value as UnmatchedEntityPolicy)
  )
}

function isScraperProviderEntry(value: unknown): value is ScraperProviderEntry {
  if (!isPlainObject(value)) return false
  return (
    typeof value.providerId === 'string' &&
    typeof value.enabled === 'boolean' &&
    Number.isInteger(value.priority) &&
    (value.locale === undefined || value.locale === null || typeof value.locale === 'string')
  )
}

function normalizeProviderEntries(value: unknown): ScraperProviderEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isScraperProviderEntry)
    .map((entry) => ({
      providerId: entry.providerId.trim(),
      enabled: entry.enabled,
      priority: entry.priority,
      locale: entry.locale ?? undefined
    }))
    .filter((entry) => entry.providerId.length > 0)
    .sort((a, b) => a.priority - b.priority)
    .map((entry, priority) => ({
      ...entry,
      priority
    }))
}

function normalizeBasicSlotConfig(value: unknown): BasicSlotConfig | null {
  if (!isPlainObject(value)) {
    return null
  }

  if (!('providers' in value) || !('strategy' in value)) {
    return null
  }

  return {
    strategy: isSlotStrategy(value.strategy) ? value.strategy : getDefaultSlotStrategy(),
    providers: normalizeProviderEntries(value.providers)
  }
}

export function getScraperSlotsForMediaType(mediaType: 'game'): readonly GameScraperSlot[]
export function getScraperSlotsForMediaType(mediaType: 'person'): readonly PersonScraperSlot[]
export function getScraperSlotsForMediaType(mediaType: 'company'): readonly CompanyScraperSlot[]
export function getScraperSlotsForMediaType(mediaType: 'character'): readonly CharacterScraperSlot[]
export function getScraperSlotsForMediaType(mediaType: ScraperMediaType): readonly ScraperSlot[]
export function getScraperSlotsForMediaType(mediaType: ScraperMediaType): readonly ScraperSlot[] {
  switch (mediaType) {
    case 'game':
      return GAME_SCRAPER_SLOTS
    case 'person':
      return PERSON_SCRAPER_SLOTS
    case 'company':
      return COMPANY_SCRAPER_SLOTS
    case 'character':
      return CHARACTER_SCRAPER_SLOTS
  }
}

/**
 * Normalize a profile's slot configs for the selected media type.
 *
 * Slots outside the active media type are dropped, missing slots are filled with defaults,
 * and provider priorities are reindexed into a stable 0-based sequence.
 */
export function normalizeSlotConfigs(
  mediaType: 'game',
  slotConfigs: ScraperSlotConfigs | null | undefined
): GameScraperSlotConfigs
export function normalizeSlotConfigs(
  mediaType: 'person',
  slotConfigs: ScraperSlotConfigs | null | undefined
): PersonScraperSlotConfigs
export function normalizeSlotConfigs(
  mediaType: 'company',
  slotConfigs: ScraperSlotConfigs | null | undefined
): CompanyScraperSlotConfigs
export function normalizeSlotConfigs(
  mediaType: 'character',
  slotConfigs: ScraperSlotConfigs | null | undefined
): CharacterScraperSlotConfigs
export function normalizeSlotConfigs<T extends ScraperMediaType>(
  mediaType: T,
  slotConfigs: ScraperSlotConfigs | null | undefined
): SlotConfigsForMediaType<T>
export function normalizeSlotConfigs<T extends ScraperMediaType>(
  mediaType: T,
  slotConfigs: ScraperSlotConfigs | null | undefined
): SlotConfigsForMediaType<T> {
  const normalized = {} as Record<string, SlotConfig>

  for (const slot of getScraperSlotsForMediaType(mediaType)) {
    normalized[slot] = normalizeSlotConfig(slot, slotConfigs?.[slot])
  }

  return normalized as SlotConfigsForMediaType<T>
}

// =============================================================================
// Universal Lookup Types
// =============================================================================

/**
 * Universal lookup identifier for scraper operations.
 *
 * Uses name as the cross-provider identifier, with optional known IDs for precision.
 * When a provider's ID is in knownIds, it will be used directly without searching.
 * Otherwise, the handler will search by name to resolve the provider's internal ID.
 */
export interface ScraperLookup {
  /** Entity name - universal identifier across providers. */
  name: string
  /** Preferred locale for resolve operations or single-provider helper paths. */
  locale?: Locale
  /** Known external IDs (e.g. from search selection or database). */
  knownIds?: ExternalId[]
}

/** Universal scraper provider capability. */
export type ScraperCapability = 'search' | ScraperSlot

/** Check if slot returns arrays (all slots except 'info' return arrays). */
export function isArraySlot(slot: ScraperSlot): boolean {
  return slot !== 'info'
}

/** Check if a slot is image based. */
export function isImageSlot(slot: ScraperSlot): slot is ScraperImageSlot {
  return (SCRAPER_IMAGE_SLOTS as readonly string[]).includes(slot)
}

/** Check if a slot is a relation collection. */
export function isRelationCollectionSlot(slot: ScraperSlot): slot is RelationCollectionScraperSlot {
  return (RELATION_COLLECTION_SCRAPER_SLOTS as readonly string[]).includes(slot)
}

/** Check if a slot is a non-relational collection. */
export function isSimpleCollectionSlot(slot: ScraperSlot): boolean {
  return (SIMPLE_COLLECTION_SLOTS as readonly string[]).includes(slot)
}

/** Get the slot strategies supported by all slots. */
export function getSupportedSlotStrategies(): readonly SlotStrategy[] {
  return SLOT_STRATEGIES
}

/** Get the default slot strategy. */
export function getDefaultSlotStrategy(): SlotStrategy {
  return 'first'
}

/** Get the default unmatched-entity policy for relation collections. */
export function getDefaultUnmatchedEntityPolicy(): UnmatchedEntityPolicy {
  return 'ignore'
}

/** Normalize a strategy into the supported shared slot strategy set. */
export function normalizeSlotStrategy(strategy: unknown): SlotStrategy {
  return isSlotStrategy(strategy) ? strategy : getDefaultSlotStrategy()
}

function normalizeSlotConfig<S extends ScraperSlot>(slot: S, value: unknown): SlotConfigForSlot<S> {
  const base = normalizeBasicSlotConfig(value)
  if (!base) {
    return createEmptySlotConfig(slot)
  }

  if (!isRelationCollectionSlot(slot)) {
    return base as SlotConfigForSlot<S>
  }

  const unmatchedEntityPolicy = isPlainObject(value) ? value.unmatchedEntityPolicy : undefined

  return {
    ...base,
    unmatchedEntityPolicy: isUnmatchedEntityPolicy(unmatchedEntityPolicy)
      ? unmatchedEntityPolicy
      : getDefaultUnmatchedEntityPolicy()
  } as SlotConfigForSlot<S>
}

interface CreateSlotConfigOptions {
  strategy?: SlotStrategy
  locale?: Locale | null
  unmatchedEntityPolicy?: UnmatchedEntityPolicy
}

/**
 * Create a slot config with providers in priority order.
 */
export function createSlotConfig<S extends ScraperSlot>(
  slot: S,
  providerIds: string[],
  options: CreateSlotConfigOptions = {}
): SlotConfigForSlot<S> {
  const base: BasicSlotConfig = {
    strategy: options.strategy ?? getDefaultSlotStrategy(),
    providers: providerIds
      .map((providerId) => providerId.trim())
      .filter(Boolean)
      .map((providerId, priority) => ({
        providerId,
        enabled: true,
        priority,
        locale: options.locale ?? undefined
      }))
  }

  if (!isRelationCollectionSlot(slot)) {
    return base as SlotConfigForSlot<S>
  }

  return {
    ...base,
    unmatchedEntityPolicy: options.unmatchedEntityPolicy ?? getDefaultUnmatchedEntityPolicy()
  } as SlotConfigForSlot<S>
}

/**
 * Create an empty slot config with the correct defaults for the slot.
 */
export function createEmptySlotConfig<S extends ScraperSlot>(slot: S): SlotConfigForSlot<S> {
  return createSlotConfig(slot, [])
}

/**
 * Create all slot configs for a provider based on its capabilities.
 *
 * Only adds the provider to slots it actually supports.
 */
export function createSlotConfigs(
  mediaType: 'game',
  providerId: string,
  capabilities: ScraperCapability[],
  locale?: Locale
): GameScraperSlotConfigs
export function createSlotConfigs(
  mediaType: 'person',
  providerId: string,
  capabilities: ScraperCapability[],
  locale?: Locale
): PersonScraperSlotConfigs
export function createSlotConfigs(
  mediaType: 'company',
  providerId: string,
  capabilities: ScraperCapability[],
  locale?: Locale
): CompanyScraperSlotConfigs
export function createSlotConfigs(
  mediaType: 'character',
  providerId: string,
  capabilities: ScraperCapability[],
  locale?: Locale
): CharacterScraperSlotConfigs
export function createSlotConfigs<T extends ScraperMediaType>(
  mediaType: T,
  providerId: string,
  capabilities: ScraperCapability[],
  locale?: Locale
): SlotConfigsForMediaType<T>
export function createSlotConfigs<T extends ScraperMediaType>(
  mediaType: T,
  providerId: string,
  capabilities: ScraperCapability[],
  locale?: Locale
): SlotConfigsForMediaType<T> {
  const configs = {} as Record<string, SlotConfig>

  for (const slot of getScraperSlotsForMediaType(mediaType)) {
    const supportsSlot = capabilities.includes(slot)
    configs[slot] = supportsSlot
      ? createSlotConfig(slot, [providerId], { locale })
      : createEmptySlotConfig(slot)
  }

  return configs as SlotConfigsForMediaType<T>
}

// =============================================================================
// Profile Cleanup Types
// =============================================================================

/** Action taken when ensuring profile validity. */
export type ProfileCleanupAction = 'deleted' | 'updated' | 'unchanged'
