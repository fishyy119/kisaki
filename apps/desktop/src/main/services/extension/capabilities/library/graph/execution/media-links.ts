import { and, eq, type SQL } from 'drizzle-orm'
import type {
  AnySQLiteColumn,
  SQLiteInsertValue,
  SQLiteTable,
  SQLiteUpdateSetSource
} from 'drizzle-orm/sqlite-core'
import type {
  LibraryAnimeCharacterRole,
  LibraryAnimeCompanyRole,
  LibraryAnimePersonRole,
  LibraryGameCharacterRole,
  LibraryGameCompanyRole,
  LibraryGamePersonRole,
  LibraryMediaType,
  LibraryMovieCharacterRole,
  LibraryMovieCompanyRole,
  LibraryMoviePersonRole,
  LibraryTvCharacterRole,
  LibraryTvCompanyRole,
  LibraryTvPersonRole
} from '@kisaki3/extension-api'
import {
  animeCharacterLinks,
  animeCompanyLinks,
  animePersonLinks,
  animeTagLinks,
  collectionAnimeLinks,
  collectionGameLinks,
  collectionMovieLinks,
  collectionTvLinks,
  gameCharacterLinks,
  gameCompanyLinks,
  gamePersonLinks,
  gameTagLinks,
  movieCharacterLinks,
  movieCompanyLinks,
  moviePersonLinks,
  movieTagLinks,
  tvCharacterLinks,
  tvCompanyLinks,
  tvPersonLinks,
  tvTagLinks
} from '@shared/db'
import type { DbContext } from '@main/services/db'

/**
 * Every media link row carries an order within the media entry and an optional
 * note. `playing` is present only on person links, whose table alone stores the
 * characters a credit covers.
 */
export interface MediaLinkRow {
  order: number
  note: string | null
  playing?: string[] | null
}

export interface MediaLinkInsertInput {
  mediaId: string
  targetId: string
  /** Set on the link kinds whose rows are keyed by role. */
  role?: string
  note?: string
  playing?: string[] | null
  order: number
}

export interface MediaLinkPatch {
  order?: number
  note?: string
  playing?: string[] | null
}

/**
 * Per media type addressing of one link table.
 *
 * The link tables are structurally identical across media types and differ
 * only in their owner id column and `orderIn<Media>` naming, so the graph
 * writes them through this descriptor instead of branching per media type at
 * every call site.
 */
export interface MediaLinkConfig<TTable extends SQLiteTable = SQLiteTable> {
  table: TTable
  mediaIdColumn: AnySQLiteColumn<{ data: string }>
  targetIdColumn: AnySQLiteColumn<{ data: string }>
  /** Absent on link kinds whose rows are unique per pair, such as tags. */
  buildRoleCondition?: (role: string) => SQL
  toRow(row: TTable['$inferSelect']): MediaLinkRow
  buildInsertValue(input: MediaLinkInsertInput): SQLiteInsertValue<TTable>
  buildPatchValues(patch: MediaLinkPatch): SQLiteUpdateSetSource<TTable>
}

export interface MediaLinkConfigs {
  collection: MediaLinkConfig
  tag: MediaLinkConfig
  company: MediaLinkConfig
  person: MediaLinkConfig
  character: MediaLinkConfig
}

export function readMediaLink<TTable extends SQLiteTable>(
  db: DbContext,
  config: MediaLinkConfig<TTable>,
  mediaId: string,
  targetId: string,
  role?: string
): MediaLinkRow | undefined {
  const row = db
    .select()
    .from(config.table)
    .where(mediaLinkCondition(config, mediaId, targetId, role))
    .get()
  return row ? config.toRow(row as TTable['$inferSelect']) : undefined
}

export function insertMediaLink<TTable extends SQLiteTable>(
  db: DbContext,
  config: MediaLinkConfig<TTable>,
  input: MediaLinkInsertInput
): void {
  db.insert(config.table).values(config.buildInsertValue(input)).run()
}

export function updateMediaLink<TTable extends SQLiteTable>(
  db: DbContext,
  config: MediaLinkConfig<TTable>,
  mediaId: string,
  targetId: string,
  role: string | undefined,
  patch: MediaLinkPatch
): void {
  db.update(config.table)
    .set(config.buildPatchValues(patch))
    .where(mediaLinkCondition(config, mediaId, targetId, role))
    .run()
}

function mediaLinkCondition<TTable extends SQLiteTable>(
  config: MediaLinkConfig<TTable>,
  mediaId: string,
  targetId: string,
  role: string | undefined
): SQL {
  const conditions: SQL[] = [
    eq(config.mediaIdColumn, mediaId) as SQL,
    eq(config.targetIdColumn, targetId) as SQL
  ]
  if (config.buildRoleCondition && role !== undefined) {
    conditions.push(config.buildRoleCondition(role))
  }
  return and(...conditions) as SQL
}

const GAME_LINKS: MediaLinkConfigs = {
  collection: {
    table: collectionGameLinks,
    mediaIdColumn: collectionGameLinks.gameId,
    targetIdColumn: collectionGameLinks.collectionId,
    toRow: (row) => ({ order: row.orderInCollection, note: row.note }),
    buildInsertValue: (input) => ({
      gameId: input.mediaId,
      collectionId: input.targetId,
      orderInCollection: input.order
    }),
    buildPatchValues: (patch) => ({ orderInCollection: patch.order, note: patch.note })
  },
  tag: {
    table: gameTagLinks,
    mediaIdColumn: gameTagLinks.gameId,
    targetIdColumn: gameTagLinks.tagId,
    toRow: (row) => ({ order: row.orderInGame, note: row.note }),
    buildInsertValue: (input) => ({
      gameId: input.mediaId,
      tagId: input.targetId,
      orderInGame: input.order
    }),
    buildPatchValues: (patch) => ({ orderInGame: patch.order, note: patch.note })
  },
  company: {
    table: gameCompanyLinks,
    mediaIdColumn: gameCompanyLinks.gameId,
    targetIdColumn: gameCompanyLinks.companyId,
    buildRoleCondition: (role) => eq(gameCompanyLinks.role, role as LibraryGameCompanyRole),
    toRow: (row) => ({ order: row.orderInGame, note: row.note }),
    buildInsertValue: (input) => ({
      gameId: input.mediaId,
      companyId: input.targetId,
      role: input.role as LibraryGameCompanyRole,
      note: input.note,
      orderInGame: input.order
    }),
    buildPatchValues: (patch) => ({ orderInGame: patch.order, note: patch.note })
  },
  person: {
    table: gamePersonLinks,
    mediaIdColumn: gamePersonLinks.gameId,
    targetIdColumn: gamePersonLinks.personId,
    buildRoleCondition: (role) => eq(gamePersonLinks.role, role as LibraryGamePersonRole),
    toRow: (row) => ({ order: row.orderInGame, note: row.note, playing: row.playing }),
    buildInsertValue: (input) => ({
      gameId: input.mediaId,
      personId: input.targetId,
      role: input.role as LibraryGamePersonRole,
      note: input.note,
      playing: input.playing,
      orderInGame: input.order
    }),
    buildPatchValues: (patch) => ({
      orderInGame: patch.order,
      note: patch.note,
      playing: patch.playing
    })
  },
  character: {
    table: gameCharacterLinks,
    mediaIdColumn: gameCharacterLinks.gameId,
    targetIdColumn: gameCharacterLinks.characterId,
    buildRoleCondition: (role) => eq(gameCharacterLinks.role, role as LibraryGameCharacterRole),
    toRow: (row) => ({ order: row.orderInGame, note: row.note }),
    buildInsertValue: (input) => ({
      gameId: input.mediaId,
      characterId: input.targetId,
      role: input.role as LibraryGameCharacterRole,
      note: input.note,
      orderInGame: input.order
    }),
    buildPatchValues: (patch) => ({ orderInGame: patch.order, note: patch.note })
  }
}

const ANIME_LINKS: MediaLinkConfigs = {
  collection: {
    table: collectionAnimeLinks,
    mediaIdColumn: collectionAnimeLinks.animeId,
    targetIdColumn: collectionAnimeLinks.collectionId,
    toRow: (row) => ({ order: row.orderInCollection, note: row.note }),
    buildInsertValue: (input) => ({
      animeId: input.mediaId,
      collectionId: input.targetId,
      orderInCollection: input.order
    }),
    buildPatchValues: (patch) => ({ orderInCollection: patch.order, note: patch.note })
  },
  tag: {
    table: animeTagLinks,
    mediaIdColumn: animeTagLinks.animeId,
    targetIdColumn: animeTagLinks.tagId,
    toRow: (row) => ({ order: row.orderInAnime, note: row.note }),
    buildInsertValue: (input) => ({
      animeId: input.mediaId,
      tagId: input.targetId,
      orderInAnime: input.order
    }),
    buildPatchValues: (patch) => ({ orderInAnime: patch.order, note: patch.note })
  },
  company: {
    table: animeCompanyLinks,
    mediaIdColumn: animeCompanyLinks.animeId,
    targetIdColumn: animeCompanyLinks.companyId,
    buildRoleCondition: (role) => eq(animeCompanyLinks.role, role as LibraryAnimeCompanyRole),
    toRow: (row) => ({ order: row.orderInAnime, note: row.note }),
    buildInsertValue: (input) => ({
      animeId: input.mediaId,
      companyId: input.targetId,
      role: input.role as LibraryAnimeCompanyRole,
      note: input.note,
      orderInAnime: input.order
    }),
    buildPatchValues: (patch) => ({ orderInAnime: patch.order, note: patch.note })
  },
  person: {
    table: animePersonLinks,
    mediaIdColumn: animePersonLinks.animeId,
    targetIdColumn: animePersonLinks.personId,
    buildRoleCondition: (role) => eq(animePersonLinks.role, role as LibraryAnimePersonRole),
    toRow: (row) => ({ order: row.orderInAnime, note: row.note, playing: row.playing }),
    buildInsertValue: (input) => ({
      animeId: input.mediaId,
      personId: input.targetId,
      role: input.role as LibraryAnimePersonRole,
      note: input.note,
      playing: input.playing,
      orderInAnime: input.order
    }),
    buildPatchValues: (patch) => ({
      orderInAnime: patch.order,
      note: patch.note,
      playing: patch.playing
    })
  },
  character: {
    table: animeCharacterLinks,
    mediaIdColumn: animeCharacterLinks.animeId,
    targetIdColumn: animeCharacterLinks.characterId,
    buildRoleCondition: (role) => eq(animeCharacterLinks.role, role as LibraryAnimeCharacterRole),
    toRow: (row) => ({ order: row.orderInAnime, note: row.note }),
    buildInsertValue: (input) => ({
      animeId: input.mediaId,
      characterId: input.targetId,
      role: input.role as LibraryAnimeCharacterRole,
      note: input.note,
      orderInAnime: input.order
    }),
    buildPatchValues: (patch) => ({ orderInAnime: patch.order, note: patch.note })
  }
}

const TV_LINKS: MediaLinkConfigs = {
  collection: {
    table: collectionTvLinks,
    mediaIdColumn: collectionTvLinks.tvId,
    targetIdColumn: collectionTvLinks.collectionId,
    toRow: (row) => ({ order: row.orderInCollection, note: row.note }),
    buildInsertValue: (input) => ({
      tvId: input.mediaId,
      collectionId: input.targetId,
      orderInCollection: input.order
    }),
    buildPatchValues: (patch) => ({ orderInCollection: patch.order, note: patch.note })
  },
  tag: {
    table: tvTagLinks,
    mediaIdColumn: tvTagLinks.tvId,
    targetIdColumn: tvTagLinks.tagId,
    toRow: (row) => ({ order: row.orderInTv, note: row.note }),
    buildInsertValue: (input) => ({
      tvId: input.mediaId,
      tagId: input.targetId,
      orderInTv: input.order
    }),
    buildPatchValues: (patch) => ({ orderInTv: patch.order, note: patch.note })
  },
  company: {
    table: tvCompanyLinks,
    mediaIdColumn: tvCompanyLinks.tvId,
    targetIdColumn: tvCompanyLinks.companyId,
    buildRoleCondition: (role) => eq(tvCompanyLinks.role, role as LibraryTvCompanyRole),
    toRow: (row) => ({ order: row.orderInTv, note: row.note }),
    buildInsertValue: (input) => ({
      tvId: input.mediaId,
      companyId: input.targetId,
      role: input.role as LibraryTvCompanyRole,
      note: input.note,
      orderInTv: input.order
    }),
    buildPatchValues: (patch) => ({ orderInTv: patch.order, note: patch.note })
  },
  person: {
    table: tvPersonLinks,
    mediaIdColumn: tvPersonLinks.tvId,
    targetIdColumn: tvPersonLinks.personId,
    buildRoleCondition: (role) => eq(tvPersonLinks.role, role as LibraryTvPersonRole),
    toRow: (row) => ({ order: row.orderInTv, note: row.note, playing: row.playing }),
    buildInsertValue: (input) => ({
      tvId: input.mediaId,
      personId: input.targetId,
      role: input.role as LibraryTvPersonRole,
      note: input.note,
      playing: input.playing,
      orderInTv: input.order
    }),
    buildPatchValues: (patch) => ({
      orderInTv: patch.order,
      note: patch.note,
      playing: patch.playing
    })
  },
  character: {
    table: tvCharacterLinks,
    mediaIdColumn: tvCharacterLinks.tvId,
    targetIdColumn: tvCharacterLinks.characterId,
    buildRoleCondition: (role) => eq(tvCharacterLinks.role, role as LibraryTvCharacterRole),
    toRow: (row) => ({ order: row.orderInTv, note: row.note }),
    buildInsertValue: (input) => ({
      tvId: input.mediaId,
      characterId: input.targetId,
      role: input.role as LibraryTvCharacterRole,
      note: input.note,
      orderInTv: input.order
    }),
    buildPatchValues: (patch) => ({ orderInTv: patch.order, note: patch.note })
  }
}

const MOVIE_LINKS: MediaLinkConfigs = {
  collection: {
    table: collectionMovieLinks,
    mediaIdColumn: collectionMovieLinks.movieId,
    targetIdColumn: collectionMovieLinks.collectionId,
    toRow: (row) => ({ order: row.orderInCollection, note: row.note }),
    buildInsertValue: (input) => ({
      movieId: input.mediaId,
      collectionId: input.targetId,
      orderInCollection: input.order
    }),
    buildPatchValues: (patch) => ({ orderInCollection: patch.order, note: patch.note })
  },
  tag: {
    table: movieTagLinks,
    mediaIdColumn: movieTagLinks.movieId,
    targetIdColumn: movieTagLinks.tagId,
    toRow: (row) => ({ order: row.orderInMovie, note: row.note }),
    buildInsertValue: (input) => ({
      movieId: input.mediaId,
      tagId: input.targetId,
      orderInMovie: input.order
    }),
    buildPatchValues: (patch) => ({ orderInMovie: patch.order, note: patch.note })
  },
  company: {
    table: movieCompanyLinks,
    mediaIdColumn: movieCompanyLinks.movieId,
    targetIdColumn: movieCompanyLinks.companyId,
    buildRoleCondition: (role) => eq(movieCompanyLinks.role, role as LibraryMovieCompanyRole),
    toRow: (row) => ({ order: row.orderInMovie, note: row.note }),
    buildInsertValue: (input) => ({
      movieId: input.mediaId,
      companyId: input.targetId,
      role: input.role as LibraryMovieCompanyRole,
      note: input.note,
      orderInMovie: input.order
    }),
    buildPatchValues: (patch) => ({ orderInMovie: patch.order, note: patch.note })
  },
  person: {
    table: moviePersonLinks,
    mediaIdColumn: moviePersonLinks.movieId,
    targetIdColumn: moviePersonLinks.personId,
    buildRoleCondition: (role) => eq(moviePersonLinks.role, role as LibraryMoviePersonRole),
    toRow: (row) => ({ order: row.orderInMovie, note: row.note, playing: row.playing }),
    buildInsertValue: (input) => ({
      movieId: input.mediaId,
      personId: input.targetId,
      role: input.role as LibraryMoviePersonRole,
      note: input.note,
      playing: input.playing,
      orderInMovie: input.order
    }),
    buildPatchValues: (patch) => ({
      orderInMovie: patch.order,
      note: patch.note,
      playing: patch.playing
    })
  },
  character: {
    table: movieCharacterLinks,
    mediaIdColumn: movieCharacterLinks.movieId,
    targetIdColumn: movieCharacterLinks.characterId,
    buildRoleCondition: (role) => eq(movieCharacterLinks.role, role as LibraryMovieCharacterRole),
    toRow: (row) => ({ order: row.orderInMovie, note: row.note }),
    buildInsertValue: (input) => ({
      movieId: input.mediaId,
      characterId: input.targetId,
      role: input.role as LibraryMovieCharacterRole,
      note: input.note,
      orderInMovie: input.order
    }),
    buildPatchValues: (patch) => ({ orderInMovie: patch.order, note: patch.note })
  }
}

const MEDIA_LINKS: Record<LibraryMediaType, MediaLinkConfigs> = {
  game: GAME_LINKS,
  anime: ANIME_LINKS,
  tv: TV_LINKS,
  movie: MOVIE_LINKS
}

export function mediaLinkConfigs(mediaType: LibraryMediaType | undefined): MediaLinkConfigs {
  return MEDIA_LINKS[mediaType ?? 'game']
}
