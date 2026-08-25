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
  LibraryComicCharacterRole,
  LibraryComicCompanyRole,
  LibraryComicPersonRole,
  LibraryGameCharacterRole,
  LibraryGameCompanyRole,
  LibraryGamePersonRole,
  LibraryMediaType,
  LibraryNovelCharacterRole,
  LibraryNovelCompanyRole,
  LibraryNovelPersonRole
} from '@kisaki3/extension-api'
import {
  animeCastLinks,
  animeCharacterLinks,
  animeCompanyLinks,
  animePersonLinks,
  animeTagLinks,
  collectionAnimeLinks,
  collectionComicLinks,
  collectionGameLinks,
  collectionNovelLinks,
  comicCharacterLinks,
  comicCompanyLinks,
  comicPersonLinks,
  comicTagLinks,
  gameCastLinks,
  gameCharacterLinks,
  gameCompanyLinks,
  gamePersonLinks,
  gameTagLinks,
  novelCharacterLinks,
  novelCompanyLinks,
  novelPersonLinks,
  novelTagLinks
} from '@shared/db'
import type { AnySQLiteColumn as CastColumn } from 'drizzle-orm/sqlite-core'
import type { DbContext } from '@main/services/db'

/** Every media link row carries an order within the media entry and a note. */
export interface MediaLinkRow {
  order: number
  note: string | null
}

export interface MediaLinkInsertInput {
  mediaId: string
  targetId: string
  /** Set on the link kinds whose rows are keyed by role. */
  role?: string
  note?: string
  order: number
}

export interface MediaLinkPatch {
  order?: number
  note?: string
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
  /** Absent on media types without voice credits; validation rejects the edge upstream. */
  cast?: MediaCastConfig
}

/**
 * Addressing of one entry's cast table.
 *
 * Cast rows name three endpoints and carry no order, so they use their own
 * descriptor rather than the ordered two-endpoint link shape.
 */
export interface MediaCastConfig<TTable extends SQLiteTable = SQLiteTable> {
  table: TTable
  mediaIdColumn: CastColumn<{ data: string }>
  characterIdColumn: CastColumn<{ data: string }>
  personIdColumn: CastColumn<{ data: string }>
  buildInsertValue(input: MediaCastInsertInput): SQLiteInsertValue<TTable>
}

export interface MediaCastInsertInput {
  mediaId: string
  characterId: string
  personId: string
  note?: string
}

export interface MediaCastRow {
  note: string | null
}

export function readMediaCast<TTable extends SQLiteTable>(
  db: DbContext,
  config: MediaCastConfig<TTable>,
  mediaId: string,
  characterId: string,
  personId: string
): MediaCastRow | undefined {
  const row = db
    .select()
    .from(config.table)
    .where(mediaCastCondition(config, mediaId, characterId, personId))
    .get() as { note: string | null } | undefined
  return row ? { note: row.note } : undefined
}

export function insertMediaCast<TTable extends SQLiteTable>(
  db: DbContext,
  config: MediaCastConfig<TTable>,
  input: MediaCastInsertInput
): void {
  db.insert(config.table).values(config.buildInsertValue(input)).run()
}

export function updateMediaCastNote<TTable extends SQLiteTable>(
  db: DbContext,
  config: MediaCastConfig<TTable>,
  mediaId: string,
  characterId: string,
  personId: string,
  note: string
): void {
  db.update(config.table)
    .set({ note } as SQLiteUpdateSetSource<TTable>)
    .where(mediaCastCondition(config, mediaId, characterId, personId))
    .run()
}

function mediaCastCondition<TTable extends SQLiteTable>(
  config: MediaCastConfig<TTable>,
  mediaId: string,
  characterId: string,
  personId: string
): SQL {
  return and(
    eq(config.mediaIdColumn, mediaId),
    eq(config.characterIdColumn, characterId),
    eq(config.personIdColumn, personId)
  ) as SQL
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
    toRow: (row) => ({ order: row.orderInGame, note: row.note }),
    buildInsertValue: (input) => ({
      gameId: input.mediaId,
      personId: input.targetId,
      role: input.role as LibraryGamePersonRole,
      note: input.note,
      orderInGame: input.order
    }),
    buildPatchValues: (patch) => ({ orderInGame: patch.order, note: patch.note })
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
  },
  cast: {
    table: gameCastLinks,
    mediaIdColumn: gameCastLinks.gameId,
    characterIdColumn: gameCastLinks.characterId,
    personIdColumn: gameCastLinks.personId,
    buildInsertValue: (input) => ({
      gameId: input.mediaId,
      characterId: input.characterId,
      personId: input.personId,
      note: input.note
    })
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
    toRow: (row) => ({ order: row.orderInAnime, note: row.note }),
    buildInsertValue: (input) => ({
      animeId: input.mediaId,
      personId: input.targetId,
      role: input.role as LibraryAnimePersonRole,
      note: input.note,
      orderInAnime: input.order
    }),
    buildPatchValues: (patch) => ({ orderInAnime: patch.order, note: patch.note })
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
  },
  cast: {
    table: animeCastLinks,
    mediaIdColumn: animeCastLinks.animeId,
    characterIdColumn: animeCastLinks.characterId,
    personIdColumn: animeCastLinks.personId,
    buildInsertValue: (input) => ({
      animeId: input.mediaId,
      characterId: input.characterId,
      personId: input.personId,
      note: input.note
    })
  }
}

const COMIC_LINKS: MediaLinkConfigs = {
  collection: {
    table: collectionComicLinks,
    mediaIdColumn: collectionComicLinks.comicId,
    targetIdColumn: collectionComicLinks.collectionId,
    toRow: (row) => ({ order: row.orderInCollection, note: row.note }),
    buildInsertValue: (input) => ({
      comicId: input.mediaId,
      collectionId: input.targetId,
      orderInCollection: input.order
    }),
    buildPatchValues: (patch) => ({ orderInCollection: patch.order, note: patch.note })
  },
  tag: {
    table: comicTagLinks,
    mediaIdColumn: comicTagLinks.comicId,
    targetIdColumn: comicTagLinks.tagId,
    toRow: (row) => ({ order: row.orderInComic, note: row.note }),
    buildInsertValue: (input) => ({
      comicId: input.mediaId,
      tagId: input.targetId,
      orderInComic: input.order
    }),
    buildPatchValues: (patch) => ({ orderInComic: patch.order, note: patch.note })
  },
  company: {
    table: comicCompanyLinks,
    mediaIdColumn: comicCompanyLinks.comicId,
    targetIdColumn: comicCompanyLinks.companyId,
    buildRoleCondition: (role) => eq(comicCompanyLinks.role, role as LibraryComicCompanyRole),
    toRow: (row) => ({ order: row.orderInComic, note: row.note }),
    buildInsertValue: (input) => ({
      comicId: input.mediaId,
      companyId: input.targetId,
      role: input.role as LibraryComicCompanyRole,
      note: input.note,
      orderInComic: input.order
    }),
    buildPatchValues: (patch) => ({ orderInComic: patch.order, note: patch.note })
  },
  person: {
    table: comicPersonLinks,
    mediaIdColumn: comicPersonLinks.comicId,
    targetIdColumn: comicPersonLinks.personId,
    buildRoleCondition: (role) => eq(comicPersonLinks.role, role as LibraryComicPersonRole),
    toRow: (row) => ({ order: row.orderInComic, note: row.note }),
    buildInsertValue: (input) => ({
      comicId: input.mediaId,
      personId: input.targetId,
      role: input.role as LibraryComicPersonRole,
      note: input.note,
      orderInComic: input.order
    }),
    buildPatchValues: (patch) => ({ orderInComic: patch.order, note: patch.note })
  },
  character: {
    table: comicCharacterLinks,
    mediaIdColumn: comicCharacterLinks.comicId,
    targetIdColumn: comicCharacterLinks.characterId,
    buildRoleCondition: (role) => eq(comicCharacterLinks.role, role as LibraryComicCharacterRole),
    toRow: (row) => ({ order: row.orderInComic, note: row.note }),
    buildInsertValue: (input) => ({
      comicId: input.mediaId,
      characterId: input.targetId,
      role: input.role as LibraryComicCharacterRole,
      note: input.note,
      orderInComic: input.order
    }),
    buildPatchValues: (patch) => ({ orderInComic: patch.order, note: patch.note })
  }
}

const NOVEL_LINKS: MediaLinkConfigs = {
  collection: {
    table: collectionNovelLinks,
    mediaIdColumn: collectionNovelLinks.novelId,
    targetIdColumn: collectionNovelLinks.collectionId,
    toRow: (row) => ({ order: row.orderInCollection, note: row.note }),
    buildInsertValue: (input) => ({
      novelId: input.mediaId,
      collectionId: input.targetId,
      orderInCollection: input.order
    }),
    buildPatchValues: (patch) => ({ orderInCollection: patch.order, note: patch.note })
  },
  tag: {
    table: novelTagLinks,
    mediaIdColumn: novelTagLinks.novelId,
    targetIdColumn: novelTagLinks.tagId,
    toRow: (row) => ({ order: row.orderInNovel, note: row.note }),
    buildInsertValue: (input) => ({
      novelId: input.mediaId,
      tagId: input.targetId,
      orderInNovel: input.order
    }),
    buildPatchValues: (patch) => ({ orderInNovel: patch.order, note: patch.note })
  },
  company: {
    table: novelCompanyLinks,
    mediaIdColumn: novelCompanyLinks.novelId,
    targetIdColumn: novelCompanyLinks.companyId,
    buildRoleCondition: (role) => eq(novelCompanyLinks.role, role as LibraryNovelCompanyRole),
    toRow: (row) => ({ order: row.orderInNovel, note: row.note }),
    buildInsertValue: (input) => ({
      novelId: input.mediaId,
      companyId: input.targetId,
      role: input.role as LibraryNovelCompanyRole,
      note: input.note,
      orderInNovel: input.order
    }),
    buildPatchValues: (patch) => ({ orderInNovel: patch.order, note: patch.note })
  },
  person: {
    table: novelPersonLinks,
    mediaIdColumn: novelPersonLinks.novelId,
    targetIdColumn: novelPersonLinks.personId,
    buildRoleCondition: (role) => eq(novelPersonLinks.role, role as LibraryNovelPersonRole),
    toRow: (row) => ({ order: row.orderInNovel, note: row.note }),
    buildInsertValue: (input) => ({
      novelId: input.mediaId,
      personId: input.targetId,
      role: input.role as LibraryNovelPersonRole,
      note: input.note,
      orderInNovel: input.order
    }),
    buildPatchValues: (patch) => ({ orderInNovel: patch.order, note: patch.note })
  },
  character: {
    table: novelCharacterLinks,
    mediaIdColumn: novelCharacterLinks.novelId,
    targetIdColumn: novelCharacterLinks.characterId,
    buildRoleCondition: (role) => eq(novelCharacterLinks.role, role as LibraryNovelCharacterRole),
    toRow: (row) => ({ order: row.orderInNovel, note: row.note }),
    buildInsertValue: (input) => ({
      novelId: input.mediaId,
      characterId: input.targetId,
      role: input.role as LibraryNovelCharacterRole,
      note: input.note,
      orderInNovel: input.order
    }),
    buildPatchValues: (patch) => ({ orderInNovel: patch.order, note: patch.note })
  }
}

const MEDIA_LINKS: Record<LibraryMediaType, MediaLinkConfigs> = {
  game: GAME_LINKS,
  anime: ANIME_LINKS,
  comic: COMIC_LINKS,
  novel: NOVEL_LINKS
}

export function mediaLinkConfigs(mediaType: LibraryMediaType | undefined): MediaLinkConfigs {
  return MEDIA_LINKS[mediaType ?? 'game']
}
