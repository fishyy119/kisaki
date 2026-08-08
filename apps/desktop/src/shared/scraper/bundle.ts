import type {
  CharacterPersonType,
  GameCharacterType,
  GameCompanyType,
  GamePersonType
} from '@shared/db'
import type { ExternalId } from '@shared/identity'
import type {
  CoreCharacterMetadata,
  CoreCompanyMetadata,
  CoreGameMetadata,
  CorePersonMetadata,
  Tag
} from '@shared/metadata'

export interface ScrapedEntityIdentity {
  externalIds: ExternalId[]
}

export interface ScrapedIdentityCarrier {
  identity: ScrapedEntityIdentity
}

export type ScraperSessionResult<TResultMap extends object> = {
  identity?: ScrapedEntityIdentity
  slots: Partial<TResultMap>
}

export type ScrapedGameInfo = Omit<CoreGameMetadata, 'externalIds' | 'tags'>

export type ScrapedPersonInfo = Omit<CorePersonMetadata, 'externalIds' | 'tags'>

export type ScrapedCompanyInfo = Omit<CoreCompanyMetadata, 'externalIds' | 'tags'>

export type ScrapedCharacterInfo = Omit<CoreCharacterMetadata, 'externalIds' | 'tags'>

export interface ScrapedGameCore extends ScrapedGameInfo {
  tags?: Tag[]
}

export interface ScrapedPersonCore extends ScrapedPersonInfo {
  tags?: Tag[]
}

export interface ScrapedCompanyCore extends ScrapedCompanyInfo {
  tags?: Tag[]
}

export interface ScrapedCharacterCore extends ScrapedCharacterInfo {
  tags?: Tag[]
}

/**
 * Scraped person metadata with media candidates kept at scraper layer.
 */
export interface ScrapedPersonMetadata extends ScrapedPersonCore, ScrapedIdentityCarrier {
  photos?: string[]
}

/**
 * Scraped company metadata with media candidates kept at scraper layer.
 */
export interface ScrapedCompanyMetadata extends ScrapedCompanyCore, ScrapedIdentityCarrier {
  logos?: string[]
}

/**
 * Scraped character-person relation fact.
 */
export interface ScrapedCharacterPersonFact extends ScrapedPersonMetadata {
  /**
   * Character reference for game-level character-person facts.
   * Character flow may omit this because the root character is implicit.
   */
  character?: ScrapedCharacterCore & ScrapedIdentityCarrier
  type: CharacterPersonType
  isSpoiler?: boolean
  note?: string
}

/**
 * Scraped character metadata with relation/media facts.
 */
export interface ScrapedCharacterMetadata extends ScrapedCharacterCore, ScrapedIdentityCarrier {
  persons?: ScrapedCharacterPersonFact[]
  photos?: string[]
}

/**
 * Scraped game-person relation fact.
 */
export interface ScrapedGamePersonFact extends ScrapedPersonMetadata {
  type: GamePersonType
  isSpoiler?: boolean
  note?: string
}

/**
 * Scraped game-character relation fact.
 */
export interface ScrapedGameCharacterFact extends ScrapedCharacterMetadata {
  type: GameCharacterType
  isSpoiler?: boolean
  note?: string
}

/**
 * Scraped game-company relation fact.
 */
export interface ScrapedGameCompanyFact extends ScrapedCompanyMetadata {
  type: GameCompanyType
  isSpoiler?: boolean
  note?: string
}

/**
 * Scraped game metadata with relation/media facts.
 */
export interface ScrapedGameMetadata extends ScrapedGameCore, ScrapedIdentityCarrier {
  persons?: ScrapedGamePersonFact[]
  characters?: ScrapedGameCharacterFact[]
  companies?: ScrapedGameCompanyFact[]
  covers?: string[]
  backdrops?: string[]
  logos?: string[]
  icons?: string[]
}

/**
 * Relation facts a game scrape can state.
 *
 * An absent key means the scrape could not answer that relation; an empty array
 * means the source states the game has none.
 */
export interface ScrapedGameRelationFacts {
  gamePerson?: ScrapedGamePersonFact[]
  gameCompany?: ScrapedGameCompanyFact[]
  gameCharacter?: ScrapedGameCharacterFact[]
  characterPerson?: ScrapedCharacterPersonFact[]
}

export interface ScrapedGameBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedGameCore
  relationFacts?: ScrapedGameRelationFacts
  mediaCandidates?: {
    coverUrls?: string[]
    backdropUrls?: string[]
    logoUrls?: string[]
    iconUrls?: string[]
  }
}

export interface ScrapedPersonBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedPersonCore
  mediaCandidates?: {
    photoUrls?: string[]
  }
}

export interface ScrapedCompanyBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedCompanyCore
  mediaCandidates?: {
    logoUrls?: string[]
  }
}

/** Relation facts a character scrape can state; see `ScrapedGameRelationFacts`. */
export interface ScrapedCharacterRelationFacts {
  characterPerson?: ScrapedCharacterPersonFact[]
}

export interface ScrapedCharacterBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedCharacterCore
  relationFacts?: ScrapedCharacterRelationFacts
  mediaCandidates?: {
    photoUrls?: string[]
  }
}
