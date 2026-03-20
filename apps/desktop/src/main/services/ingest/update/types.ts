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
import type { PendingAssetTask } from '../assets'
import type { IngestCharacterGraph, IngestGameGraph } from '../graph'
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

export interface UpdateIncomingAvailability<TSurface extends string> {
  surfaces: Set<TSurface>
}

export interface UpdateIncomingBuildResult<
  TSurface extends string,
  TCore,
  TRelationFacts,
  TMediaCandidates
> {
  incoming: UpdateIncomingBundle<TCore, TRelationFacts, TMediaCandidates>
  availability: UpdateIncomingAvailability<TSurface>
}

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
  PersonUpdateSurface,
  CorePersonMetadata,
  Record<never, never>,
  PersonIncomingMediaCandidates
>

export type CompanyIncomingBuildResult = UpdateIncomingBuildResult<
  CompanyUpdateSurface,
  CoreCompanyMetadata,
  Record<never, never>,
  CompanyIncomingMediaCandidates
>

export type CharacterIncomingBuildResult = UpdateIncomingBuildResult<
  CharacterUpdateSurface,
  CoreCharacterMetadata,
  Record<string, unknown>,
  CharacterIncomingMediaCandidates
>

export type GameIncomingBuildResult = UpdateIncomingBuildResult<
  GameUpdateSurface,
  CoreGameMetadata,
  Record<string, unknown>,
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
  collectionMode: IngestUpdatePolicy['collectionUpdate']
  selectedRelationSurfaces: CharacterUpdateRelationSurface[]
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
  collectionMode: IngestUpdatePolicy['collectionUpdate']
  selectedRelationSurfaces: GameUpdateRelationSurface[]
  relationGraph?: IngestGameGraph
}

export interface UpdateApplyResult {
  pendingAssets: PendingAssetTask[]
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
