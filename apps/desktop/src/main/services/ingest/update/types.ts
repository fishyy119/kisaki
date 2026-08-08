import type {
  CharacterUpdateCoreSurface,
  CharacterUpdateMediaSurface,
  CharacterUpdateRelationSurface,
  CharacterUpdateSurface,
  CompanyUpdateCoreSurface,
  CompanyUpdateMediaSurface,
  CompanyUpdateRelationSurface,
  CompanyUpdateSurface,
  GameUpdateCoreSurface,
  GameUpdateMediaSurface,
  GameUpdateRelationSurface,
  GameUpdateSurface,
  IngestUpdatePolicy,
  PersonUpdateCoreSurface,
  PersonUpdateMediaSurface,
  PersonUpdateRelationSurface,
  PersonUpdateSurface
} from '@shared/ingest/update'
import type { ExternalId } from '@shared/identity'
import type { ScrapedCharacterRelationFacts, ScrapedGameRelationFacts } from '@shared/scraper'
import type { PendingAssetTask } from '../assets'
import type { IngestCharacterGraph, IngestGameGraph, IngestGameGraphLinks } from '../graph'
import type {
  CoreCharacterMetadata,
  CoreCompanyMetadata,
  CoreGameMetadata,
  CorePersonMetadata,
  Tag
} from '@shared/metadata'
import type { Character, Company, Game, Person } from '@shared/db'

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
  TRelationLink extends string
> extends UpdateIncomingAvailability<TSurface> {
  /** Link tables whose every fact source answered; only these may be cleared. */
  completeRelationLinks: Set<TRelationLink>
}

export interface UpdateIncomingBuildResult<TAvailability, TCore, TRelationFacts, TMediaCandidates> {
  incoming: UpdateIncomingBundle<TCore, TRelationFacts, TMediaCandidates>
  availability: TAvailability
}

/**
 * Link tables a game update can write.
 *
 * Derived from the graph builder's output, so a new link table forces a
 * declaration in `GAME_RELATION_LINKS`.
 */
export type GameRelationLink = keyof IngestGameGraphLinks

/** Link tables a character update can write; the graph carries a single set. */
export type CharacterRelationLink = 'characterPerson'

export interface PersonIncomingMediaCandidates {
  photoUrls?: string[]
}

export interface CompanyIncomingMediaCandidates {
  logoUrls?: string[]
}

export interface CharacterIncomingMediaCandidates {
  photoUrls?: string[]
}

export interface GameIncomingMediaCandidates {
  coverUrls?: string[]
  backdropUrls?: string[]
  logoUrls?: string[]
  iconUrls?: string[]
}

export type PersonIncomingBuildResult = UpdateIncomingBuildResult<
  UpdateIncomingAvailability<PersonUpdateSurface>,
  CorePersonMetadata,
  Record<never, never>,
  PersonIncomingMediaCandidates
>

export type CompanyIncomingBuildResult = UpdateIncomingBuildResult<
  UpdateIncomingAvailability<CompanyUpdateSurface>,
  CoreCompanyMetadata,
  Record<never, never>,
  CompanyIncomingMediaCandidates
>

export type CharacterIncomingBuildResult = UpdateIncomingBuildResult<
  UpdateIncomingRelationAvailability<CharacterUpdateSurface, CharacterRelationLink>,
  CoreCharacterMetadata,
  ScrapedCharacterRelationFacts,
  CharacterIncomingMediaCandidates
>

export type GameIncomingBuildResult = UpdateIncomingBuildResult<
  UpdateIncomingRelationAvailability<GameUpdateSurface, GameRelationLink>,
  CoreGameMetadata,
  ScrapedGameRelationFacts,
  GameIncomingMediaCandidates
>

export interface PersonCurrentState {
  person: Person
  externalIds: ExternalId[]
  tags: Tag[]
}

export interface CompanyCurrentState {
  company: Company
  externalIds: ExternalId[]
  tags: Tag[]
}

export interface CharacterCurrentState {
  character: Character
  externalIds: ExternalId[]
  tags: Tag[]
}

export interface GameCurrentState {
  game: Game
  externalIds: ExternalId[]
  tags: Tag[]
}

export interface PersonUpdatePlan {
  patch: Partial<Person>
  externalIds?: ExternalId[]
  tags?: Tag[]
  photoUrl?: string
}

export interface CompanyUpdatePlan {
  patch: Partial<Company>
  externalIds?: ExternalId[]
  tags?: Tag[]
  logoUrl?: string
}

export interface CharacterUpdatePlan {
  patch: Partial<Character>
  externalIds?: ExternalId[]
  tags?: Tag[]
  photoUrl?: string
  /** Link tables to write, each with the mode resolved for that table. */
  relationLinks: Partial<Record<CharacterRelationLink, CollectionUpdateMode>>
  /** Link tables where `replace` was downgraded because a fact source stayed silent. */
  degradedRelationLinks: CharacterRelationLink[]
  relationGraph?: IngestCharacterGraph
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
  relationLinks: Partial<Record<GameRelationLink, CollectionUpdateMode>>
  /** Link tables where `replace` was downgraded because a fact source stayed silent. */
  degradedRelationLinks: GameRelationLink[]
  relationGraph?: IngestGameGraph
}

export interface UpdateApplyResult {
  pendingAssets: PendingAssetTask[]
}

export interface UpdateRelationApplyResult<TRelationLink extends string> extends UpdateApplyResult {
  /** Stored rows per link table that a `replace` would have deleted but merge kept. */
  preservedRelationRows: Partial<Record<TRelationLink, number>>
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

export interface PersonPlanContext {
  current: PersonCurrentState
  incoming: PersonIncomingBuildResult
  selection: UpdateResolvedSelection<
    PersonUpdateSurface,
    PersonUpdateCoreSurface,
    PersonUpdateMediaSurface,
    PersonUpdateRelationSurface
  >
  policy: IngestUpdatePolicy
}

export interface CompanyPlanContext {
  current: CompanyCurrentState
  incoming: CompanyIncomingBuildResult
  selection: UpdateResolvedSelection<
    CompanyUpdateSurface,
    CompanyUpdateCoreSurface,
    CompanyUpdateMediaSurface,
    CompanyUpdateRelationSurface
  >
  policy: IngestUpdatePolicy
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

export interface TagLinkValue {
  tagId: string
  isSpoiler: boolean
  note: string | null
}

export interface UpdateCurrentSelection<TCoreSurface extends string> {
  coreSurfaces: TCoreSurface[]
}
