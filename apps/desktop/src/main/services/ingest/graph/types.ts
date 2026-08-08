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

export interface IngestEntityNode<TCore> {
  identityKey: string
  core: TCore
}

export interface IngestLinkBase {
  isSpoiler: boolean
  note?: string
}

export type IngestGameNode = IngestEntityNode<CoreGameMetadata>

export interface IngestGamePersonNode extends IngestEntityNode<CorePersonMetadata> {
  photoUrls?: string[]
}

export interface IngestGameCompanyNode extends IngestEntityNode<CoreCompanyMetadata> {
  logoUrls?: string[]
}

export interface IngestGameCharacterNode extends IngestEntityNode<CoreCharacterMetadata> {
  photoUrls?: string[]
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

export interface IngestGameCharacterPersonLink extends IngestLinkBase {
  characterIdentityKey: string
  personIdentityKey: string
  type: CharacterPersonType
  orderInCharacter: number
  orderInPerson: number
}

/** Link rows a game graph produces, keyed by the link table they populate. */
export interface IngestGameGraphLinks {
  gamePerson: IngestGamePersonLink[]
  gameCompany: IngestGameCompanyLink[]
  gameCharacter: IngestGameCharacterLink[]
  characterPerson: IngestGameCharacterPersonLink[]
}

export interface IngestGameGraph {
  game: IngestGameNode
  persons: IngestGamePersonNode[]
  companies: IngestGameCompanyNode[]
  characters: IngestGameCharacterNode[]
  links: IngestGameGraphLinks
  media: {
    coverUrl?: string
    backdropUrl?: string
    logoUrl?: string
    iconUrl?: string
  }
}

export interface IngestPersonNode extends IngestEntityNode<CorePersonMetadata> {
  photoUrls?: string[]
}

export interface IngestPersonGraph {
  person: IngestPersonNode
}

export interface IngestCompanyNode extends IngestEntityNode<CoreCompanyMetadata> {
  logoUrls?: string[]
}

export interface IngestCompanyGraph {
  company: IngestCompanyNode
}

export interface IngestCharacterNode extends IngestEntityNode<CoreCharacterMetadata> {
  photoUrls?: string[]
}

export interface IngestCharacterPersonNode extends IngestEntityNode<CorePersonMetadata> {
  photoUrls?: string[]
}

export interface IngestCharacterPersonLink extends IngestLinkBase {
  characterIdentityKey: string
  personIdentityKey: string
  type: CharacterPersonType
  orderInCharacter: number
  orderInPerson: number
}

export interface IngestCharacterGraph {
  character: IngestCharacterNode
  persons: IngestCharacterPersonNode[]
  links: IngestCharacterPersonLink[]
}

export interface NormalizedPersonNode {
  identityKey: string
  core: CorePersonMetadata
  photoUrls?: string[]
}

export interface NormalizedCompanyNode {
  identityKey: string
  core: CoreCompanyMetadata
  logoUrls?: string[]
}

export interface NormalizedCharacterNode {
  identityKey: string
  core: CoreCharacterMetadata
  photoUrls?: string[]
}

export interface IdentityAliasIndex {
  externalIdToCanonical: Map<string, string>
  fallbackToCanonical: Map<string, Set<string>>
}
