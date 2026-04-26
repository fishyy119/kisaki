import type { LibraryEntityReference } from './entities'
import type {
  LibraryCharacterPersonRole,
  LibraryGameCharacterRole,
  LibraryGameCompanyRole,
  LibraryGamePersonRole
} from '../../shared/library'

export const LIBRARY_RELATION_KINDS = [
  'game-person',
  'game-company',
  'game-character',
  'character-person',
  'game-tag',
  'character-tag',
  'person-tag',
  'company-tag',
  'collection-game',
  'collection-character',
  'collection-person',
  'collection-company'
] as const

export type LibraryRelationKind = (typeof LIBRARY_RELATION_KINDS)[number]

export interface LibraryOrderedRelationMetadata {
  note?: string
  order?: number
}

export interface LibrarySpoilerRelationMetadata extends LibraryOrderedRelationMetadata {
  isSpoiler?: boolean
}

export interface GamePersonRelationMetadata extends LibrarySpoilerRelationMetadata {
  type: LibraryGamePersonRole
}

export interface GameCompanyRelationMetadata extends LibrarySpoilerRelationMetadata {
  type: LibraryGameCompanyRole
}

export interface GameCharacterRelationMetadata extends LibrarySpoilerRelationMetadata {
  type: LibraryGameCharacterRole
}

export interface CharacterPersonRelationMetadata extends LibrarySpoilerRelationMetadata {
  type: LibraryCharacterPersonRole
}

export type CollectionMembershipMetadata = LibraryOrderedRelationMetadata

export type TagMembershipMetadata = LibrarySpoilerRelationMetadata

export interface LibraryRelationMetadataMap {
  'game-person': GamePersonRelationMetadata
  'game-company': GameCompanyRelationMetadata
  'game-character': GameCharacterRelationMetadata
  'character-person': CharacterPersonRelationMetadata
  'game-tag': TagMembershipMetadata
  'character-tag': TagMembershipMetadata
  'person-tag': TagMembershipMetadata
  'company-tag': TagMembershipMetadata
  'collection-game': CollectionMembershipMetadata
  'collection-character': CollectionMembershipMetadata
  'collection-person': CollectionMembershipMetadata
  'collection-company': CollectionMembershipMetadata
}

export interface LibraryRelationEndpointMap {
  'game-person': { from: 'game'; to: 'person' }
  'game-company': { from: 'game'; to: 'company' }
  'game-character': { from: 'game'; to: 'character' }
  'character-person': { from: 'character'; to: 'person' }
  'game-tag': { from: 'game'; to: 'tag' }
  'character-tag': { from: 'character'; to: 'tag' }
  'person-tag': { from: 'person'; to: 'tag' }
  'company-tag': { from: 'company'; to: 'tag' }
  'collection-game': { from: 'collection'; to: 'game' }
  'collection-character': { from: 'collection'; to: 'character' }
  'collection-person': { from: 'collection'; to: 'person' }
  'collection-company': { from: 'collection'; to: 'company' }
}

export type LibraryRelationFromType<K extends LibraryRelationKind> =
  LibraryRelationEndpointMap[K]['from']

export type LibraryRelationToType<K extends LibraryRelationKind> =
  LibraryRelationEndpointMap[K]['to']

export type LibraryRelationMetadata<K extends LibraryRelationKind = LibraryRelationKind> =
  LibraryRelationMetadataMap[K]

export type LibraryRelationPatch<K extends LibraryRelationKind = LibraryRelationKind> = Partial<
  LibraryRelationMetadataMap[K]
>

export type LibraryRelationSelectorExtra<K extends LibraryRelationKind> =
  LibraryRelationMetadataMap[K] extends { type: infer T } ? { type: T } : Record<string, never>

export interface LibraryRelation<K extends LibraryRelationKind = LibraryRelationKind> {
  kind: K
  from: LibraryEntityReference<LibraryRelationFromType<K>>
  to: LibraryEntityReference<LibraryRelationToType<K>>
  metadata: LibraryRelationMetadataMap[K]
  createdAt?: number
  updatedAt?: number
}

export interface LibraryRelationCreateInput<K extends LibraryRelationKind = LibraryRelationKind> {
  kind: K
  from: LibraryEntityReference<LibraryRelationFromType<K>>
  to: LibraryEntityReference<LibraryRelationToType<K>>
  metadata: LibraryRelationMetadataMap[K]
}

export type LibraryRelationSelector<K extends LibraryRelationKind = LibraryRelationKind> = {
  kind: K
  from: LibraryEntityReference<LibraryRelationFromType<K>>
  to: LibraryEntityReference<LibraryRelationToType<K>>
} & LibraryRelationSelectorExtra<K>

export interface LibraryRelationQuery {
  entity?: LibraryEntityReference
  relatedEntity?: LibraryEntityReference
  kinds?: readonly LibraryRelationKind[]
}

export interface LibraryRelationCapability {
  list(query?: LibraryRelationQuery): Promise<readonly LibraryRelation[]>
  create<K extends LibraryRelationKind>(
    input: LibraryRelationCreateInput<K>
  ): Promise<LibraryRelation<K>>
  update<K extends LibraryRelationKind>(
    selector: LibraryRelationSelector<K>,
    patch: LibraryRelationPatch<K>
  ): Promise<LibraryRelation<K>>
  remove<K extends LibraryRelationKind>(selector: LibraryRelationSelector<K>): Promise<void>
}
