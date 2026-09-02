/**
 * Entity type system.
 *
 * The single source of truth for every entity type in the application; all
 * modules import from here. Kisaki grows by media type, so this union is the
 * primary growth axis: per-entity behavior is declared in registries keyed by
 * these unions, and adding a type here makes the compiler flag every remaining
 * decision point.
 *
 * Entity categories:
 * 1. Media types - the works users consume (game, anime, comic, novel)
 * 2. Satellite types - cross-media shared entities the works link to
 *    (character, person, company)
 * 3. Organizer types - containers that group content (collection, tag)
 */

// =============================================================================
// Core Entity Types
// =============================================================================

/**
 * Media types - the works users manage and consume.
 *
 * Each media type has a dedicated database table, scanner support, scraper
 * support, and an independent library page at `/library/$mediaType`.
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
 * Satellite types - entities that orbit media.
 *
 * A satellite is cross-media knowledge (a person voices characters in games and
 * animes alike), so its rows are shared by every media type and safe to dedupe.
 * Satellites have their own tables and detail pages, are primarily created
 * through scraping, and can be browsed at `/library/$satelliteType`.
 */
export type SatelliteType = 'character' | 'person' | 'company'

/**
 * Organizer types - containers that group content entities.
 *
 * - collection: has a list page and a detail page
 * - tag: has a detail dialog (no dedicated page)
 */
export type OrganizerType = 'collection' | 'tag'

// =============================================================================
// Composite Types
// =============================================================================

/**
 * Content entity types - everything an organizer can group.
 *
 * Used for router params at `/library/$entityType`, filter schemas and query
 * building, collection/tag entity type tabs, and entity cards in the showcase.
 */
export type ContentEntityType = MediaType | SatelliteType

/**
 * All entity types - every entity with independent CRUD operations.
 *
 * Used for showcase sections (every entity type renders as a card) and for
 * complete entity type parsing.
 */
export type AllEntityType = ContentEntityType | OrganizerType

// =============================================================================
// Type Constants (for iteration and parsing)
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

export const SATELLITE_TYPES: readonly SatelliteType[] = ['character', 'person', 'company']

export const ORGANIZER_TYPES: readonly OrganizerType[] = ['collection', 'tag']

export const CONTENT_ENTITY_TYPES: readonly ContentEntityType[] = [
  ...MEDIA_TYPES,
  ...SATELLITE_TYPES
]

export const ALL_ENTITY_TYPES: readonly AllEntityType[] = [
  ...CONTENT_ENTITY_TYPES,
  ...ORGANIZER_TYPES
]

// =============================================================================
// Parsers
// =============================================================================
//
// Entity type strings arrive from untrusted places (route params, deeplinks,
// persisted JSON), so the boundary parses them into the union or reports
// failure with null; trusted code never needs these.

function parseMember<T extends string>(members: readonly T[], value: string): T | null {
  return (members as readonly string[]).includes(value) ? (value as T) : null
}

export function parseMediaType(value: string): MediaType | null {
  return parseMember(MEDIA_TYPES, value)
}

export function parseSatelliteType(value: string): SatelliteType | null {
  return parseMember(SATELLITE_TYPES, value)
}

export function parseOrganizerType(value: string): OrganizerType | null {
  return parseMember(ORGANIZER_TYPES, value)
}

export function parseContentEntityType(value: string): ContentEntityType | null {
  return parseMember(CONTENT_ENTITY_TYPES, value)
}

export function parseAllEntityType(value: string): AllEntityType | null {
  return parseMember(ALL_ENTITY_TYPES, value)
}

// =============================================================================
// Category Predicates
// =============================================================================
//
// Trusted narrowing within the union: the parameter is already an entity type,
// so these answer a domain question ("is this a media type?") rather than
// validating input. A raw string does not type-check here; parse it first.

export function isMediaType(type: AllEntityType): type is MediaType {
  return (MEDIA_TYPES as readonly AllEntityType[]).includes(type)
}

export function isSatelliteType(type: AllEntityType): type is SatelliteType {
  return (SATELLITE_TYPES as readonly AllEntityType[]).includes(type)
}

export function isOrganizerType(type: AllEntityType): type is OrganizerType {
  return (ORGANIZER_TYPES as readonly AllEntityType[]).includes(type)
}

export function isContentEntityType(type: AllEntityType): type is ContentEntityType {
  return (CONTENT_ENTITY_TYPES as readonly AllEntityType[]).includes(type)
}
