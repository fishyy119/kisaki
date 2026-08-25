import type { MediaType } from '@shared/common'
import type {
  AnimeCharacterRole,
  AnimeCompanyRole,
  AnimePersonRole,
  CharacterPersonRole,
  ComicCharacterRole,
  ComicCompanyRole,
  ComicPersonRole,
  GameCharacterRole,
  GameCompanyRole,
  GamePersonRole,
  MediaRelationType,
  NovelCharacterRole,
  NovelCompanyRole,
  NovelPersonRole
} from '@shared/db'
import type { ExternalId } from '@shared/identity'
import type {
  AnimeEpisodeInfo,
  ComicChapterInfo,
  CoreAnimeMetadata,
  CoreCharacterMetadata,
  CoreComicMetadata,
  CoreCompanyMetadata,
  CoreGameMetadata,
  CoreNovelMetadata,
  CorePersonMetadata,
  NovelVolumeInfo,
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

export type ScrapedAnimeInfo = Omit<CoreAnimeMetadata, 'externalIds' | 'tags'>

export type ScrapedComicInfo = Omit<CoreComicMetadata, 'externalIds' | 'tags'>

export type ScrapedNovelInfo = Omit<CoreNovelMetadata, 'externalIds' | 'tags'>

export type ScrapedPersonInfo = Omit<CorePersonMetadata, 'externalIds' | 'tags'>

export type ScrapedCompanyInfo = Omit<CoreCompanyMetadata, 'externalIds' | 'tags'>

export type ScrapedCharacterInfo = Omit<CoreCharacterMetadata, 'externalIds' | 'tags'>

export interface ScrapedGameCore extends ScrapedGameInfo {
  tags?: Tag[]
}

export interface ScrapedAnimeCore extends ScrapedAnimeInfo {
  tags?: Tag[]
}

export interface ScrapedComicCore extends ScrapedComicInfo {
  tags?: Tag[]
}

export interface ScrapedNovelCore extends ScrapedNovelInfo {
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
 * Scraped comic-person relation fact.
 */
export interface ScrapedComicPersonFact extends ScrapedPersonMetadata {
  role: ComicPersonRole
  isSpoiler?: boolean
  note?: string
}

/**
 * Scraped comic-character relation fact.
 */
export interface ScrapedComicCharacterFact extends ScrapedCharacterMetadata {
  role: ComicCharacterRole
  isSpoiler?: boolean
  note?: string
}

/**
 * Scraped comic-company relation fact.
 */
export interface ScrapedComicCompanyFact extends ScrapedCompanyMetadata {
  role: ComicCompanyRole
  isSpoiler?: boolean
  note?: string
}

/**
 * Scraped comic metadata with relation/media facts.
 */
export interface ScrapedComicMetadata extends ScrapedComicCore, ScrapedIdentityCarrier {
  chapters?: ComicChapterInfo[]
  persons?: ScrapedComicPersonFact[]
  characters?: ScrapedComicCharacterFact[]
  companies?: ScrapedComicCompanyFact[]
  relatedEntries?: ScrapedRelatedEntryFact[]
  covers?: string[]
  backdrops?: string[]
  logos?: string[]
}

/**
 * Scraped novel-person relation fact.
 */
export interface ScrapedNovelPersonFact extends ScrapedPersonMetadata {
  role: NovelPersonRole
  isSpoiler?: boolean
  note?: string
}

/**
 * Scraped novel-character relation fact.
 */
export interface ScrapedNovelCharacterFact extends ScrapedCharacterMetadata {
  role: NovelCharacterRole
  isSpoiler?: boolean
  note?: string
}

/**
 * Scraped novel-company relation fact.
 */
export interface ScrapedNovelCompanyFact extends ScrapedCompanyMetadata {
  role: NovelCompanyRole
  isSpoiler?: boolean
  note?: string
}

/**
 * Scraped novel metadata with relation/media facts.
 */
export interface ScrapedNovelMetadata extends ScrapedNovelCore, ScrapedIdentityCarrier {
  volumes?: NovelVolumeInfo[]
  persons?: ScrapedNovelPersonFact[]
  characters?: ScrapedNovelCharacterFact[]
  companies?: ScrapedNovelCompanyFact[]
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

/** Relation facts a comic scrape can state; see `ScrapedGameRelationFacts`. */
export interface ScrapedComicRelationFacts {
  comicPerson?: ScrapedComicPersonFact[]
  comicCompany?: ScrapedComicCompanyFact[]
  comicCharacter?: ScrapedComicCharacterFact[]
  characterPerson?: ScrapedCharacterPersonFact[]
  relatedEntries?: ScrapedRelatedEntryFact[]
}

export interface ScrapedComicBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedComicCore
  /** Absent means unknown; an empty array means the source states no units. */
  chapters?: ComicChapterInfo[]
  relationFacts?: ScrapedComicRelationFacts
  mediaCandidates?: {
    coverUrls?: string[]
    backdropUrls?: string[]
    logoUrls?: string[]
  }
}

/** Relation facts a novel scrape can state; see `ScrapedGameRelationFacts`. */
export interface ScrapedNovelRelationFacts {
  novelPerson?: ScrapedNovelPersonFact[]
  novelCompany?: ScrapedNovelCompanyFact[]
  novelCharacter?: ScrapedNovelCharacterFact[]
  characterPerson?: ScrapedCharacterPersonFact[]
  relatedEntries?: ScrapedRelatedEntryFact[]
}

export interface ScrapedNovelBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedNovelCore
  /** Absent means unknown; an empty array means the source states no volumes. */
  volumes?: NovelVolumeInfo[]
  relationFacts?: ScrapedNovelRelationFacts
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
