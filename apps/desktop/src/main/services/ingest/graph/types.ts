import type {
  AnimeCharacterRole,
  AnimeCompanyRole,
  AnimePersonRole,
  CharacterPersonRole,
  GameCharacterRole,
  GameCompanyRole,
  GamePersonRole
} from '@shared/db'
import type { ScrapedRelatedEntryFact } from '@shared/scraper'
import type {
  AnimeEpisodeInfo,
  CoreAnimeMetadata,
  CoreCharacterMetadata,
  CoreCompanyMetadata,
  CoreGameMetadata,
  CorePersonMetadata
} from '@shared/metadata'

export interface IngestEntityNode<TCore> {
  identityKey: string
  core: TCore
}

export interface IngestLinkBase {
  isSpoiler: boolean
  note?: string
}

export type IngestGameNode = IngestEntityNode<CoreGameMetadata>

export type IngestAnimeNode = IngestEntityNode<CoreAnimeMetadata>

export interface IngestPersonNode extends IngestEntityNode<CorePersonMetadata> {
  photoUrls?: string[]
}

export interface IngestCompanyNode extends IngestEntityNode<CoreCompanyMetadata> {
  logoUrls?: string[]
}

export interface IngestCharacterNode extends IngestEntityNode<CoreCharacterMetadata> {
  photoUrls?: string[]
}

export interface IngestCharacterPersonLink extends IngestLinkBase {
  characterIdentityKey: string
  personIdentityKey: string
  role: CharacterPersonRole
  orderInCharacter: number
  orderInPerson: number
}

export interface IngestGamePersonLink extends IngestLinkBase {
  gameIdentityKey: string
  personIdentityKey: string
  role: GamePersonRole
  orderInGame: number
  orderInPerson: number
}

/**
 * One entry-scoped voice credit.
 *
 * Carries no role or order of its own: the fact is the pairing, and the
 * character link it accompanies owns presentation.
 */
export interface IngestGameCastLink {
  gameIdentityKey: string
  characterIdentityKey: string
  personIdentityKey: string
  note?: string
}

export interface IngestGameCompanyLink extends IngestLinkBase {
  gameIdentityKey: string
  companyIdentityKey: string
  role: GameCompanyRole
  orderInGame: number
  orderInCompany: number
}

export interface IngestGameCharacterLink extends IngestLinkBase {
  gameIdentityKey: string
  characterIdentityKey: string
  role: GameCharacterRole
  orderInGame: number
  orderInCharacter: number
}

/** Link rows a game graph produces, keyed by the link table they populate. */
export interface IngestGameGraphLinks {
  gamePerson: IngestGamePersonLink[]
  gameCompany: IngestGameCompanyLink[]
  gameCharacter: IngestGameCharacterLink[]
  gameCast: IngestGameCastLink[]
  characterPerson: IngestCharacterPersonLink[]
}

export interface IngestGameGraph {
  game: IngestGameNode
  persons: IngestPersonNode[]
  companies: IngestCompanyNode[]
  characters: IngestCharacterNode[]
  links: IngestGameGraphLinks
  /** Media-relation facts pass through unresolved; persist resolves against the library. */
  relatedEntries?: ScrapedRelatedEntryFact[]
  media: {
    coverUrl?: string
    backdropUrl?: string
    logoUrl?: string
    iconUrl?: string
  }
}

export interface IngestAnimePersonLink extends IngestLinkBase {
  animeIdentityKey: string
  personIdentityKey: string
  role: AnimePersonRole
  orderInAnime: number
  orderInPerson: number
}

/** One entry-scoped voice credit; see `IngestGameCastLink`. */
export interface IngestAnimeCastLink {
  animeIdentityKey: string
  characterIdentityKey: string
  personIdentityKey: string
  note?: string
}

export interface IngestAnimeCompanyLink extends IngestLinkBase {
  animeIdentityKey: string
  companyIdentityKey: string
  role: AnimeCompanyRole
  orderInAnime: number
  orderInCompany: number
}

export interface IngestAnimeCharacterLink extends IngestLinkBase {
  animeIdentityKey: string
  characterIdentityKey: string
  role: AnimeCharacterRole
  orderInAnime: number
  orderInCharacter: number
}

/** Link rows an anime graph produces, keyed by the link table they populate. */
export interface IngestAnimeGraphLinks {
  animePerson: IngestAnimePersonLink[]
  animeCompany: IngestAnimeCompanyLink[]
  animeCharacter: IngestAnimeCharacterLink[]
  animeCast: IngestAnimeCastLink[]
  characterPerson: IngestCharacterPersonLink[]
}

export interface IngestAnimeGraph {
  anime: IngestAnimeNode
  /** Absent means the scrape could not answer episodes; an empty array means none exist. */
  episodes?: AnimeEpisodeInfo[]
  persons: IngestPersonNode[]
  companies: IngestCompanyNode[]
  characters: IngestCharacterNode[]
  links: IngestAnimeGraphLinks
  /** Media-relation facts pass through unresolved; persist resolves against the library. */
  relatedEntries?: ScrapedRelatedEntryFact[]
  media: {
    coverUrl?: string
    backdropUrl?: string
    logoUrl?: string
  }
}

export interface IngestPersonGraph {
  person: IngestPersonNode
}

export interface IngestCompanyGraph {
  company: IngestCompanyNode
}

export interface IngestCharacterGraph {
  character: IngestCharacterNode
  persons: IngestPersonNode[]
  links: IngestCharacterPersonLink[]
}

export interface IdentityAliasIndex {
  externalIdToCanonical: Map<string, string>
  fallbackToCanonical: Map<string, Set<string>>
}
