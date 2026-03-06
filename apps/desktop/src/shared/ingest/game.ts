/**
 * Ingest contracts for game add orchestration.
 */

import type {
  CoreCharacterMetadata,
  CoreCompanyMetadata,
  CoreGameMetadata,
  CorePersonMetadata
} from '@shared/metadata'
import type {
  CharacterPersonType,
  GameCharacterType,
  GameCompanyType,
  GamePersonType
} from '@shared/db'
import type { ExternalId } from '@shared/identity'
import type {
  IngestAddGameResult,
  IngestAddGameFromScraperOptions,
  IngestEntityNode,
  IngestFromScraperParamsBase,
  IngestLinkBase
} from './common'

/**
 * Game node in the normalized ingest graph.
 */
export type IngestGameNode = IngestEntityNode<CoreGameMetadata>

/**
 * Person node in the normalized ingest graph for game ingestion.
 */
export interface IngestGamePersonNode extends IngestEntityNode<CorePersonMetadata> {
  photoUrls?: string[]
}

/**
 * Company node in the normalized ingest graph for game ingestion.
 */
export interface IngestGameCompanyNode extends IngestEntityNode<CoreCompanyMetadata> {
  logoUrls?: string[]
}

/**
 * Character node in the normalized ingest graph for game ingestion.
 */
export interface IngestGameCharacterNode extends IngestEntityNode<CoreCharacterMetadata> {
  photoUrls?: string[]
}

/**
 * Game -> Person edge in ingest graph.
 */
export interface IngestGamePersonLink extends IngestLinkBase {
  gameIdentityKey: string
  personIdentityKey: string
  type: GamePersonType
  orderInGame: number
  orderInPerson: number
}

/**
 * Game -> Company edge in ingest graph.
 */
export interface IngestGameCompanyLink extends IngestLinkBase {
  gameIdentityKey: string
  companyIdentityKey: string
  type: GameCompanyType
  orderInGame: number
  orderInCompany: number
}

/**
 * Game -> Character edge in ingest graph.
 */
export interface IngestGameCharacterLink extends IngestLinkBase {
  gameIdentityKey: string
  characterIdentityKey: string
  type: GameCharacterType
  orderInGame: number
  orderInCharacter: number
}

/**
 * Character -> Person edge in ingest graph (within game flow).
 */
export interface IngestGameCharacterPersonLink extends IngestLinkBase {
  characterIdentityKey: string
  personIdentityKey: string
  type: CharacterPersonType
  orderInCharacter: number
  orderInPerson: number
}

/**
 * Canonical normalized graph produced by ingest for game flow.
 */
export interface IngestGameGraph {
  game: IngestGameNode
  persons: IngestGamePersonNode[]
  companies: IngestGameCompanyNode[]
  characters: IngestGameCharacterNode[]
  links: {
    gamePerson: IngestGamePersonLink[]
    gameCompany: IngestGameCompanyLink[]
    gameCharacter: IngestGameCharacterLink[]
    characterPerson: IngestGameCharacterPersonLink[]
  }
  media: {
    coverUrl?: string
    backdropUrl?: string
    logoUrl?: string
    iconUrl?: string
  }
}

/**
 * IPC params for ingest:add-game-from-scraper.
 */
export type IngestAddGameFromScraperParams =
  IngestFromScraperParamsBase<IngestAddGameFromScraperOptions>

/**
 * IPC result for ingest:add-game-from-scraper.
 */
export type IngestAddGameFromScraperResult = IngestAddGameResult

/**
 * Minimal seed for direct game add without scraper fetch.
 */
export interface IngestAddGameDirectSeed {
  name: string
  knownIds?: ExternalId[]
}

/**
 * Options for direct game add flow.
 */
export type IngestAddGameDirectOptions = Omit<
  IngestAddGameFromScraperOptions,
  'skipScraperValidation'
>

/**
 * IPC params for ingest:add-game-direct.
 */
export interface IngestAddGameDirectParams {
  seed: IngestAddGameDirectSeed
  options?: IngestAddGameDirectOptions
}

/**
 * IPC result for ingest:add-game-direct.
 */
export type IngestAddGameDirectResult = IngestAddGameResult
