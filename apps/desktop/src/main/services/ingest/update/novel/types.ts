import type {
  IngestUpdatePolicy,
  NovelUpdateCoreSurface,
  NovelUpdateMediaSurface,
  NovelUpdateRelationSurface,
  NovelUpdateSurface
} from '@shared/ingest/update'
import type { ExternalId } from '@shared/identity'
import type { ScrapedNovelRelationFacts } from '@shared/scraper'
import type { CoreNovelMetadata, NovelVolumeInfo, Tag } from '@shared/metadata'
import type { Novel } from '@shared/db'
import type { IngestNovelGraph, IngestNovelGraphLinks } from '../../graph'
import type {
  CollectionUpdateMode,
  RelatedEntriesUpdatePlan,
  UpdateIncomingBuildResult,
  UpdateIncomingRelationAvailability,
  UpdateResolvedSelection
} from '../types'

/**
 * Link tables a novel update can write.
 *
 * Derived from the graph builder's output, so a new link table forces a
 * declaration in `NOVEL_LINK_TOPOLOGY`.
 */
export type NovelLinkKind = keyof IngestNovelGraphLinks

export interface NovelIncomingMediaCandidates {
  coverUrls?: string[]
  backdropUrls?: string[]
  logoUrls?: string[]
}

export interface NovelIncomingBuildResult extends UpdateIncomingBuildResult<
  UpdateIncomingRelationAvailability<NovelUpdateSurface, NovelLinkKind>,
  CoreNovelMetadata,
  ScrapedNovelRelationFacts,
  NovelIncomingMediaCandidates
> {
  /** Absent means the scrape could not answer volumes; an empty array means none exist. */
  volumes?: NovelVolumeInfo[]
}

export interface NovelCurrentState {
  novel: Novel
  externalIds: ExternalId[]
  tags: Tag[]
}

/** Volume write resolved for one novel update; see `AnimeEpisodeUpdatePlan`. */
export interface NovelVolumeUpdatePlan {
  items: NovelVolumeInfo[]
  mode: CollectionUpdateMode
}

export interface NovelUpdatePlan {
  patch: Partial<Novel>
  externalIds?: ExternalId[]
  tags?: Tag[]
  coverUrl?: string
  backdropUrl?: string
  logoUrl?: string
  volumes?: NovelVolumeUpdatePlan
  /** Link tables to write, each with the mode resolved for that table. */
  links: Partial<Record<NovelLinkKind, CollectionUpdateMode>>
  /** Link tables where `replace` was downgraded because a fact source stayed silent. */
  degradedLinks: NovelLinkKind[]
  relationGraph?: IngestNovelGraph
  relatedEntries?: RelatedEntriesUpdatePlan
}

export interface NovelPlanContext {
  current: NovelCurrentState
  incoming: NovelIncomingBuildResult
  relationGraph?: IngestNovelGraph
  selection: UpdateResolvedSelection<
    NovelUpdateSurface,
    NovelUpdateCoreSurface,
    NovelUpdateMediaSurface,
    NovelUpdateRelationSurface
  >
  policy: IngestUpdatePolicy
}
