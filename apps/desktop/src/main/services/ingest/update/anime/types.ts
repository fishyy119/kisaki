import type {
  AnimeUpdateCoreSurface,
  AnimeUpdateMediaSurface,
  AnimeUpdateRelationSurface,
  AnimeUpdateSurface,
  IngestUpdatePolicy
} from '@shared/ingest/update'
import type { ExternalId } from '@shared/identity'
import type { ScrapedAnimeRelationFacts } from '@shared/scraper'
import type { AnimeEpisodeInfo, CoreAnimeMetadata, Tag } from '@shared/metadata'
import type { Anime } from '@shared/db'
import type { IngestAnimeGraph, IngestAnimeGraphLinks } from '../../graph'
import type { CollectionUpdateMode, RelatedEntriesUpdatePlan, UpdateIncomingBuildResult, UpdateIncomingRelationAvailability, UpdateResolvedSelection } from '../types'

/**
 * Link tables an anime update can write.
 *
 * Derived from the graph builder's output, so a new link table forces a
 * declaration in `ANIME_LINK_TOPOLOGY`.
 */
export type AnimeLinkKind = keyof IngestAnimeGraphLinks

export interface AnimeIncomingMediaCandidates {
  coverUrls?: string[]
  backdropUrls?: string[]
  logoUrls?: string[]
}

export interface AnimeIncomingBuildResult
  extends UpdateIncomingBuildResult<
    UpdateIncomingRelationAvailability<AnimeUpdateSurface, AnimeLinkKind>,
    CoreAnimeMetadata,
    ScrapedAnimeRelationFacts,
    AnimeIncomingMediaCandidates
  > {
  /** Absent means the scrape could not answer episodes; an empty array means none exist. */
  episodes?: AnimeEpisodeInfo[]
}

export interface AnimeCurrentState {
  anime: Anime
  externalIds: ExternalId[]
  tags: Tag[]
}

/**
 * Episode write resolved for one update.
 *
 * Present only when the episodes surface was selected and the scrape answered
 * it; `items` may then be an authoritative empty list. `mode` decides whether
 * stored rows absent from `items` may be deleted (`replace`) or must be kept
 * (`merge`).
 */
export interface AnimeEpisodeUpdatePlan {
  items: AnimeEpisodeInfo[]
  mode: CollectionUpdateMode
}

export interface AnimeUpdatePlan {
  patch: Partial<Anime>
  externalIds?: ExternalId[]
  tags?: Tag[]
  coverUrl?: string
  backdropUrl?: string
  logoUrl?: string
  episodes?: AnimeEpisodeUpdatePlan
  /** Link tables to write, each with the mode resolved for that table. */
  links: Partial<Record<AnimeLinkKind, CollectionUpdateMode>>
  /** Link tables where `replace` was downgraded because a fact source stayed silent. */
  degradedLinks: AnimeLinkKind[]
  relationGraph?: IngestAnimeGraph
  relatedEntries?: RelatedEntriesUpdatePlan
}

export interface AnimePlanContext {
  current: AnimeCurrentState
  incoming: AnimeIncomingBuildResult
  relationGraph?: IngestAnimeGraph
  selection: UpdateResolvedSelection<
    AnimeUpdateSurface,
    AnimeUpdateCoreSurface,
    AnimeUpdateMediaSurface,
    AnimeUpdateRelationSurface
  >
  policy: IngestUpdatePolicy
}
