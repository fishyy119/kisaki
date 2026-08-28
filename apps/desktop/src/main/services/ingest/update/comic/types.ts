import type {
  ComicUpdateCoreSurface,
  ComicUpdateMediaSurface,
  ComicUpdateRelationSurface,
  ComicUpdateSurface,
  IngestUpdatePolicy
} from '@shared/ingest/update'
import type { ExternalId } from '@shared/identity'
import type { ScrapedComicRelationFacts } from '@shared/scraper'
import type { ComicChapterInfo, CoreComicMetadata, Tag } from '@shared/metadata'
import type { Comic } from '@shared/db'
import type { IngestComicGraph, IngestComicGraphLinks } from '../../graph'
import type {
  CollectionUpdateMode,
  RelatedEntriesUpdatePlan,
  UpdateIncomingBuildResult,
  UpdateIncomingRelationAvailability,
  UpdateResolvedSelection
} from '../types'

/**
 * Link tables a comic update can write.
 *
 * Derived from the graph builder's output, so a new link table forces a
 * declaration in `COMIC_LINK_TOPOLOGY`.
 */
export type ComicLinkKind = keyof IngestComicGraphLinks

export interface ComicIncomingMediaCandidates {
  coverUrls?: string[]
  backdropUrls?: string[]
  logoUrls?: string[]
}

export interface ComicIncomingBuildResult extends UpdateIncomingBuildResult<
  UpdateIncomingRelationAvailability<ComicUpdateSurface, ComicLinkKind>,
  CoreComicMetadata,
  ScrapedComicRelationFacts,
  ComicIncomingMediaCandidates
> {
  /** Absent means the scrape could not answer units; an empty array means none exist. */
  chapters?: ComicChapterInfo[]
}

export interface ComicCurrentState {
  comic: Comic
  externalIds: ExternalId[]
  tags: Tag[]
}

/** Unit write resolved for one comic update; see `AnimeEpisodeUpdatePlan`. */
export interface ComicChapterUpdatePlan {
  items: ComicChapterInfo[]
  mode: CollectionUpdateMode
}

export interface ComicUpdatePlan {
  patch: Partial<Comic>
  externalIds?: ExternalId[]
  tags?: Tag[]
  coverUrl?: string
  backdropUrl?: string
  logoUrl?: string
  chapters?: ComicChapterUpdatePlan
  /** Link tables to write, each with the mode resolved for that table. */
  links: Partial<Record<ComicLinkKind, CollectionUpdateMode>>
  /** Link tables where `replace` was downgraded because a fact source stayed silent. */
  degradedLinks: ComicLinkKind[]
  relationGraph?: IngestComicGraph
  relatedEntries?: RelatedEntriesUpdatePlan
}

export interface ComicPlanContext {
  current: ComicCurrentState
  incoming: ComicIncomingBuildResult
  relationGraph?: IngestComicGraph
  selection: UpdateResolvedSelection<
    ComicUpdateSurface,
    ComicUpdateCoreSurface,
    ComicUpdateMediaSurface,
    ComicUpdateRelationSurface
  >
  policy: IngestUpdatePolicy
}
