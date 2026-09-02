import type { MediaType } from '@shared/entity-types'
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
  identity?: ScrapedEntityIdentity | undefined
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
  tags?: Tag[] | undefined
}

export interface ScrapedAnimeCore extends ScrapedAnimeInfo {
  tags?: Tag[] | undefined
}

export interface ScrapedComicCore extends ScrapedComicInfo {
  tags?: Tag[] | undefined
}

export interface ScrapedNovelCore extends ScrapedNovelInfo {
  tags?: Tag[] | undefined
}

export interface ScrapedPersonCore extends ScrapedPersonInfo {
  tags?: Tag[] | undefined
}

export interface ScrapedCompanyCore extends ScrapedCompanyInfo {
  tags?: Tag[] | undefined
}

export interface ScrapedCharacterCore extends ScrapedCharacterInfo {
  tags?: Tag[] | undefined
}

/**
 * Scraped person metadata with media candidates kept at scraper layer.
 */
export interface ScrapedPersonMetadata extends ScrapedPersonCore, ScrapedIdentityCarrier {
  photos?: string[] | undefined
}

/**
 * Scraped company metadata with media candidates kept at scraper layer.
 */
export interface ScrapedCompanyMetadata extends ScrapedCompanyCore, ScrapedIdentityCarrier {
  logos?: string[] | undefined
}

/**
 * Scraped character-person relation fact.
 */
export interface ScrapedCharacterPersonFact extends ScrapedPersonMetadata {
  /**
   * Character reference for game-level character-person facts.
   * Character flow may omit this because the root character is implicit.
   */
  character?: (ScrapedCharacterCore & ScrapedIdentityCarrier) | undefined
  role: CharacterPersonRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

/**
 * Scraped character metadata with relation/media facts.
 */
export interface ScrapedCharacterMetadata extends ScrapedCharacterCore, ScrapedIdentityCarrier {
  persons?: ScrapedCharacterPersonFact[] | undefined
  photos?: string[] | undefined
}

/**
 * Scraped game-person relation fact.
 */
export interface ScrapedGamePersonFact extends ScrapedPersonMetadata {
  role: GamePersonRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

/**
 * Scraped game-character relation fact.
 */
export interface ScrapedGameCharacterFact extends ScrapedCharacterMetadata {
  role: GameCharacterRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

/**
 * Scraped game-company relation fact.
 */
export interface ScrapedGameCompanyFact extends ScrapedCompanyMetadata {
  role: GameCompanyRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

/**
 * Scraped game metadata with relation/media facts.
 */
export interface ScrapedGameMetadata extends ScrapedGameCore, ScrapedIdentityCarrier {
  persons?: ScrapedGamePersonFact[] | undefined
  characters?: ScrapedGameCharacterFact[] | undefined
  companies?: ScrapedGameCompanyFact[] | undefined
  relatedEntries?: ScrapedRelatedEntryFact[] | undefined
  covers?: string[] | undefined
  backdrops?: string[] | undefined
  logos?: string[] | undefined
  icons?: string[] | undefined
}

/**
 * Scraped anime-person relation fact.
 */
export interface ScrapedAnimePersonFact extends ScrapedPersonMetadata {
  role: AnimePersonRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

/**
 * Scraped anime-character relation fact.
 */
export interface ScrapedAnimeCharacterFact extends ScrapedCharacterMetadata {
  role: AnimeCharacterRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

/**
 * Scraped anime-company relation fact.
 */
export interface ScrapedAnimeCompanyFact extends ScrapedCompanyMetadata {
  role: AnimeCompanyRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
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
  note?: string | undefined
}

/**
 * Scraped anime metadata with relation/media facts.
 */
export interface ScrapedAnimeMetadata extends ScrapedAnimeCore, ScrapedIdentityCarrier {
  episodes?: AnimeEpisodeInfo[] | undefined
  persons?: ScrapedAnimePersonFact[] | undefined
  characters?: ScrapedAnimeCharacterFact[] | undefined
  companies?: ScrapedAnimeCompanyFact[] | undefined
  relatedEntries?: ScrapedRelatedEntryFact[] | undefined
  covers?: string[] | undefined
  backdrops?: string[] | undefined
  logos?: string[] | undefined
}

/**
 * Scraped comic-person relation fact.
 */
export interface ScrapedComicPersonFact extends ScrapedPersonMetadata {
  role: ComicPersonRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

/**
 * Scraped comic-character relation fact.
 */
export interface ScrapedComicCharacterFact extends ScrapedCharacterMetadata {
  role: ComicCharacterRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

/**
 * Scraped comic-company relation fact.
 */
export interface ScrapedComicCompanyFact extends ScrapedCompanyMetadata {
  role: ComicCompanyRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

/**
 * Scraped comic metadata with relation/media facts.
 */
export interface ScrapedComicMetadata extends ScrapedComicCore, ScrapedIdentityCarrier {
  chapters?: ComicChapterInfo[] | undefined
  persons?: ScrapedComicPersonFact[] | undefined
  characters?: ScrapedComicCharacterFact[] | undefined
  companies?: ScrapedComicCompanyFact[] | undefined
  relatedEntries?: ScrapedRelatedEntryFact[] | undefined
  covers?: string[] | undefined
  backdrops?: string[] | undefined
  logos?: string[] | undefined
}

/**
 * Scraped novel-person relation fact.
 */
export interface ScrapedNovelPersonFact extends ScrapedPersonMetadata {
  role: NovelPersonRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

/**
 * Scraped novel-character relation fact.
 */
export interface ScrapedNovelCharacterFact extends ScrapedCharacterMetadata {
  role: NovelCharacterRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

/**
 * Scraped novel-company relation fact.
 */
export interface ScrapedNovelCompanyFact extends ScrapedCompanyMetadata {
  role: NovelCompanyRole
  isSpoiler?: boolean | undefined
  note?: string | undefined
}

/**
 * Scraped novel metadata with relation/media facts.
 */
export interface ScrapedNovelMetadata extends ScrapedNovelCore, ScrapedIdentityCarrier {
  volumes?: NovelVolumeInfo[] | undefined
  persons?: ScrapedNovelPersonFact[] | undefined
  characters?: ScrapedNovelCharacterFact[] | undefined
  companies?: ScrapedNovelCompanyFact[] | undefined
  relatedEntries?: ScrapedRelatedEntryFact[] | undefined
  covers?: string[] | undefined
  backdrops?: string[] | undefined
  logos?: string[] | undefined
}

/**
 * Relation facts a game scrape can state.
 *
 * An absent key means the scrape could not answer that relation; an empty array
 * means the source states the game has none.
 */
export interface ScrapedGameRelationFacts {
  gamePerson?: ScrapedGamePersonFact[] | undefined
  gameCompany?: ScrapedGameCompanyFact[] | undefined
  gameCharacter?: ScrapedGameCharacterFact[] | undefined
  characterPerson?: ScrapedCharacterPersonFact[] | undefined
  relatedEntries?: ScrapedRelatedEntryFact[] | undefined
}

export interface ScrapedGameBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedGameCore | undefined
  relationFacts?: ScrapedGameRelationFacts | undefined
  mediaCandidates?:
    | {
        coverUrls?: string[] | undefined
        backdropUrls?: string[] | undefined
        logoUrls?: string[] | undefined
        iconUrls?: string[] | undefined
      }
    | undefined
}

/** Relation facts an anime scrape can state; see `ScrapedGameRelationFacts`. */
export interface ScrapedAnimeRelationFacts {
  animePerson?: ScrapedAnimePersonFact[] | undefined
  animeCompany?: ScrapedAnimeCompanyFact[] | undefined
  animeCharacter?: ScrapedAnimeCharacterFact[] | undefined
  characterPerson?: ScrapedCharacterPersonFact[] | undefined
  relatedEntries?: ScrapedRelatedEntryFact[] | undefined
}

export interface ScrapedAnimeBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedAnimeCore | undefined
  /** Absent means unknown; an empty array means the source states no episodes. */
  episodes?: AnimeEpisodeInfo[] | undefined
  relationFacts?: ScrapedAnimeRelationFacts | undefined
  mediaCandidates?:
    | {
        coverUrls?: string[] | undefined
        backdropUrls?: string[] | undefined
        logoUrls?: string[] | undefined
      }
    | undefined
}

/** Relation facts a comic scrape can state; see `ScrapedGameRelationFacts`. */
export interface ScrapedComicRelationFacts {
  comicPerson?: ScrapedComicPersonFact[] | undefined
  comicCompany?: ScrapedComicCompanyFact[] | undefined
  comicCharacter?: ScrapedComicCharacterFact[] | undefined
  characterPerson?: ScrapedCharacterPersonFact[] | undefined
  relatedEntries?: ScrapedRelatedEntryFact[] | undefined
}

export interface ScrapedComicBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedComicCore | undefined
  /** Absent means unknown; an empty array means the source states no units. */
  chapters?: ComicChapterInfo[] | undefined
  relationFacts?: ScrapedComicRelationFacts | undefined
  mediaCandidates?:
    | {
        coverUrls?: string[] | undefined
        backdropUrls?: string[] | undefined
        logoUrls?: string[] | undefined
      }
    | undefined
}

/** Relation facts a novel scrape can state; see `ScrapedGameRelationFacts`. */
export interface ScrapedNovelRelationFacts {
  novelPerson?: ScrapedNovelPersonFact[] | undefined
  novelCompany?: ScrapedNovelCompanyFact[] | undefined
  novelCharacter?: ScrapedNovelCharacterFact[] | undefined
  characterPerson?: ScrapedCharacterPersonFact[] | undefined
  relatedEntries?: ScrapedRelatedEntryFact[] | undefined
}

export interface ScrapedNovelBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedNovelCore | undefined
  /** Absent means unknown; an empty array means the source states no volumes. */
  volumes?: NovelVolumeInfo[] | undefined
  relationFacts?: ScrapedNovelRelationFacts | undefined
  mediaCandidates?:
    | {
        coverUrls?: string[] | undefined
        backdropUrls?: string[] | undefined
        logoUrls?: string[] | undefined
      }
    | undefined
}

export interface ScrapedPersonBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedPersonCore | undefined
  mediaCandidates?:
    | {
        photoUrls?: string[] | undefined
      }
    | undefined
}

export interface ScrapedCompanyBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedCompanyCore | undefined
  mediaCandidates?:
    | {
        logoUrls?: string[] | undefined
      }
    | undefined
}

/** Relation facts a character scrape can state; see `ScrapedGameRelationFacts`. */
export interface ScrapedCharacterRelationFacts {
  characterPerson?: ScrapedCharacterPersonFact[] | undefined
}

export interface ScrapedCharacterBundle {
  identity: ScrapedEntityIdentity
  core?: ScrapedCharacterCore | undefined
  relationFacts?: ScrapedCharacterRelationFacts | undefined
  mediaCandidates?:
    | {
        photoUrls?: string[] | undefined
      }
    | undefined
}
