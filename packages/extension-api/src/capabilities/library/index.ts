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
  LibraryCompany,
  LibraryCompanyCreateInput,
  LibraryCompanyPatch,
  LibraryCompanyQuery,
  LibraryGame,
  LibraryGameCreateInput,
  LibraryGamePatch,
  LibraryGameQuery,
  LibraryMovie,
  LibraryMovieCreateInput,
  LibraryMoviePatch,
  LibraryMovieQuery,
  LibraryPerson,
  LibraryPersonCreateInput,
  LibraryPersonPatch,
  LibraryPersonQuery,
  LibraryTag,
  LibraryTagCreateInput,
  LibraryTagPatch,
  LibraryTagQuery,
  LibraryTv,
  LibraryTvCreateInput,
  LibraryTvEpisode,
  LibraryTvEpisodeQuery,
  LibraryTvEpisodeWatchStatePatch,
  LibraryTvPatch,
  LibraryTvQuery,
  LibraryTvSeason,
  LibraryTvSeasonQuery
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
 * Seasons owned by a tv entry.
 *
 * Read-only: seasons exist to group episodes and carry the metadata a scraper
 * publishes per season, and they are written through the ingest pipeline that
 * owns that metadata rather than edited one row at a time.
 */
export interface LibraryTvSeasonNamespace {
  list(query: LibraryTvSeasonQuery): Promise<readonly LibraryTvSeason[]>
}

/**
 * Episodes owned by a tv entry.
 *
 * Exposed under the tv namespace rather than promoted to an entity type: an
 * episode has no independent identity in the library, and per-episode watch
 * state is the only reason callers reach for it.
 */
export interface LibraryTvEpisodeNamespace {
  list(query: LibraryTvEpisodeQuery): Promise<readonly LibraryTvEpisode[]>
  patchWatchState(
    episodeId: string,
    patch: LibraryTvEpisodeWatchStatePatch
  ): Promise<LibraryTvEpisode>
}

export interface LibraryTvNamespace extends LibraryEntityNamespace<
  LibraryTv,
  LibraryTvCreateInput,
  LibraryTvPatch,
  LibraryTvQuery
> {
  seasons: LibraryTvSeasonNamespace
  episodes: LibraryTvEpisodeNamespace
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
  tvs: LibraryTvNamespace
  /** A film is one unit, so watch state is patched on the entry itself. */
  movies: LibraryEntityNamespace<
    LibraryMovie,
    LibraryMovieCreateInput,
    LibraryMoviePatch,
    LibraryMovieQuery
  >
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
