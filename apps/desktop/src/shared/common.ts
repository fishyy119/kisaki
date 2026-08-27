/**
 * Entity Type System
 *
 * Unified type definitions for all entity types in the application.
 * This is the single source of truth - all modules should import from here.
 *
 * Entity Categories:
 * 1. Media Types - Primary content entities (game, ...)
 * 2. Metadata Types - Entities associated with media (character, person, company)
 * 3. Organizer Types - Container entities for grouping (collection, tag)
 */

// =============================================================================
// Core Entity Types
// =============================================================================

/**
 * Media types - Primary content entities that users manage
 *
 * Each media type has:
 * - Dedicated database table
 * - Scanner support
 * - Scraper support
 * - Independent library page at /library/$mediaType
 *
 * Kisaki serves ACGN collections, so a media type must both consume differently
 * (session/episode/page) and fit the shared ACGN metadata graph, where a
 * character is a first-class entity a work links to. Target set: game, anime,
 * comic, novel, plus music and audio in a second ring; live-action ecosystems
 * are out of scope because their sources issue cast credits rather than
 * characters.
 */
export type MediaType = 'game' | 'anime' | 'comic' | 'novel'

/**
 * Metadata entity types - Entities associated with media
 *
 * These entities:
 * - Have their own database tables
 * - Are primarily created through scraping (not user-created)
 * - Have independent detail pages
 * - Can be browsed at /library/$metadataType
 */
export type MetadataType = 'character' | 'person' | 'company'

/**
 * Organizer entity types - Container entities for grouping content
 *
 * These entities:
 * - Group/categorize content entities (MediaType | MetadataType)
 * - Have their own database tables
 * - collection: has list page + detail page
 * - tag: has detail dialog (no dedicated page)
 */
export type OrganizerType = 'collection' | 'tag'

// =============================================================================
// Composite Types
// =============================================================================

/**
 * Content entity types - Entities that can be organized by collection/tag
 *
 * Used for:
 * - Router params at /library/$entityType
 * - Filter schemas and query building
 * - Collection/Tag entity type tabs
 * - EntityCard rendering in Showcase
 */
export type ContentEntityType = MediaType | MetadataType

/**
 * All entity types - Every entity with independent CRUD operations
 *
 * Used for:
 * - Showcase sections (all entity types can be displayed as cards)
 * - Complete entity type validation
 */
export type AllEntityType = ContentEntityType | OrganizerType

// =============================================================================
// Type Constants (for iteration and validation)
// =============================================================================

export const MEDIA_TYPES: readonly MediaType[] = ['game', 'anime', 'comic', 'novel']

/**
 * Media types that carry voice credits.
 *
 * A cast row is "this person voices this character in this entry"; print
 * media has no audio track, so comics and novels never own cast tables.
 */
export type CastMediaType = 'game' | 'anime'

export const CAST_MEDIA_TYPES: readonly CastMediaType[] = ['game', 'anime']

/**
 * Media types whose consumption units are enumerable rows (episodes,
 * chapters, volumes) carrying dated completion facts.
 *
 * Game has no entry: its consumption unit is the play session itself, so
 * session records already carry the whole consumption fact.
 */
export type UnitMediaType = 'anime' | 'comic' | 'novel'

export const UNIT_MEDIA_TYPES: readonly UnitMediaType[] = ['anime', 'comic', 'novel']

export const METADATA_TYPES: readonly MetadataType[] = ['character', 'person', 'company']

export const ORGANIZER_TYPES: readonly OrganizerType[] = ['collection', 'tag']

export const CONTENT_ENTITY_TYPES: readonly ContentEntityType[] = [
  ...MEDIA_TYPES,
  ...METADATA_TYPES
]

export const ALL_ENTITY_TYPES: readonly AllEntityType[] = [
  ...CONTENT_ENTITY_TYPES,
  ...ORGANIZER_TYPES
]

// =============================================================================
// Type Guards
// =============================================================================

export function isMediaType(value: string): value is MediaType {
  return (MEDIA_TYPES as readonly string[]).includes(value)
}

export function isMetadataType(value: string): value is MetadataType {
  return (METADATA_TYPES as readonly string[]).includes(value)
}

export function isOrganizerType(value: string): value is OrganizerType {
  return (ORGANIZER_TYPES as readonly string[]).includes(value)
}

export function isContentEntityType(value: string): value is ContentEntityType {
  return (CONTENT_ENTITY_TYPES as readonly string[]).includes(value)
}

export function isAllEntityType(value: string): value is AllEntityType {
  return (ALL_ENTITY_TYPES as readonly string[]).includes(value)
}

// =============================================================================
// Other Common Types
// =============================================================================

/**
 * Sort direction for list ordering
 */
export type SortDirection = 'asc' | 'desc'

/**
 * User theme preference owned by the renderer theme store and reported to main.
 */
export type AppTheme = 'light' | 'dark' | 'system'
