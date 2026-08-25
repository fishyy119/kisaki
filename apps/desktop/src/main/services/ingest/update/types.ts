/**
 * Shapes shared by every entity's update pipeline.
 *
 * Entity-specific current/incoming/plan shapes live with the entity that owns
 * them, in `update/<entity>/types.ts`.
 */

import type { IngestUpdatePolicy } from '@shared/ingest/update'
import type { ScrapedRelatedEntryFact } from '@shared/scraper'
import type { PendingAssetTask } from '../assets'

export interface UpdateIncomingBundle<TCore, TRelationFacts, TMediaCandidates> {
  core: Partial<TCore>
  relationFacts: Partial<TRelationFacts>
  mediaCandidates: Partial<TMediaCandidates>
}

/** How a collection write target reconciles incoming values with stored ones. */
export type CollectionUpdateMode = IngestUpdatePolicy['collectionUpdate']

/** Surfaces the scraper answered at all; only these may be applied. */
export interface UpdateIncomingAvailability<TSurface extends string> {
  surfaces: Set<TSurface>
}

/**
 * Availability for entities that write relation link tables.
 *
 * A link table can be fed by several fact sources, so "may be written" and "may
 * be cleared" are different questions: writing needs one answer, while clearing
 * needs every source to have answered.
 */
export interface UpdateIncomingRelationAvailability<
  TSurface extends string,
  TLinkKind extends string
> extends UpdateIncomingAvailability<TSurface> {
  /** Link tables whose every fact source answered; only these may be cleared. */
  completeLinks: Set<TLinkKind>
}

export interface UpdateIncomingBuildResult<TAvailability, TCore, TRelationFacts, TMediaCandidates> {
  incoming: UpdateIncomingBundle<TCore, TRelationFacts, TMediaCandidates>
  availability: TAvailability
}

/**
 * Related-entry write resolved for one update. A single fact source feeds the
 * table, so an answered slot is always complete and `replace` never degrades.
 */
export interface RelatedEntriesUpdatePlan {
  facts: ScrapedRelatedEntryFact[]
  mode: CollectionUpdateMode
}

export interface UpdateApplyResult {
  pendingAssets: PendingAssetTask[]
}

export interface UpdateLinkApplyResult<TLinkKind extends string> extends UpdateApplyResult {
  /** Stored rows per link table that a `replace` would have deleted but merge kept. */
  preservedLinkRows: Partial<Record<TLinkKind, number>>
  /** Scraped related entries skipped because their targets are not in the library. */
  unresolvedRelatedEntries?: number
}

export interface UpdateResolvedSelection<
  TSurface extends string,
  TCoreSurface extends TSurface,
  TMediaSurface extends TSurface,
  TRelationSurface extends TSurface = never
> {
  surfaces: TSurface[]
  coreSurfaces: TCoreSurface[]
  mediaSurfaces: TMediaSurface[]
  relationSurfaces: TRelationSurface[]
}

export interface TagLinkValue {
  tagId: string
  isSpoiler: boolean
  note: string | null
}

export interface UpdateCurrentSelection<TCoreSurface extends string> {
  coreSurfaces: TCoreSurface[]
}
