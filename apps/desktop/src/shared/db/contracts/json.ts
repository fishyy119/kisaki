/**
 * Database JSON field types
 *
 * Type definitions for complex JSON structures stored in SQLite text columns.
 */

import type { ContentLocale } from '@shared/i18n'

/** Related site link */
export interface RelatedSite {
  label: string
  url: string
}

/** Game save backup record */
export interface SaveBackup {
  backupAt: number
  note: string
  locked: boolean
  saveFile: string
  sizeBytes?: number
}

/** Failed scan record */
export interface FailedScan {
  name: string
  reason: string
  path: string
}

/**
 * Name extraction rule for scanner.
 * @remarks Type alias keeps the implicit index signature so rules stay
 * assignable to JSON value contracts at the extension boundary.
 */
export type NameExtractionRule = {
  /** Unique identifier for ordering/management */
  id: string
  /** Human-readable description */
  description: string
  /** Regex pattern with named capture group 'name', e.g. ^\[.*?\]\s*(?<name>.+) */
  pattern: string
  /** Whether this rule is enabled */
  enabled: boolean
}

/** Scanner ignored folder names */
export type ScannerIgnoredNames = string[]

/**
 * Partial date object stored as JSON.
 *
 * Supported forms:
 * - { year }
 * - { year, month }
 * - { year, month, day }
 * - { month, day }
 * - { month }
 * - { day }
 */
export interface PartialDate {
  year?: number
  month?: number
  day?: number
}

// =============================================================================
// Library Filter Types
// =============================================================================

/** Date range value for dateRange fields */
export interface DateRangeValue {
  /** YYYY-MM-DD */
  from?: string
  /** YYYY-MM-DD */
  to?: string
}

/** Number range value for numberRange fields */
export interface NumberRangeValue {
  min?: number
  max?: number
}

/** Relation filter value */
export interface RelationValue {
  match: 'any' | 'all'
  ids: string[]
}

export type FilterValue =
  true | string | string[] | NumberRangeValue | DateRangeValue | RelationValue

/** Filter state stored as JSON (field key -> value). */
export type FilterState = Record<string, FilterValue>

/** Showcase section layout type */
export type SectionLayout = 'horizontal' | 'grid'

/** Showcase section item size */
export type SectionItemSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

/** Showcase section open mode */
export type SectionOpenMode = 'page' | 'dialog'

// =============================================================================
// Dynamic Collection Types
// =============================================================================

/** Sort direction */
export type SortDirection = 'asc' | 'desc'

/** Filter + sort config for one entity type in dynamic collection */
export interface DynamicEntityConfig {
  /** Whether this entity type is included in the dynamic collection */
  enabled: boolean
  /** Filter state */
  filter: FilterState
  /** Sort field */
  sortField: string
  /** Sort direction */
  sortDirection: SortDirection
}

/** Full dynamic collection configuration - always contains all 4 entity types */
export type DynamicCollectionConfig = Record<
  'game' | 'character' | 'person' | 'company',
  DynamicEntityConfig
>

// =============================================================================
// Scraper Profile Types (stored as JSON in scraperProfiles table)
// =============================================================================

// -----------------------------------------------------------------------------
// Scraper Slots (per media type)
// -----------------------------------------------------------------------------

export type GameScraperSlot =
  | 'info'
  | 'tags'
  | 'characters'
  | 'persons'
  | 'companies'
  | 'covers'
  | 'backdrops'
  | 'logos'
  | 'icons'

export type PersonScraperSlot = 'info' | 'tags' | 'photos'

export type CompanyScraperSlot = 'info' | 'tags' | 'logos'

export type CharacterScraperSlot = 'info' | 'tags' | 'persons' | 'photos'

/**
 * Union of all slot names used across all scraper media types.
 *
 * Used for:
 * - Provider capability declarations
 * - Renderer filtering (ScraperProviderSelect requiredCapabilities)
 * - Slot config editing UI
 */
export type ScraperSlot =
  GameScraperSlot | PersonScraperSlot | CompanyScraperSlot | CharacterScraperSlot

/** Shared strategy for combining multiple provider results. */
export type SlotStrategy = 'first' | 'enrich'

/** Policy for unmatched entities in relation-collection slots. */
export type UnmatchedEntityPolicy = 'ignore' | 'append'

/** Configuration for a provider within a slot. providerId is scoped by the profile mediaType. */
export interface ScraperProviderEntry {
  providerId: string
  enabled: boolean
  priority: number
  locale?: ContentLocale | null
}

/** Base configuration shared by all slots. */
export interface BasicSlotConfig {
  providers: ScraperProviderEntry[]
  strategy: SlotStrategy
}

/** Additional configuration required by relation-collection slots. */
export interface RelationCollectionSlotConfig extends BasicSlotConfig {
  unmatchedEntityPolicy: UnmatchedEntityPolicy
}

/** Configuration for a single slot. */
export type SlotConfig = BasicSlotConfig | RelationCollectionSlotConfig

/**
 * Scraper slot configurations stored in DB.
 *
 * Each profile stores only the slots relevant to its mediaType.
 */
export type ScraperSlotConfigs = Record<string, SlotConfig>

export type GameScraperSlotConfigs = {
  info: BasicSlotConfig
  tags: BasicSlotConfig
  characters: RelationCollectionSlotConfig
  persons: RelationCollectionSlotConfig
  companies: RelationCollectionSlotConfig
  covers: BasicSlotConfig
  backdrops: BasicSlotConfig
  logos: BasicSlotConfig
  icons: BasicSlotConfig
}

export type PersonScraperSlotConfigs = {
  info: BasicSlotConfig
  tags: BasicSlotConfig
  photos: BasicSlotConfig
}

export type CompanyScraperSlotConfigs = {
  info: BasicSlotConfig
  tags: BasicSlotConfig
  logos: BasicSlotConfig
}

export type CharacterScraperSlotConfigs = {
  info: BasicSlotConfig
  tags: BasicSlotConfig
  persons: RelationCollectionSlotConfig
  photos: BasicSlotConfig
}
