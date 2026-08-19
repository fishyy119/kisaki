import type { MediaType } from '@shared/common'
import type {
  AnimeCharacterRole,
  AnimeCompanyRole,
  AnimePersonRole,
  CharacterPersonRole,
  GameCharacterRole,
  GameCompanyRole,
  GamePersonRole,
  MediaRelationType,
  MovieCharacterRole,
  MovieCompanyRole,
  MoviePersonRole,
  TvCharacterRole,
  TvCompanyRole,
  TvPersonRole
} from '@shared/db'
import type { ExternalId } from '@shared/identity'
import type {
  AnimeEpisodeInfo,
  CoreAnimeMetadata,
  CoreCharacterMetadata,
  CoreCompanyMetadata,
  CoreGameMetadata,
  CoreMovieMetadata,
  CorePersonMetadata,
  CoreTvMetadata,
  Tag,
  TvEpisodeInfo,
  TvSeasonInfo
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

export type ScrapedAnimeInfo = Omit<CoreAnimeMetadata, 'externalIds' | 'tags'>

export type ScrapedTvInfo = Omit<CoreTvMetadata, 'externalIds' | 'tags'>

export type ScrapedMovieInfo = Omit<CoreMovieMetadata, 'externalIds' | 'tags'>

export type ScrapedPersonInfo = Omit<CorePersonMetadata, 'externalIds' | 'tags'>

export type ScrapedCompanyInfo = Omit<CoreCompanyMetadata, 'externalIds' | 'tags'>

export type ScrapedCharacterInfo = Omit<CoreCharacterMetadata, 'externalIds' | 'tags'>

export interface ScrapedGameCore extends ScrapedGameInfo {
  tags?: Tag[]
}

export interface ScrapedAnimeCore extends ScrapedAnimeInfo {
  tags?: Tag[]
}

export interface ScrapedTvCore extends ScrapedTvInfo {
  tags?: Tag[]
}

export interface ScrapedMovieCore extends ScrapedMovieInfo {
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
  role: CharacterPersonRole
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
  role: GamePersonRole
  isSpoiler?: boolean
  /** Characters this credit performs in the entry, as credited by the source. */
  playing?: string[]
  note?: string
}

/**
 * Scraped game-character relation fact.
 */
export interface ScrapedGameCharacterFact extends ScrapedCharacterMetadata {
  role: GameCharacterRole
  isSpoiler?: boolean
  note?: string
}

/**
 * Scraped game-company relation fact.
 */
export interface ScrapedGameCompanyFact extends ScrapedCompanyMetadata {
  role: GameCompanyRole
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
  relatedEntries?: ScrapedRelatedEntryFact[]
  covers?: string[]
  backdrops?: string[]
  logos?: string[]
  icons?: string[]
}

/**
 * Scraped anime-person relation fact.
 */
export interface ScrapedAnimePersonFact extends ScrapedPersonMetadata {
  role: AnimePersonRole
  isSpoiler?: boolean
  /** Characters this credit performs in the entry, as credited by the source. */
  playing?: string[]
  note?: string
}

/**
 * Scraped anime-character relation fact.
 */
export interface ScrapedAnimeCharacterFact extends ScrapedCharacterMetadata {
  role: AnimeCharacterRole
  isSpoiler?: boolean
  note?: string
}

/**
 * Scraped anime-company relation fact.
 */
export interface ScrapedAnimeCompanyFact extends ScrapedCompanyMetadata {
  role: AnimeCompanyRole
  isSpoiler?: boolean
  note?: string
}

/**
 * Scraped media-to-media relation fact.
 *
 * The target is referenced by external identity only: ingest resolves it
 * against library entries and never creates media entries for scraped
 * references. Providers map their vocabulary onto `MediaRelationType`.
 */
export interface ScrapedRelatedEntryFact {
  mediaType: MediaType
  source: string
  externalId: string
  type: MediaRelationType
  note?: string
}

/**
 * Scraped anime metadata with relation/media facts.
 */
export interface ScrapedAnimeMetadata extends ScrapedAnimeCore, ScrapedIdentityCarrier {
  episodes?: AnimeEpisodeInfo[]
  persons?: ScrapedAnimePersonFact[]
  characters?: ScrapedAnimeCharacterFact[]
  companies?: ScrapedAnimeCompanyFact[]
  relatedEntries?: ScrapedRelatedEntryFact[]
  covers?: string[]
  backdrops?: string[]
  logos?: string[]
}

/**
 * Scraped tv-person relation fact.
 */
export interface ScrapedTvPersonFact extends ScrapedPersonMetadata {
  role: TvPersonRole
  isSpoiler?: boolean
  /** Characters this credit performs in the entry, as credited by the source. */
  playing?: string[]
  note?: string
}

/**
 * Scraped tv-character relation fact.
 */
export interface ScrapedTvCharacterFact extends ScrapedCharacterMetadata {
  role: TvCharacterRole
  isSpoiler?: boolean
  note?: string
}

/**
 * Scraped tv-company relation fact.
 */
export interface ScrapedTvCompanyFact extends ScrapedCompanyMetadata {
  role: TvCompanyRole
  isSpoiler?: boolean
  note?: string
}

/**
 * Scraped tv metadata with relation/media facts.
 */
export interface ScrapedTvMetadata extends ScrapedTvCore, ScrapedIdentityCarrier {
  seasons?: TvSeasonInfo[]
  episodes?: TvEpisodeInfo[]
  persons?: ScrapedTvPersonFact[]
  characters?: ScrapedTvCharacterFact[]
  companies?: ScrapedTvCompanyFact[]
  relatedEntries?: ScrapedRelatedEntryFact[]
  covers?: string[]
  backdrops?: string[]
  logos?: string[]
}

/**
 * Scraped movie-person relation fact.
 */
export interface ScrapedMoviePersonFact extends ScrapedPersonMetadata {
  role: MoviePersonRole
  isSpoiler?: boolean
  /** Characters this credit performs in the entry, as credited by the source. */
  playing?: string[]
  note?: string
}

/**
 * Scraped movie-character relation fact.
 */
export interface ScrapedMovieCharacterFact extends ScrapedCharacterMetadata {
  role: MovieCharacterRole
  isSpoiler?: boolean
  note?: string
}

/**
 * Scraped movie-company relation fact.
 */
export interface ScrapedMovieCompanyFact extends ScrapedCompanyMetadata {
  role: MovieCompanyRole
  isSpoiler?: boolean
  note?: string
}

/**
 * Scraped movie metadata with relation/media facts.
 */
export interface ScrapedMovieMetadata extends ScrapedMovieCore, ScrapedIdentityCarrier {
  persons?: ScrapedMoviePersonFact[]
  characters?: ScrapedMovieCharacterFact[]
  companies?: ScrapedMovieCompanyFact[]
  relatedEntries?: ScrapedRelatedEntryFact[]
  covers?: string[]
  backdrops?: string[]
  logos?: string[]
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
  relatedEntries?: ScrapedRelatedEntryFact[]
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

/** Relation facts an anime scrape can state; see `ScrapedGameRelationFacts`. */
export interface ScrapedAnimeRelationFacts {
  animePerson?: ScrapedAnimePersonFact[]
  animeCompany?: ScrapedAnimeCompanyFact[]
  animeCharacter?: ScrapedAnimeCharacterFact[]
  characterPerson?: ScrapedCharacterPersonFact[]
  relatedEntries?: ScrapedRelatedEntryFact[]
}

export interface ScrapedAnimeBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedAnimeCore
  /** Absent means unknown; an empty array means the source states no episodes. */
  episodes?: AnimeEpisodeInfo[]
  relationFacts?: ScrapedAnimeRelationFacts
  mediaCandidates?: {
    coverUrls?: string[]
    backdropUrls?: string[]
    logoUrls?: string[]
  }
}

/** Relation facts a tv scrape can state; see `ScrapedGameRelationFacts`. */
export interface ScrapedTvRelationFacts {
  tvPerson?: ScrapedTvPersonFact[]
  tvCompany?: ScrapedTvCompanyFact[]
  tvCharacter?: ScrapedTvCharacterFact[]
  characterPerson?: ScrapedCharacterPersonFact[]
  relatedEntries?: ScrapedRelatedEntryFact[]
}

export interface ScrapedTvBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedTvCore
  /** Absent means unknown; an empty array means the source states no seasons. */
  seasons?: TvSeasonInfo[]
  /** Absent means unknown; an empty array means the source states no episodes. */
  episodes?: TvEpisodeInfo[]
  relationFacts?: ScrapedTvRelationFacts
  mediaCandidates?: {
    coverUrls?: string[]
    backdropUrls?: string[]
    logoUrls?: string[]
  }
}

/** Relation facts a movie scrape can state; see `ScrapedGameRelationFacts`. */
export interface ScrapedMovieRelationFacts {
  moviePerson?: ScrapedMoviePersonFact[]
  movieCompany?: ScrapedMovieCompanyFact[]
  movieCharacter?: ScrapedMovieCharacterFact[]
  characterPerson?: ScrapedCharacterPersonFact[]
  relatedEntries?: ScrapedRelatedEntryFact[]
}

export interface ScrapedMovieBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedMovieCore
  relationFacts?: ScrapedMovieRelationFacts
  mediaCandidates?: {
    coverUrls?: string[]
    backdropUrls?: string[]
    logoUrls?: string[]
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
