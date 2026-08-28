import type {
  GameUpdateCoreSurface,
  GameUpdateMediaSurface,
  GameUpdateRelationSurface,
  GameUpdateSurface,
  IngestUpdatePolicy
} from '@shared/ingest/update'
import type { ExternalId } from '@shared/identity'
import type { ScrapedGameRelationFacts } from '@shared/scraper'
import type { CoreGameMetadata, Tag } from '@shared/metadata'
import type { Game } from '@shared/db'
import type { IngestGameGraph, IngestGameGraphLinks } from '../../graph'
import type {
  CollectionUpdateMode,
  RelatedEntriesUpdatePlan,
  UpdateIncomingBuildResult,
  UpdateIncomingRelationAvailability,
  UpdateResolvedSelection
} from '../types'

/**
 * Link tables a game update can write.
 *
 * Derived from the graph builder's output, so a new link table forces a
 * declaration in `GAME_LINK_TOPOLOGY`.
 */
export type GameLinkKind = keyof IngestGameGraphLinks

export interface GameIncomingMediaCandidates {
  coverUrls?: string[]
  backdropUrls?: string[]
  logoUrls?: string[]
  iconUrls?: string[]
}

export type GameIncomingBuildResult = UpdateIncomingBuildResult<
  UpdateIncomingRelationAvailability<GameUpdateSurface, GameLinkKind>,
  CoreGameMetadata,
  ScrapedGameRelationFacts,
  GameIncomingMediaCandidates
>

export interface GameCurrentState {
  game: Game
  externalIds: ExternalId[]
  tags: Tag[]
}

export interface GameUpdatePlan {
  patch: Partial<Game>
  externalIds?: ExternalId[]
  tags?: Tag[]
  coverUrl?: string
  backdropUrl?: string
  logoUrl?: string
  iconUrl?: string
  /** Link tables to write, each with the mode resolved for that table. */
  links: Partial<Record<GameLinkKind, CollectionUpdateMode>>
  /** Link tables where `replace` was downgraded because a fact source stayed silent. */
  degradedLinks: GameLinkKind[]
  relationGraph?: IngestGameGraph
  relatedEntries?: RelatedEntriesUpdatePlan
}

export interface GamePlanContext {
  current: GameCurrentState
  incoming: GameIncomingBuildResult
  relationGraph?: IngestGameGraph
  selection: UpdateResolvedSelection<
    GameUpdateSurface,
    GameUpdateCoreSurface,
    GameUpdateMediaSurface,
    GameUpdateRelationSurface
  >
  policy: IngestUpdatePolicy
}
