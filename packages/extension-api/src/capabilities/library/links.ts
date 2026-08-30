import type { LibraryEntityReference } from './entities'
import type {
  LibraryAnimeCharacterRole,
  LibraryAnimeCompanyRole,
  LibraryAnimePersonRole,
  LibraryCharacterPersonRole,
  LibraryComicCharacterRole,
  LibraryComicCompanyRole,
  LibraryComicPersonRole,
  LibraryGameCharacterRole,
  LibraryGameCompanyRole,
  LibraryGamePersonRole,
  LibraryNovelCharacterRole,
  LibraryNovelCompanyRole,
  LibraryNovelPersonRole
} from '../../shared/library'

/**
 * Two-endpoint links an extension can manage directly.
 *
 * An entry's cast is a three-way fact, so it is not a link kind: extensions
 * write it through the graph's `media-cast` edge, which can name all three
 * endpoints at once.
 */
export const LIBRARY_LINK_KINDS = [
  'game-person',
  'game-company',
  'game-character',
  'anime-person',
  'anime-company',
  'anime-character',
  'comic-person',
  'comic-company',
  'comic-character',
  'novel-person',
  'novel-company',
  'novel-character',
  'character-person',
  'game-tag',
  'anime-tag',
  'comic-tag',
  'novel-tag',
  'character-tag',
  'person-tag',
  'company-tag',
  'collection-game',
  'collection-anime',
  'collection-comic',
  'collection-novel',
  'collection-character',
  'collection-person',
  'collection-company'
] as const

export type LibraryLinkKind = (typeof LIBRARY_LINK_KINDS)[number]

export interface LibraryOrderedLinkMetadata {
  note?: string | undefined
  order?: number | undefined
}

export interface LibrarySpoilerLinkMetadata extends LibraryOrderedLinkMetadata {
  isSpoiler?: boolean | undefined
}

export interface GamePersonLinkMetadata extends LibrarySpoilerLinkMetadata {
  role: LibraryGamePersonRole
}

export interface GameCompanyLinkMetadata extends LibrarySpoilerLinkMetadata {
  role: LibraryGameCompanyRole
}

export interface GameCharacterLinkMetadata extends LibrarySpoilerLinkMetadata {
  role: LibraryGameCharacterRole
}

export interface AnimePersonLinkMetadata extends LibrarySpoilerLinkMetadata {
  role: LibraryAnimePersonRole
}

export interface AnimeCompanyLinkMetadata extends LibrarySpoilerLinkMetadata {
  role: LibraryAnimeCompanyRole
}

export interface AnimeCharacterLinkMetadata extends LibrarySpoilerLinkMetadata {
  role: LibraryAnimeCharacterRole
}

export interface ComicPersonLinkMetadata extends LibrarySpoilerLinkMetadata {
  role: LibraryComicPersonRole
}

export interface ComicCompanyLinkMetadata extends LibrarySpoilerLinkMetadata {
  role: LibraryComicCompanyRole
}

export interface ComicCharacterLinkMetadata extends LibrarySpoilerLinkMetadata {
  role: LibraryComicCharacterRole
}

export interface NovelPersonLinkMetadata extends LibrarySpoilerLinkMetadata {
  role: LibraryNovelPersonRole
}

export interface NovelCompanyLinkMetadata extends LibrarySpoilerLinkMetadata {
  role: LibraryNovelCompanyRole
}

export interface NovelCharacterLinkMetadata extends LibrarySpoilerLinkMetadata {
  role: LibraryNovelCharacterRole
}

export interface CharacterPersonLinkMetadata extends LibrarySpoilerLinkMetadata {
  role: LibraryCharacterPersonRole
}

export type CollectionMembershipMetadata = LibraryOrderedLinkMetadata

export type TagMembershipMetadata = LibrarySpoilerLinkMetadata

export interface LibraryLinkMetadataMap {
  'game-person': GamePersonLinkMetadata
  'game-company': GameCompanyLinkMetadata
  'game-character': GameCharacterLinkMetadata
  'anime-person': AnimePersonLinkMetadata
  'anime-company': AnimeCompanyLinkMetadata
  'anime-character': AnimeCharacterLinkMetadata
  'comic-person': ComicPersonLinkMetadata
  'comic-company': ComicCompanyLinkMetadata
  'comic-character': ComicCharacterLinkMetadata
  'novel-person': NovelPersonLinkMetadata
  'novel-company': NovelCompanyLinkMetadata
  'novel-character': NovelCharacterLinkMetadata
  'character-person': CharacterPersonLinkMetadata
  'game-tag': TagMembershipMetadata
  'anime-tag': TagMembershipMetadata
  'comic-tag': TagMembershipMetadata
  'novel-tag': TagMembershipMetadata
  'character-tag': TagMembershipMetadata
  'person-tag': TagMembershipMetadata
  'company-tag': TagMembershipMetadata
  'collection-game': CollectionMembershipMetadata
  'collection-anime': CollectionMembershipMetadata
  'collection-comic': CollectionMembershipMetadata
  'collection-novel': CollectionMembershipMetadata
  'collection-character': CollectionMembershipMetadata
  'collection-person': CollectionMembershipMetadata
  'collection-company': CollectionMembershipMetadata
}

export interface LibraryLinkEndpointMap {
  'game-person': { from: 'game'; to: 'person' }
  'game-company': { from: 'game'; to: 'company' }
  'game-character': { from: 'game'; to: 'character' }
  'anime-person': { from: 'anime'; to: 'person' }
  'anime-company': { from: 'anime'; to: 'company' }
  'anime-character': { from: 'anime'; to: 'character' }
  'comic-person': { from: 'comic'; to: 'person' }
  'comic-company': { from: 'comic'; to: 'company' }
  'comic-character': { from: 'comic'; to: 'character' }
  'novel-person': { from: 'novel'; to: 'person' }
  'novel-company': { from: 'novel'; to: 'company' }
  'novel-character': { from: 'novel'; to: 'character' }
  'character-person': { from: 'character'; to: 'person' }
  'game-tag': { from: 'game'; to: 'tag' }
  'anime-tag': { from: 'anime'; to: 'tag' }
  'comic-tag': { from: 'comic'; to: 'tag' }
  'novel-tag': { from: 'novel'; to: 'tag' }
  'character-tag': { from: 'character'; to: 'tag' }
  'person-tag': { from: 'person'; to: 'tag' }
  'company-tag': { from: 'company'; to: 'tag' }
  'collection-game': { from: 'collection'; to: 'game' }
  'collection-anime': { from: 'collection'; to: 'anime' }
  'collection-comic': { from: 'collection'; to: 'comic' }
  'collection-novel': { from: 'collection'; to: 'novel' }
  'collection-character': { from: 'collection'; to: 'character' }
  'collection-person': { from: 'collection'; to: 'person' }
  'collection-company': { from: 'collection'; to: 'company' }
}

export type LibraryLinkFromType<K extends LibraryLinkKind> = LibraryLinkEndpointMap[K]['from']

export type LibraryLinkToType<K extends LibraryLinkKind> = LibraryLinkEndpointMap[K]['to']

export type LibraryLinkMetadata<K extends LibraryLinkKind = LibraryLinkKind> =
  LibraryLinkMetadataMap[K]

export type LibraryLinkPatch<K extends LibraryLinkKind = LibraryLinkKind> = Partial<
  LibraryLinkMetadataMap[K]
>

export type LibraryLinkSelectorExtra<K extends LibraryLinkKind> =
  LibraryLinkMetadataMap[K] extends { role: infer R } ? { role: R } : Record<string, never>

export interface LibraryLink<K extends LibraryLinkKind = LibraryLinkKind> {
  kind: K
  from: LibraryEntityReference<LibraryLinkFromType<K>>
  to: LibraryEntityReference<LibraryLinkToType<K>>
  metadata: LibraryLinkMetadataMap[K]
  createdAt?: number | undefined
  updatedAt?: number | undefined
}

export interface LibraryLinkCreateInput<K extends LibraryLinkKind = LibraryLinkKind> {
  kind: K
  from: LibraryEntityReference<LibraryLinkFromType<K>>
  to: LibraryEntityReference<LibraryLinkToType<K>>
  metadata: LibraryLinkMetadataMap[K]
}

export type LibraryLinkSelector<K extends LibraryLinkKind = LibraryLinkKind> = {
  kind: K
  from: LibraryEntityReference<LibraryLinkFromType<K>>
  to: LibraryEntityReference<LibraryLinkToType<K>>
} & LibraryLinkSelectorExtra<K>

export interface LibraryLinkQuery {
  entity?: LibraryEntityReference | undefined
  relatedEntity?: LibraryEntityReference | undefined
  kinds?: readonly LibraryLinkKind[] | undefined
}

export interface LibraryLinkCapability {
  list(query?: LibraryLinkQuery): Promise<readonly LibraryLink[]>
  create<K extends LibraryLinkKind>(input: LibraryLinkCreateInput<K>): Promise<LibraryLink<K>>
  update<K extends LibraryLinkKind>(
    selector: LibraryLinkSelector<K>,
    patch: LibraryLinkPatch<K>
  ): Promise<LibraryLink<K>>
  remove<K extends LibraryLinkKind>(selector: LibraryLinkSelector<K>): Promise<void>
}
