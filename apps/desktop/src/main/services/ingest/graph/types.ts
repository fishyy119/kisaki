import type {
  AnimeCharacterType,
  AnimeCompanyType,
  AnimePersonType,
  CharacterPersonType,
  GameCharacterType,
  GameCompanyType,
  GamePersonType
} from '@shared/db'
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
  type: CharacterPersonType
  orderInCharacter: number
  orderInPerson: number
}

export interface IngestGamePersonLink extends IngestLinkBase {
  gameIdentityKey: string
  personIdentityKey: string
  type: GamePersonType
  orderInGame: number
  orderInPerson: number
}

export interface IngestGameCompanyLink extends IngestLinkBase {
  gameIdentityKey: string
  companyIdentityKey: string
  type: GameCompanyType
  orderInGame: number
  orderInCompany: number
}

export interface IngestGameCharacterLink extends IngestLinkBase {
  gameIdentityKey: string
  characterIdentityKey: string
  type: GameCharacterType
  orderInGame: number
  orderInCharacter: number
}

/** Link rows a game graph produces, keyed by the link table they populate. */
export interface IngestGameGraphLinks {
  gamePerson: IngestGamePersonLink[]
  gameCompany: IngestGameCompanyLink[]
  gameCharacter: IngestGameCharacterLink[]
  characterPerson: IngestCharacterPersonLink[]
}

export interface IngestGameGraph {
  game: IngestGameNode
  persons: IngestPersonNode[]
  companies: IngestCompanyNode[]
  characters: IngestCharacterNode[]
  links: IngestGameGraphLinks
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
  type: AnimePersonType
  orderInAnime: number
  orderInPerson: number
}

export interface IngestAnimeCompanyLink extends IngestLinkBase {
  animeIdentityKey: string
  companyIdentityKey: string
  type: AnimeCompanyType
  orderInAnime: number
  orderInCompany: number
}

export interface IngestAnimeCharacterLink extends IngestLinkBase {
  animeIdentityKey: string
  characterIdentityKey: string
  type: AnimeCharacterType
  orderInAnime: number
  orderInCharacter: number
}

/** Link rows an anime graph produces, keyed by the link table they populate. */
export interface IngestAnimeGraphLinks {
  animePerson: IngestAnimePersonLink[]
  animeCompany: IngestAnimeCompanyLink[]
  animeCharacter: IngestAnimeCharacterLink[]
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
