import type {
  CharacterPersonType,
  GameCharacterType,
  GameCompanyType,
  GamePersonType
} from '@shared/db'
import type {
  CoreCharacterMetadata,
  CoreCompanyMetadata,
  CoreGameMetadata,
  CorePersonMetadata
} from '@shared/metadata'

/**
 * Scraped person metadata with media candidates kept at scraper layer.
 */
export interface ScrapedPersonMetadata extends CorePersonMetadata {
  photos?: string[]
}

/**
 * Scraped company metadata with media candidates kept at scraper layer.
 */
export interface ScrapedCompanyMetadata extends CoreCompanyMetadata {
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
  character?: CoreCharacterMetadata
  type: CharacterPersonType
  isSpoiler?: boolean
  note?: string
}

/**
 * Scraped character metadata with relation/media facts.
 */
// TEMP: Transitional compatibility type for metadata-updater. Remove once metadata-updater no longer consumes shared Scraped*Metadata payloads.
export interface ScrapedCharacterMetadata extends CoreCharacterMetadata {
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
// TEMP: Transitional compatibility type for metadata-updater. Remove once metadata-updater no longer consumes shared Scraped*Metadata payloads.
export interface ScrapedGameMetadata extends CoreGameMetadata {
  persons?: ScrapedGamePersonFact[]
  characters?: ScrapedGameCharacterFact[]
  companies?: ScrapedGameCompanyFact[]
  covers?: string[]
  backdrops?: string[]
  logos?: string[]
  icons?: string[]
}

export interface ScrapedGameBundle {
  core?: CoreGameMetadata
  relationFacts?: {
    gamePerson?: ScrapedGamePersonFact[]
    gameCompany?: ScrapedGameCompanyFact[]
    gameCharacter?: ScrapedGameCharacterFact[]
    characterPerson?: ScrapedCharacterPersonFact[]
  }
  mediaCandidates?: {
    coverUrls?: string[]
    backdropUrls?: string[]
    logoUrls?: string[]
    iconUrls?: string[]
  }
}

export interface ScrapedPersonBundle {
  core?: CorePersonMetadata
  mediaCandidates?: {
    photoUrls?: string[]
  }
}

export interface ScrapedCompanyBundle {
  core?: CoreCompanyMetadata
  mediaCandidates?: {
    logoUrls?: string[]
  }
}

export interface ScrapedCharacterBundle {
  core?: CoreCharacterMetadata
  relationFacts?: {
    characterPerson?: ScrapedCharacterPersonFact[]
  }
  mediaCandidates?: {
    photoUrls?: string[]
  }
}
