import type { LibraryAttachmentCapability } from './attachments'
import type { LibraryGraphCapability } from './graph'
import type {
  LibraryAnime,
  LibraryAnimeCreateInput,
  LibraryAnimeEpisode,
  LibraryAnimeEpisodeQuery,
  LibraryAnimeEpisodeWatchStatePatch,
  LibraryAnimePatch,
  LibraryAnimeQuery,
  LibraryCharacter,
  LibraryCharacterCreateInput,
  LibraryCharacterPatch,
  LibraryCharacterQuery,
  LibraryCollection,
  LibraryCollectionCreateInput,
  LibraryCollectionPatch,
  LibraryCollectionQuery,
  LibraryComic,
  LibraryComicChapter,
  LibraryComicChapterCreateInput,
  LibraryComicChapterQuery,
  LibraryComicChapterReadStatePatch,
  LibraryComicCreateInput,
  LibraryComicPatch,
  LibraryComicQuery,
  LibraryCompany,
  LibraryCompanyCreateInput,
  LibraryCompanyPatch,
  LibraryCompanyQuery,
  LibraryGame,
  LibraryGameCreateInput,
  LibraryGamePatch,
  LibraryGameQuery,
  LibraryNovel,
  LibraryNovelCreateInput,
  LibraryNovelPatch,
  LibraryNovelQuery,
  LibraryNovelVolume,
  LibraryNovelVolumeCreateInput,
  LibraryNovelVolumeQuery,
  LibraryNovelVolumeReadStatePatch,
  LibraryPerson,
  LibraryPersonCreateInput,
  LibraryPersonPatch,
  LibraryPersonQuery,
  LibraryTag,
  LibraryTagCreateInput,
  LibraryTagPatch,
  LibraryTagQuery
} from './entities'
import type { LibraryLinkCapability } from './links'
import type { LibraryMediaRelationCapability } from './relations'

export interface LibraryEntityNamespace<TEntity, TCreate, TPatch, TQuery> {
  get(id: string): Promise<TEntity | null>
  list(query?: TQuery): Promise<readonly TEntity[]>
  create(input: TCreate): Promise<TEntity>
  update(id: string, patch: TPatch): Promise<TEntity>
  remove(id: string): Promise<void>
}

/**
 * Episodes owned by an anime entry.
 *
 * Exposed under the anime namespace rather than promoted to an entity type:
 * an episode has no independent identity in the library, and per-episode watch
 * state is the only reason callers reach for it.
 */
export interface LibraryAnimeEpisodeNamespace {
  list(query: LibraryAnimeEpisodeQuery): Promise<readonly LibraryAnimeEpisode[]>
  patchWatchState(
    episodeId: string,
    patch: LibraryAnimeEpisodeWatchStatePatch
  ): Promise<LibraryAnimeEpisode>
}

export interface LibraryAnimeNamespace extends LibraryEntityNamespace<
  LibraryAnime,
  LibraryAnimeCreateInput,
  LibraryAnimePatch,
  LibraryAnimeQuery
> {
  episodes: LibraryAnimeEpisodeNamespace
}

/**
 * Readable units owned by a comic entry.
 *
 * Like anime episodes, units stay a sub-resource: creation is exposed so
 * importers can materialize a unit list, and read state is the per-unit fact
 * callers patch.
 */
export interface LibraryComicChapterNamespace {
  list(query: LibraryComicChapterQuery): Promise<readonly LibraryComicChapter[]>
  create(comicId: string, input: LibraryComicChapterCreateInput): Promise<LibraryComicChapter>
  patchReadState(
    chapterId: string,
    patch: LibraryComicChapterReadStatePatch
  ): Promise<LibraryComicChapter>
}

export interface LibraryComicNamespace extends LibraryEntityNamespace<
  LibraryComic,
  LibraryComicCreateInput,
  LibraryComicPatch,
  LibraryComicQuery
> {
  chapters: LibraryComicChapterNamespace
}

/** Volumes owned by a novel entry; see {@link LibraryComicChapterNamespace}. */
export interface LibraryNovelVolumeNamespace {
  list(query: LibraryNovelVolumeQuery): Promise<readonly LibraryNovelVolume[]>
  create(novelId: string, input: LibraryNovelVolumeCreateInput): Promise<LibraryNovelVolume>
  patchReadState(
    volumeId: string,
    patch: LibraryNovelVolumeReadStatePatch
  ): Promise<LibraryNovelVolume>
}

export interface LibraryNovelNamespace extends LibraryEntityNamespace<
  LibraryNovel,
  LibraryNovelCreateInput,
  LibraryNovelPatch,
  LibraryNovelQuery
> {
  volumes: LibraryNovelVolumeNamespace
}

export interface LibraryCapability {
  graph: LibraryGraphCapability
  games: LibraryEntityNamespace<
    LibraryGame,
    LibraryGameCreateInput,
    LibraryGamePatch,
    LibraryGameQuery
  >
  animes: LibraryAnimeNamespace
  comics: LibraryComicNamespace
  novels: LibraryNovelNamespace
  characters: LibraryEntityNamespace<
    LibraryCharacter,
    LibraryCharacterCreateInput,
    LibraryCharacterPatch,
    LibraryCharacterQuery
  >
  persons: LibraryEntityNamespace<
    LibraryPerson,
    LibraryPersonCreateInput,
    LibraryPersonPatch,
    LibraryPersonQuery
  >
  companies: LibraryEntityNamespace<
    LibraryCompany,
    LibraryCompanyCreateInput,
    LibraryCompanyPatch,
    LibraryCompanyQuery
  >
  collections: LibraryEntityNamespace<
    LibraryCollection,
    LibraryCollectionCreateInput,
    LibraryCollectionPatch,
    LibraryCollectionQuery
  >
  tags: LibraryEntityNamespace<LibraryTag, LibraryTagCreateInput, LibraryTagPatch, LibraryTagQuery>
  links: LibraryLinkCapability
  relations: LibraryMediaRelationCapability
  attachments: LibraryAttachmentCapability
}

export * from './attachments'
export * from './entities'
export * from './graph'
export * from './links'
export * from './relations'
export * from './validation'
