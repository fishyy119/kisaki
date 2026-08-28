import type {
  CharacterUpdateCoreSurface,
  CharacterUpdateMediaSurface,
  CharacterUpdateRelationSurface,
  CharacterUpdateSurface,
  IngestUpdatePolicy
} from '@shared/ingest/update'
import type { ExternalId } from '@shared/identity'
import type { ScrapedCharacterRelationFacts } from '@shared/scraper'
import type { CoreCharacterMetadata, Tag } from '@shared/metadata'
import type { Character } from '@shared/db'
import type { IngestCharacterGraph } from '../../graph'
import type {
  CollectionUpdateMode,
  UpdateIncomingBuildResult,
  UpdateIncomingRelationAvailability,
  UpdateResolvedSelection
} from '../types'

/** Link tables a character update can write; the graph carries a single set. */
export type CharacterLinkKind = 'characterPerson'

export interface CharacterIncomingMediaCandidates {
  photoUrls?: string[]
}

export type CharacterIncomingBuildResult = UpdateIncomingBuildResult<
  UpdateIncomingRelationAvailability<CharacterUpdateSurface, CharacterLinkKind>,
  CoreCharacterMetadata,
  ScrapedCharacterRelationFacts,
  CharacterIncomingMediaCandidates
>

export interface CharacterCurrentState {
  character: Character
  externalIds: ExternalId[]
  tags: Tag[]
}

export interface CharacterUpdatePlan {
  patch: Partial<Character>
  externalIds?: ExternalId[]
  tags?: Tag[]
  photoUrl?: string
  /** Link tables to write, each with the mode resolved for that table. */
  links: Partial<Record<CharacterLinkKind, CollectionUpdateMode>>
  /** Link tables where `replace` was downgraded because a fact source stayed silent. */
  degradedLinks: CharacterLinkKind[]
  relationGraph?: IngestCharacterGraph
}

export interface CharacterPlanContext {
  current: CharacterCurrentState
  incoming: CharacterIncomingBuildResult
  relationGraph?: IngestCharacterGraph
  selection: UpdateResolvedSelection<
    CharacterUpdateSurface,
    CharacterUpdateCoreSurface,
    CharacterUpdateMediaSurface,
    CharacterUpdateRelationSurface
  >
  policy: IngestUpdatePolicy
}
