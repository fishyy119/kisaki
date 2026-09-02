import type { MediaType } from '@shared/entity-types'
import type { RawDbChange } from '@shared/db/changes'
import type { LibraryEntityTopic } from '@shared/library'

export const FEED_DEBOUNCE_MS = 25

/** Upper bound on summaries per `db:changed` push, so bulk writes stay deliverable. */
export const FEED_PUSH_CHUNK_SIZE = 2000

export type MediaEntityTopic = Extract<LibraryEntityTopic, MediaType>

export type ConfiguredEntityTopic = Exclude<LibraryEntityTopic, MediaEntityTopic>

export interface EntityGroup {
  entity: LibraryEntityTopic
  id: string
  changes: RawDbChange[]
}

export interface MediaRow {
  id: string
  name: string
}

export interface MediaLinkTables {
  person: string
  company: string
  character: string
  /** Absent for media types without voice credits (comics, novels). */
  cast?: string
}

/** Table and column layout of one media type, for change projection. */
export interface MediaFeedProjection {
  entity: MediaEntityTopic
  table: string
  /** Column every related table uses to point back at the media row. */
  ownerColumn: string
  /** Ordering column shared by the media-owned link tables. */
  orderColumn: string
  externalIdsTable: string
  tagLinksTable: string
  collectionLinksTable: string
  linkTables: MediaLinkTables
  /** Owned rows that only redirect the feed at their media row. */
  ownedTables: readonly string[]
  coreFields: Record<string, string>
  assetFields: Record<string, string>
  /** Present when the media type tracks per-episode watch state. */
  episodesTable?: string
  /** Present when the media type tracks per-unit read state (chapters, volumes). */
  unitsTable?: string
}

export interface EntityProjection {
  entity: ConfiguredEntityTopic
  coreFields: Record<string, string>
  scoreField?: string
  assetFields?: Record<string, string>
  dynamicConfigFields?: Record<string, string>
}
